import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCargoDto } from './dto/create-cargo.dto';
import { UpdateCargoDto } from './dto/update-cargo.dto';

@Injectable()
export class CargoAdministrativoService {
  constructor(private prisma: PrismaService) {}

  // ---------- helpers ----------
  private validateRange(ini: string, fin?: string | null) {
    if (fin) {
      const a = new Date(ini).getTime();
      const b = new Date(fin).getTime();
      if (!isFinite(a) || !isFinite(b) || b < a) {
        throw new BadRequestException('fecha_fin no puede ser anterior a fecha_inicio');
      }
    }
  }

  private async getActiveForUser(usuarioId: number) {
    const now = new Date();
    return this.prisma.cargo_administrativo.findFirst({
      where: {
        usuarioId,
        fecha_inicio: { lte: now },
        OR: [{ fecha_fin: null }, { fecha_fin: { gt: now } }],
      },
      orderBy: { fecha_inicio: 'desc' },
    });
  }

  // ---------- create ----------
  async create(dto: CreateCargoDto) {
    // Solo 1 vigente por usuario
    const active = await this.getActiveForUser(dto.usuarioId);
    const fin = dto.fecha_fin ?? null;

    this.validateRange(dto.fecha_inicio, fin);

    if (!fin && active) {
      throw new BadRequestException('El usuario ya tiene un cargo vigente. Cierre el actual antes de crear otro.');
    }

    return this.prisma.cargo_administrativo.create({
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        fecha_inicio: new Date(dto.fecha_inicio),
        fecha_fin: fin ? new Date(fin) : null,
        estado_cargo: dto.estado_cargo ?? true,
        usuario: { connect: { ID_usuario: dto.usuarioId } },
      },
    });
  }

  // ---------- list ----------
  async findAll({ limit = 20, offset = 0, usuarioId }: { limit?: number; offset?: number; usuarioId?: number }) {
    const where = usuarioId ? { usuarioId } : {};
    const [rows, count] = await this.prisma.$transaction([
      this.prisma.cargo_administrativo.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { fecha_inicio: 'desc' },
        include: { usuario: { include: { persona: true } } },
      }),
      this.prisma.cargo_administrativo.count({ where }),
    ]);
    return { count, rows };
  }

  // ---------- get ----------
  async findOne(id: number) {
    const row = await this.prisma.cargo_administrativo.findUnique({ where: { ID_cargo: id } });
    if (!row) throw new NotFoundException('Cargo no encontrado');
    return row;
  }

  // ---------- update ----------
  async update(id: number, dto: UpdateCargoDto) {
    const row = await this.findOne(id);

    // Validar coherencia de fechas con fallback a las actuales
    const ini = dto.fecha_inicio ?? row.fecha_inicio.toISOString();
    const fin = dto.fecha_fin ?? row.fecha_fin?.toISOString() ?? null;
    this.validateRange(ini, fin);

    // Si quieren reabrir (fecha_fin = null), aseguramos que no hay otro cargo vigente para el mismo usuario
    if (Object.prototype.hasOwnProperty.call(dto, 'fecha_fin') && dto.fecha_fin === null) {
      const active = await this.getActiveForUser(row.usuarioId);
      if (active && active.ID_cargo !== row.ID_cargo) {
        throw new BadRequestException('El usuario ya tiene otro cargo vigente. Cierre el otro antes de reabrir este.');
      }
    }

    const data: any = {
      nombre: dto.nombre ?? row.nombre,
      descripcion: dto.descripcion ?? row.descripcion,
      estado_cargo: dto.estado_cargo ?? row.estado_cargo,
    };

    if (dto.fecha_inicio) data.fecha_inicio = new Date(dto.fecha_inicio);
    if (Object.prototype.hasOwnProperty.call(dto, 'fecha_fin')) {
      data.fecha_fin = dto.fecha_fin === null ? null : new Date(dto.fecha_fin!);
    }

    return this.prisma.cargo_administrativo.update({
      where: { ID_cargo: id },
      data,
    });
  }

  // ---------- delete ----------
  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.cargo_administrativo.delete({ where: { ID_cargo: id } });
  }
}
