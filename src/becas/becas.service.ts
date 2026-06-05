import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBecaDto } from './dto/create-beca.dto';
import { UpdateBecaDto } from './dto/update-beca.dto';
import { ListBecasDto } from './dto/list-becas.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class BecasService {
  constructor(private prisma: PrismaService) {}

  // convierte "YYYY-MM-DD" a Date 00:00:00Z (para DateTime de Prisma)
  private toISODate(dateStr?: string): Date | undefined {
    if (!dateStr) return undefined;
  // crear Date local a medianoche sin usar UTC
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0); // sin "Z"
  }

  // ---------- utils ----------
  private validateFechas(inicioISO: string, finISO?: string) {
    if (!finISO) return;
    const ini = new Date(inicioISO).getTime();
    const fin = new Date(finISO).getTime();
    if (isNaN(ini) || isNaN(fin)) return; // ValidationPipe ya valida ISO
    if (fin < ini) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la fecha de inicio',
      );
    }
  }

  private async ensureExists(id: number) {
    const exists = await this.prisma.beca.findUnique({
      where: { ID_beca: id },
      select: { ID_beca: true },
    });
    if (!exists) throw new NotFoundException('Beca no encontrada');
  }

  // ---------- CRUD ----------
  async create(dto: CreateBecaDto) {
    this.validateFechas(dto.fecha_inicio, dto.fecha_fin);
    return this.prisma.beca.create({
      data: {
        nombre: dto.nombre,
        detalle: dto.detalle,
        imagen: dto.imagen,
        tipo: dto.tipo,
        cupos: dto.cupos ?? null,
        estado: dto.estado ?? true, // si tu schema tiene default:true, puedes omitirlo
        fecha_inicio: this.toISODate(dto.fecha_inicio)!,      // <-- convertir
        fecha_fin: this.toISODate(dto.fecha_fin),             // <-- convertir (opcional)
        periodo_bloqueo: dto.periodo_bloqueo ?? 'ANUAL',
      },
    });
  }

  // Listado con paginación, búsqueda e include opcional
  async findAll(q: ListBecasDto) {
    const { limit = 10, offset = 0, search = '', include = 'none' } = q ?? {};

    const where =
      search.trim()
        ? {
            OR: [
              { nombre: { contains: search, mode: 'insensitive' as const } },
              { tipo: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {};

    const args: Prisma.becaFindManyArgs = {
      where,
      skip: offset,
      take: limit,
      orderBy: { fecha_inicio: 'desc' },
    };

    if (include === 'relaciones') {
      args.include = {
        pasos: {
          include: { requisito: true },
          orderBy: [{ orden: 'asc' }],
        },
        postulaciones: true,
      };
    } else {
      args.select = {
        ID_beca: true,
        nombre: true,
        detalle: true, 
        imagen: true,
        tipo: true,
        cupos: true,
        estado: true,
        fecha_inicio: true,
        fecha_fin: true,
        periodo_bloqueo: true,
        
      };
    }

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.beca.findMany(args),
      this.prisma.beca.count({ where }),
    ]);

    return { count, rows };
  }

  async findOne(id: number) {
    const beca = await this.prisma.beca.findUnique({
      where: { ID_beca: id },
      include: {
        pasos: {
          include: { requisito: true },
          orderBy: [{ orden: 'asc' }],
        },
        postulaciones: true,
      },
    });
    if (!beca) throw new NotFoundException('Beca no encontrada');
    return beca;
  }

  async update(id: number, dto: UpdateBecaDto) {
    await this.ensureExists(id);

    // Validar fechas si cambian
    if (dto.fecha_inicio || dto.fecha_fin) {
      const actual = await this.prisma.beca.findUnique({
        where: { ID_beca: id },
        select: { fecha_inicio: true, fecha_fin: true },
      });
      const ini = dto.fecha_inicio ?? actual?.fecha_inicio.toISOString();
      const fin = dto.fecha_fin ?? actual?.fecha_fin?.toISOString();
      if (ini) this.validateFechas(ini, fin);
    }

    return this.prisma.beca.update({
      where: { ID_beca: id },
      data: {
        ...dto,
        ...(dto.fecha_inicio
          ? { fecha_inicio: this.toISODate(dto.fecha_inicio) }
          : {}),
        ...(dto.fecha_fin ? { fecha_fin: this.toISODate(dto.fecha_fin) } : {}),
      },
    });
  }

  // Soft delete: activar / desactivar
  async toggleEstado(id: number, estado: boolean) {
    await this.ensureExists(id);
    return this.prisma.beca.update({
      where: { ID_beca: id },
      data: { estado },
      select: {
        ID_beca: true,
        nombre: true,
        cupos: true,
        detalle: true,
        imagen: true,
        estado: true,
      },
    });
  }

  // Hard delete: eliminar definitivamente
  async remove(id: number) {
    await this.ensureExists(id);
    return this.prisma.beca.delete({ where: { ID_beca: id } });
  }

  // ---------- Becas vigentes (por fecha actual) ----------
  async vigentes(q: ListBecasDto) {
    const { limit = 10, offset = 0, search = '' } = q ?? {};
    const today = new Date();
    // FECHA SIMULADA PARA PRUEBA 2027
// const today = new Date(2027, 0, 1);

    const baseWhere = {
      estado: true,
      fecha_inicio: { lte: today },
      OR: [{ fecha_fin: null }, { fecha_fin: { gte: today } }],
    };

    const where =
      search.trim()
        ? {
            AND: [
              baseWhere,
              {
                OR: [
                  { nombre: { contains: search, mode: 'insensitive' as const } },
                  { tipo: { contains: search, mode: 'insensitive' as const } },
                ],
              },
            ],
          }
        : baseWhere;

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.beca.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { fecha_inicio: 'desc' },
        select: {
          ID_beca: true,
          nombre: true,
          detalle: true,
          imagen: true,
          tipo: true,
          cupos: true,
          fecha_inicio: true,
          fecha_fin: true,
          periodo_bloqueo: true,
        },
      }),
      this.prisma.beca.count({ where }),
    ]);

    return { count, rows };
  }
  // 🔄 Cerrar becas vencidas y marcar postulaciones activas como ABANDONADAS automáticamente
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) // ⏰ ejecuta cada medianoche
  async cerrarBecasVencidasCron() {
    const hoy = new Date();

    // 1️⃣ Buscar becas con fecha_fin menor a hoy
    const becasVencidas = await this.prisma.beca.findMany({
      where: {
        fecha_fin: { lt: hoy },
        estado: true,
      },
      select: { ID_beca: true, nombre: true },
    });

    if (!becasVencidas.length) return;

    for (const beca of becasVencidas) {
      const { count } = await this.prisma.postulacion.updateMany({
        where: {
          becaId: beca.ID_beca,
          estado: { in: ['EN_PROCESO', 'PENDIENTE'] },
        },
        data: {
          estado: 'ABANDONADO',
          observacion:
            'Trámite cerrado automáticamente por vencimiento de la beca.',
        },
      });

      if (count > 0) {
        console.log(
          `🔒 ${count} postulaciones cerradas automáticamente para la beca "${beca.nombre}".`
        );
      }
    }
  }
async misRegistrosHistorial(q: {
  usuarioId: number;
  gestion?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const {
    usuarioId,
    gestion,
    search = '',
    limit = 12,
    offset = 0,
  } = q;

  const usuario = await this.prisma.usuario.findUnique({
    where: { ID_usuario: usuarioId },
    include: { persona: true },
  });

  if (!usuario?.persona) {
    throw new BadRequestException('Usuario sin persona asociada.');
  }

  const estudiante = await this.prisma.estudiante.findFirst({
    where: { personaId: usuario.persona.ID_persona },
  });

  if (!estudiante) {
    throw new BadRequestException('No se encontró el estudiante.');
  }

  const where: Prisma.postulacionWhereInput = {
    estudianteId: estudiante.ID_estudiante,
    estado: {
      in: ['APROBADO', 'REPROBADO'],
    },
    ...(gestion ? { gestion } : {}),

    beca: {
      estado: true,
      ...(search.trim()
        ? {
            OR: [
              {
                nombre: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                tipo: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    },
  };

  const [rows, count] = await this.prisma.$transaction([
    this.prisma.postulacion.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { fecha: 'desc' },
      include: {
        beca: true,
        estudiante: {
          include: {
            persona: true,
          },
        },
      },
    }),
    this.prisma.postulacion.count({ where }),
  ]);

  return {
    count,
    rows: rows.map((p) => ({
      ID_beca: p.beca.ID_beca,
      ID_postulacion: p.ID_postulacion,
      nombre: p.beca_historial_capturado
        ? p.beca_nombre_historico
        : p.beca.nombre,
      tipo: p.beca_historial_capturado
        ? p.beca_tipo_historico
        : p.beca.tipo,
      detalle: p.beca.detalle,
      imagen: p.beca.imagen,
      fecha_inicio: p.beca_historial_capturado
        ? p.beca_fecha_inicio_historico
        : p.beca.fecha_inicio,
      fecha_fin: p.beca_historial_capturado
        ? p.beca_fecha_fin_historico
        : p.beca.fecha_fin,
      estado_postulacion: p.estado,
      gestion: p.gestion,
      codigo_seguimiento: p.codigo_seguimiento,
      fecha_postulacion: p.fecha,
      nombre_completo: [
        p.estudiante.persona.nombre,
        p.estudiante.persona.apellido_paterno,
        p.estudiante.persona.apellido_materno,
      ].filter(Boolean).join(' '),

      ci: p.estudiante.persona.ci,
      observacion: p.observacion,
      estado_observacion: p.estado_observacion,
    })),
  };
}
}
