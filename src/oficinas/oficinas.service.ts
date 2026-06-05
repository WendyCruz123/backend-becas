import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOficinaDto } from './dto/create-oficina.dto';
import { UpdateOficinaDto } from './dto/update-oficina.dto';
import { ListOficinasDto } from './dto/list-oficinas.dto';
import { SetEncargadoDto } from './dto/set-encargado.dto';

@Injectable()
export class OficinasService {
  constructor(private prisma: PrismaService) {}

  // ---------- CRUD ----------
    async create(dto: CreateOficinaDto) {
    await this.ensureRutaExists(dto.panorama_route_slug);

    return this.prisma.oficina.create({
      data: dto,
    });
  }

  async findAll(q: ListOficinasDto) {
    const { limit = 10, offset = 0, search = '' } = q ?? {};
    const where : any =
      search?.trim()
        ? {
            OR: [
              { nombre: { contains: search, mode: 'insensitive' } },
              { descripcion: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {};

    const [rows, count] = await Promise.all([
      this.prisma.oficina.findMany({
        skip: offset,
        take: limit,
        where,
        orderBy: { nombre: 'asc' },
        include: {
          _count: { select: { panoramas: true, requisito: true } },
        },
      }),
      this.prisma.oficina.count({ where }),
    ]);

    return { count, rows };
  }

  async findOne(id: number) {
    const oficina = await this.prisma.oficina.findUnique({
      where: { ID_oficina: id },
      include: {
        panoramas: { select: { id: true, name: true, es_portada: true, createdAt: false } },
      },
    });
    if (!oficina) throw new NotFoundException('Oficina no encontrada');

    const encargado = await this.getEncargadoActual(id);
    return { ...oficina, encargado_actual: encargado };
  }

  async update(id: number, dto: UpdateOficinaDto) {
    await this.ensureOficina(id);
    await this.ensureRutaExists(dto.panorama_route_slug);

    return this.prisma.oficina.update({
      where: { ID_oficina: id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.ensureOficina(id);
    // Si prefieres solo desactivar:
    // return this.prisma.oficina.update({ where: { ID_oficina: id }, data: { estado_oficina: false }});
    return this.prisma.oficina.delete({ where: { ID_oficina: id } });
  }

  private async ensureOficina(id: number) {
    const exists = await this.prisma.oficina.findUnique({
      where: { ID_oficina: id },
      select: { ID_oficina: true },
    });
    if (!exists) throw new NotFoundException('Oficina no encontrada');
  }

  // Encargado vigente (preferimos activo sin fecha_fin)
  async getEncargadoActual(oficinaId: number) {
    await this.ensureOficina(oficinaId);
    const enc = await this.prisma.encargado_oficina.findFirst({
      where: { oficinaId, estado: true, fecha_fin: null },
      orderBy: { fecha_inicio: 'desc' },
    });
    if (enc) return enc;

    return this.prisma.encargado_oficina.findFirst({
      where: { oficinaId },
      orderBy: { fecha_inicio: 'desc' },
    });
  }

  // Cambia/define encargado: cierra el anterior y crea el nuevo
  async setEncargado(oficinaId: number, dto: SetEncargadoDto) {
    await this.ensureOficina(oficinaId);

    return this.prisma.$transaction(async (tx) => {
      // cerrar encargado(s) vigente(s)
      await tx.encargado_oficina.updateMany({
        where: { oficinaId, estado: true, fecha_fin: null },
        data: { estado: false, fecha_fin: new Date() },
      });

      // crear nuevo encargado con los campos del DTO
      const nuevo = await tx.encargado_oficina.create({
        data: {
          oficinaId,
          nombre: dto.nombre,
          apellido_paterno: dto.apellido_paterno,
          apellido_materno: dto.apellido_materno ?? '' ,
          correo_electronico: dto.correo_electronico ?? null,
          celular: dto.celular ?? null,
          fecha_inicio: new Date(),
          fecha_fin: null,
          estado: dto.estado ?? true,
          turno_atencion: dto.turno_atencion ?? 'No especificado',
        },
      });

      return nuevo;
    });
  }

  // ---------- Panoramas de la oficina ----------
  async listPanoramas(oficinaId: number) {
    await this.ensureOficina(oficinaId);
    return this.prisma.panorama.findMany({
      where: { oficina_id: oficinaId },
      orderBy: [{ es_portada: 'desc' }, { orden: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        fileUrl: true,
        publicado: true,
        es_portada: true,
        orden: true,
        createdAt: true,
      },
    });
  }
  private async ensureRutaExists(slug?: string | null) {
    if (!slug) return;

    const ruta = await this.prisma.ruta_360.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!ruta) {
      throw new BadRequestException('La ruta 360 seleccionada no existe');
    }
  }
}
