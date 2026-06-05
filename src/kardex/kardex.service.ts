import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RevisarKardexDto } from './dto/revisar-kardex.dto';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class KardexService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  async pendientes() {
    return this.prisma.paso_estudiante.findMany({
      where: {
        estado_revision: {
          in: ['PENDIENTE_KARDEX', 'EN_REVISION_KARDEX'],
        },
      },
      include: {
        postulacion: {
          include: {
            beca: true,
            estudiante: {
              include: {
                persona: {
                  include: {
                    usuario: true,
                  },
                },
              },
            },
          },
        },
        pasoBeca: {
          include: {
            requisito: true,
          },
        },
      },
      orderBy: {
        ID_paso_estudiante: 'desc',
      },
    });
  }

  async revisados() {
    return this.prisma.paso_estudiante.findMany({
      where: {
        estado_revision: {
          in: ['LEGALIZADO', 'RECHAZADO'],
        },
      },
      include: {
        postulacion: {
          include: {
            beca: true,
            estudiante: {
              include: {
                persona: {
                  include: {
                    usuario: true,
                  },
                },
              },
            },
          },
        },
        pasoBeca: {
          include: {
            requisito: true,
          },
        },
      },
      orderBy: {
        fecha_revision: 'desc',
      },
    });
  }
async pasarARevision(id: number, usuarioId: number) {
  const paso = await this.prisma.paso_estudiante.findUnique({
    where: { ID_paso_estudiante: id },
    include: {
      postulacion: {
        include: {
          estudiante: {
            include: {
              persona: {
                include: {
                  usuario: true,
                },
              },
            },
          },
        },
      },
      pasoBeca: {
        include: {
          requisito: true,
        },
      },
    },
  });

  if (!paso) {
    throw new NotFoundException('Solicitud de Kardex no encontrada.');
  }

  if (!paso.pasoBeca.requisito.requiere_legalizacion) {
    throw new BadRequestException(
      'Este requisito no requiere legalización por Kardex.',
    );
  }

  if (paso.estado_revision !== 'PENDIENTE_KARDEX') {
    throw new BadRequestException(
      'Este requisito no está pendiente de recepción por Kardex.',
    );
  }

  const actualizado = await this.prisma.paso_estudiante.update({
    where: { ID_paso_estudiante: id },
    data: {
      estado_revision: 'EN_REVISION_KARDEX',
      fecha_revision: new Date(),
      observacion_revision: null,
    },
  });

  await this.prisma.audit_log.create({
    data: {
      tabla: 'paso_estudiante',
      registroId: String(id),
      accion: 'PASAR_A_REVISION_KARDEX',
      usuarioId,
      detalle: `Kardex recibió el requisito ${paso.pasoBeca.requisito.nombre} y lo pasó a revisión.`,
      antes: {
        estado_revision: paso.estado_revision,
      },
      despues: {
        estado_revision: 'EN_REVISION_KARDEX',
      },
    },
  });

  const usuario = paso.postulacion.estudiante.persona.usuario;

  if (usuario) {
    const titulo = 'Documento recibido por Kardex';
    const mensaje = `Kardex recibió su requisito "${paso.pasoBeca.requisito.nombre}" y lo pasó a revisión.`;

    await this.prisma.notificacionSistema.create({
      data: {
        userId: usuario.ID_usuario,
        titulo,
        mensaje,
        tipo: 'INFO',
        url: `/becas-disponibles/${paso.postulacion.becaId}`,
      },
    });
  }

  return {
    ok: true,
    message: 'Requisito pasado a revisión correctamente.',
    data: actualizado,
  };
}
  async revisar(
  id: number,
  dto: RevisarKardexDto,
  usuarioId: number,
) {
    const paso = await this.prisma.paso_estudiante.findUnique({
      where: { ID_paso_estudiante: id },
      include: {
        postulacion: {
          include: {
            estudiante: {
              include: {
                persona: {
                  include: {
                    usuario: true,
                  },
                },
              },
            },
          },
        },
        pasoBeca: {
          include: {
            requisito: true,
          },
        },
      },
    });

    if (!paso) {
      throw new NotFoundException('Solicitud de Kardex no encontrada.');
    }

    if (paso.estado_revision !== 'EN_REVISION_KARDEX') {
      throw new BadRequestException(
        'Esta solicitud todavía no fue pasada a revisión por Kardex o ya fue revisada.',
      );
    }

    if (dto.estado === 'RECHAZADO' && !dto.observacion?.trim()) {
      throw new BadRequestException(
        'Debe registrar una observación cuando el requisito es rechazado.',
      );
    }

    const requisitoNombre = paso.pasoBeca.requisito.nombre;

    const actualizado = await this.prisma.paso_estudiante.update({
      where: { ID_paso_estudiante: id },
      data: {
        estado_revision: dto.estado,
        observacion_revision:
          dto.estado === 'RECHAZADO' ? dto.observacion?.trim() : null,
        fecha_revision: new Date(),

        completado: dto.estado === 'LEGALIZADO',
        fecha_completado: dto.estado === 'LEGALIZADO' ? new Date() : null,
      },
    });
    await this.prisma.audit_log.create({
      data: {
        tabla: 'paso_estudiante',
        registroId: String(id),

        accion:
          dto.estado === 'LEGALIZADO'
            ? 'LEGALIZAR_DOCUMENTO'
            : 'RECHAZAR_DOCUMENTO',

        usuarioId,

        detalle:
          dto.estado === 'LEGALIZADO'
            ? `Kardex legalizó el requisito ${requisitoNombre}`
            : `Kardex rechazó el requisito ${requisitoNombre}`,

        antes: {
          estado_revision: paso.estado_revision,
          completado: paso.completado,
        },

        despues: {
          estado_revision: dto.estado,
          completado:
            dto.estado === 'LEGALIZADO',
          observacion: dto.observacion ?? null,
        },
      },
    });
    const usuario = paso.postulacion.estudiante.persona.usuario;

    if (usuario) {
        const titulo =
            dto.estado === 'LEGALIZADO'
            ? 'Requisito legalizado por Kardex'
            : 'Requisito rechazado por Kardex';

        const mensaje =
            dto.estado === 'LEGALIZADO'
            ? `Su requisito "${requisitoNombre}" fue legalizado. Pase por Kardex para recoger el documento.`
            : `Su requisito "${requisitoNombre}" fue rechazado. Observación: ${dto.observacion}`;

        await this.prisma.notificacionSistema.create({
            data: {
            userId: usuario.ID_usuario,
            titulo,
            mensaje,
            tipo: dto.estado === 'LEGALIZADO' ? 'SUCCESS' : 'WARNING',
            url: `/becas-disponibles/${paso.postulacion.becaId}`,
            },
        });

        await this.notificationsService.sendToUser(
            usuario.ID_usuario,
            titulo,
            mensaje,
            ['email', 'whatsapp'],
        );
        }

    return {
      ok: true,
      message:
        dto.estado === 'LEGALIZADO'
          ? 'Requisito legalizado correctamente.'
          : 'Requisito rechazado correctamente.',
      data: actualizado,
    };
  }
}