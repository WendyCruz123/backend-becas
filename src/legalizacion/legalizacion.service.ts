import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class LegalizacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async misPendientes(usuarioId: number) {
    const rows = await this.prisma.paso_legalizacion_estudiante.findMany({
      where: { usuarioId },
// async misPendientes(usuarioId: number, gestion?: string) {
//   const rows = await this.prisma.paso_legalizacion_estudiante.findMany({
//     where: {
//       usuarioId,
//       ...(gestion
//         ? {
//             pasoEstudiante: {
//               postulacion: {
//                 gestion,
//               },
//             },
//           }
//         : {}),
//     },

      include: {
        pasoEstudiante: {
          include: {
            postulacion: {
              include: {
                beca: true,
                estudiante: {
                  include: {
                    persona: {
                      include: { usuario: true },
                    },
                  },
                },
              },
            },
            pasoBeca: {
              include: {
                requisito: {
                  include: {
                    entrega_final_usuario: {
                      include: { persona: true },
                    },
                  },
                },
              },
            },
          },
        },
        usuario: {
          include: { persona: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    const mapRow = (r: any) => ({
      id: r.id,
      estado: r.estado,
      orden: r.orden,
      activo_revision: r.activo_revision,
      es_entrega_final: r.es_entrega_final,
      fecha_inicio: r.fecha_inicio,
      fecha_revision: r.fecha_revision,
      observacion: r.observacion,

      requisito: {
        id: r.pasoEstudiante.pasoBeca.requisito.ID_paso,
        nombre: r.pasoEstudiante.pasoBeca.requisito.nombre,
        descripcion: r.pasoEstudiante.pasoBeca.requisito.descripcion,
      },

      beca: {
        id: r.pasoEstudiante.postulacion.beca.ID_beca,
        nombre: r.pasoEstudiante.postulacion.beca.nombre,
        tipo: r.pasoEstudiante.postulacion.beca.tipo,
        gestion: r.pasoEstudiante.postulacion.gestion,
      },

      estudiante: {
        id: r.pasoEstudiante.postulacion.estudiante.ID_estudiante,
        ci: r.pasoEstudiante.postulacion.estudiante.persona.ci,
        nombre: r.pasoEstudiante.postulacion.estudiante.persona.nombre,
        apellido_paterno:
          r.pasoEstudiante.postulacion.estudiante.persona.apellido_paterno,
        apellido_materno:
          r.pasoEstudiante.postulacion.estudiante.persona.apellido_materno,
      },
    });
    const esAbandonoDefinitivo = (r: any) =>
  r.pasoEstudiante.postulacion.estado === 'ABANDONADO' &&
  r.pasoEstudiante.postulacion.abandono_recuperable === false;
    return {
      pendientesRecepcion: rows
  .filter(
    (r) =>
      r.activo_revision &&
      !r.es_entrega_final &&
      r.estado === 'PENDIENTE_LEGALIZACION' &&
      !esAbandonoDefinitivo(r),
  )
  .map(mapRow),

      enRevision: rows
        .filter(
          (r) =>
            r.activo_revision &&
            !r.es_entrega_final &&
            r.estado === 'EN_REVISION',
        )
        .map(mapRow),

      entregaFinal: rows
        .filter(
          (r) =>
            r.activo_revision &&
            r.es_entrega_final &&
            r.estado === 'LEGALIZADO',
        )
        .map(mapRow),

      revisados: rows
        .filter(
            (r) =>
            !r.activo_revision &&
            ['LEGALIZADO', 'RECHAZADO', 'ENTREGADO'].includes(r.estado),
        )
        .map(mapRow),
    };
  }

  async pasarARevision(id: number, usuarioId: number) {
    const item = await this.obtenerItem(id, usuarioId);

    if (item.es_entrega_final) {
      throw new BadRequestException(
        'Este registro corresponde a entrega final.',
      );
    }

    if (item.estado !== 'PENDIENTE_LEGALIZACION') {
      throw new BadRequestException(
        'Solo se puede pasar a revisión un documento pendiente de entrega física.',
      );
    }

    if (!item.activo_revision) {
      throw new BadRequestException('Este documento aún no está habilitado.');
    }

    return this.prisma.$transaction(async (tx) => {
  const actualizado = await tx.paso_legalizacion_estudiante.update({
    where: { id },
    data: {
      estado: 'EN_REVISION',
      fecha_inicio: new Date(),
    },
  });

  await tx.paso_estudiante.update({
    where: {
      ID_paso_estudiante: item.pasoEstudianteId,
    },
    data: {
      estado_revision: 'EN_REVISION',
      fecha_revision: new Date(),
    },
  });
  await tx.audit_log.create({
  data: {
    tabla: 'paso_legalizacion_estudiante',
    registroId: String(id),
    accion: 'PASAR_A_REVISION_LEGALIZACION',
    usuarioId,
    detalle: 'Usuario pasó el requisito legalizable a revisión.',
    antes: { estado: item.estado },
    despues: { estado: 'EN_REVISION' },
  },
});
  return actualizado;
});
  }
  async legalizar(
    id: number,
    usuarioId: number,
    dto: { observacion?: string },
  ) {
    const item = await this.obtenerItem(id, usuarioId);

    if (item.es_entrega_final) {
      throw new BadRequestException(
        'Para entrega final use la opción ENTREGAR.',
      );
    }

    if (item.estado !== 'EN_REVISION') {
      throw new BadRequestException(
        'Solo se puede legalizar un documento en revisión.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.paso_legalizacion_estudiante.update({
        where: { id },
        data: {
          estado: 'LEGALIZADO',
          fecha_revision: new Date(),
          observacion: dto.observacion,
          activo_revision: false,
        },
      });

      const siguiente = await tx.paso_legalizacion_estudiante.findFirst({
        where: {
          pasoEstudianteId: item.pasoEstudianteId,
          orden: { gt: item.orden },
          es_entrega_final: false,
        },
        orderBy: { orden: 'asc' },
      });

      if (siguiente) {
        await tx.paso_legalizacion_estudiante.update({
          where: { id: siguiente.id },
          data: {
            estado: 'EN_REVISION',
            activo_revision: true,
            fecha_inicio: new Date(),
          },
        });

        await tx.paso_estudiante.update({
          where: { ID_paso_estudiante: item.pasoEstudianteId },
          data: {
            estado_revision: 'EN_REVISION',
            fecha_revision: new Date(),
          },
        });
      } else {
        const requisito =
          item.pasoEstudiante.pasoBeca.requisito;

        if (!requisito.entrega_final_usuarioId) {
          throw new BadRequestException(
            'Este requisito no tiene encargado final de entrega configurado.',
          );
        }

        await tx.paso_legalizacion_estudiante.create({
          data: {
            pasoEstudianteId: item.pasoEstudianteId,
            usuarioId: requisito.entrega_final_usuarioId,
            orden: item.orden + 1,
            estado: 'LEGALIZADO',
            activo_revision: true,
            es_entrega_final: true,
            fecha_inicio: new Date(),
          },
        });

        await tx.paso_estudiante.update({
          where: { ID_paso_estudiante: item.pasoEstudianteId },
          data: {
            estado_revision: 'EN_REVISION',
            fecha_revision: new Date(),
          },
        });
      }

      await tx.audit_log.create({
        data: {
          tabla: 'paso_legalizacion_estudiante',
          registroId: String(id),
          accion: 'LEGALIZAR_REQUISITO',
          usuarioId,
          detalle: 'Usuario legalizó un requisito presencial.',
          antes: { estado: item.estado },
          despues: { estado: 'LEGALIZADO' },
        },
      });

      return actualizado;
    });
  }

  async rechazar(
  id: number,
  usuarioId: number,
  dto: { observacion?: string },
) {
  const item = await this.obtenerItem(id, usuarioId);

  if (!['EN_REVISION', 'LEGALIZADO'].includes(item.estado)) {
    throw new BadRequestException(
      'Solo se puede rechazar un documento en revisión o entrega final.',
    );
  }

  const usuarioEstudiante =
    item.pasoEstudiante.postulacion.estudiante.persona.usuario?.ID_usuario;

  const area = this.obtenerAreaUsuario(item.usuario);
  const encargado =
    this.obtenerNombreUsuario(item.usuario) || 'el encargado correspondiente';

  const mensaje = `Su requisito "${item.pasoEstudiante.pasoBeca.requisito.nombre}" fue rechazado. Debe apersonarse a ${area} con el encargado ${encargado} para solucionar la observación y volver a iniciar la legalización presencial.`;
  const postulacionAbandonadaDefinitiva =
  item.pasoEstudiante.postulacion.estado === 'ABANDONADO' &&
  item.pasoEstudiante.postulacion.abandono_recuperable === false;
  const actualizado = await this.prisma.$transaction(async (tx) => {
    await tx.paso_legalizacion_estudiante.updateMany({
      where: { pasoEstudianteId: item.pasoEstudianteId },
      data: { activo_revision: false },
    });

    await tx.paso_legalizacion_estudiante.deleteMany({
      where: {
        pasoEstudianteId: item.pasoEstudianteId,
        id: { not: id },
        estado: 'PENDIENTE_LEGALIZACION',
      },
    });

    const result = await tx.paso_legalizacion_estudiante.update({
      where: { id },
      data: {
        estado: 'RECHAZADO',
        fecha_revision: new Date(),
        observacion: dto.observacion,
        activo_revision: false,
      },
    });
if (!postulacionAbandonadaDefinitiva) {
  const flujoBase = await tx.requisito_legalizacion_flujo.findMany({
    where: {
      requisitoId: item.pasoEstudiante.pasoBeca.requisito.ID_paso,
      activo: true,
    },
    orderBy: { orden: 'asc' },
  });

  const ultimoOrden = await tx.paso_legalizacion_estudiante.aggregate({
    where: { pasoEstudianteId: item.pasoEstudianteId },
    _max: { orden: true },
  });

  const ordenBase = ultimoOrden._max.orden ?? 0;

  if (flujoBase.length > 0) {
    await tx.paso_legalizacion_estudiante.createMany({
      data: flujoBase.map((f, index) => ({
        pasoEstudianteId: item.pasoEstudianteId,
        usuarioId: f.usuarioId,
        orden: ordenBase + index + 1,
        estado: 'PENDIENTE_LEGALIZACION',
        activo_revision: index === 0,
        es_entrega_final: false,
        fecha_inicio: index === 0 ? new Date() : null,
      })),
    });
  }

  await tx.paso_estudiante.update({
    where: { ID_paso_estudiante: item.pasoEstudianteId },
    data: {
      estado_revision: 'PENDIENTE_LEGALIZACION',
      completado: false,
      fecha_completado: null,
      observacion_revision: dto.observacion,
      fecha_revision: new Date(),
    },
  });
} else {
  await tx.paso_estudiante.update({
    where: { ID_paso_estudiante: item.pasoEstudianteId },
    data: {
      estado_revision: 'RECHAZADO',
      completado: false,
      fecha_completado: null,
      observacion_revision:
        dto.observacion ||
        'Requisito rechazado después del abandono definitivo de la postulación.',
      fecha_revision: new Date(),
    },
  });
}

    await tx.audit_log.create({
      data: {
        tabla: 'paso_legalizacion_estudiante',
        registroId: String(id),
        accion: 'RECHAZAR_REQUISITO_LEGALIZACION',
        usuarioId,
        detalle: postulacionAbandonadaDefinitiva
          ? 'Usuario rechazó un requisito de una postulación abandonada definitivamente. No se reactivó el flujo de legalización.'
          : 'Usuario rechazó un requisito. El flujo vuelve a pendiente de entrega física.',
        antes: { estado: item.estado },
        despues: {
          estado: postulacionAbandonadaDefinitiva
            ? 'RECHAZADO'
            : 'PENDIENTE_LEGALIZACION',
        },
      },
    });

    if (usuarioEstudiante && !postulacionAbandonadaDefinitiva) {
    await tx.notificacionSistema.create({
        data: {
          userId: usuarioEstudiante,
          titulo: 'Requisito rechazado',
          mensaje,
          tipo: 'WARNING',
          url: `/becas-disponibles/${item.pasoEstudiante.postulacion.becaId}`,
        },
      });
    }

    return result;
  });

  if (usuarioEstudiante && !postulacionAbandonadaDefinitiva) {
    await this.notifications.sendToUser(
      usuarioEstudiante,
      'Requisito rechazado',
      mensaje,
      ['email', 'whatsapp'],
    );
  }

  return actualizado;
}

async entregar(
  id: number,
  usuarioId: number,
  dto: { observacion?: string },
) {
  const item = await this.obtenerItem(id, usuarioId);

  if (!item.es_entrega_final) {
    throw new BadRequestException(
      'Este registro no corresponde a entrega final.',
    );
  }

  if (item.estado !== 'LEGALIZADO') {
    throw new BadRequestException(
      'Solo se puede entregar un requisito ya legalizado.',
    );
  }

  const usuarioEstudiante =
    item.pasoEstudiante.postulacion.estudiante.persona.usuario?.ID_usuario;

  const area = this.obtenerAreaUsuario(item.usuario);
  const encargado =
    this.obtenerNombreUsuario(item.usuario) || 'el encargado correspondiente';

  const mensaje = `Su requisito "${item.pasoEstudiante.pasoBeca.requisito.nombre}" fue legalizado. Pase a recoger en ${area} con el encargado ${encargado}.`;

  const actualizado = await this.prisma.$transaction(async (tx) => {
    const result = await tx.paso_legalizacion_estudiante.update({
      where: { id },
      data: {
        estado: 'ENTREGADO',
        fecha_revision: new Date(),
        observacion: dto.observacion,
        activo_revision: false,
      },
    });

    await tx.paso_estudiante.update({
      where: {
        ID_paso_estudiante: item.pasoEstudianteId,
      },
      data: {
        estado_revision: 'LEGALIZADO',
        completado: true,
        fecha_completado: new Date(),
        fecha_revision: new Date(),
        observacion_revision: dto.observacion,
      },
    });

    await tx.audit_log.create({
      data: {
        tabla: 'paso_legalizacion_estudiante',
        registroId: String(id),
        accion: 'ENTREGAR_REQUISITO_LEGALIZADO',
        usuarioId,
        detalle: 'Usuario entregó el requisito legalizado al estudiante.',
        antes: { estado: item.estado },
        despues: { estado: 'ENTREGADO' },
      },
    });

    if (usuarioEstudiante) {
      await tx.notificacionSistema.create({
        data: {
          userId: usuarioEstudiante,
          titulo: 'Requisito legalizado',
          mensaje,
          tipo: 'SUCCESS',
          url: `/becas-disponibles/${item.pasoEstudiante.postulacion.becaId}`,
        },
      });
    }

    return result;
  });

  // IMPORTANTE: correo y WhatsApp FUERA de la transacción
  if (usuarioEstudiante) {
    await this.notifications.sendToUser(
      usuarioEstudiante,
      'Requisito legalizado',
      mensaje,
      ['email', 'whatsapp'],
    );
  }

  return actualizado;
}
  private obtenerAreaUsuario(usuario: any) {
  const roles =
    usuario?.grupo_usuario?.map((g: any) =>
      String(g.grupo_rol?.nombre || '').toLowerCase(),
    ) ?? [];

  if (roles.includes('admin')) return 'CENTRO DE ESTUDIANTES';
  if (roles.includes('director')) return 'DIRECCIÓN';
  if (roles.includes('kardex')) return 'KARDEX';

  return 'la oficina correspondiente';
}

private obtenerNombreUsuario(usuario: any) {
  return [
    usuario?.persona?.nombre,
    usuario?.persona?.apellido_paterno,
    usuario?.persona?.apellido_materno,
  ]
    .filter(Boolean)
    .join(' ');
}
  private async obtenerItem(id: number, usuarioId: number) {
    const item =
      await this.prisma.paso_legalizacion_estudiante.findFirst({
        where: {
          id,
          usuarioId,
        },
        include: {
          usuario: {
            include: {
                persona: true,
                grupo_usuario: {
                include: {
                    grupo_rol: true,
                },
                },
            },
            },
          pasoEstudiante: {
            include: {
              postulacion: {
                include: {
                  estudiante: {
                    include: {
                      persona: {
                        include: { usuario: true },
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
          },
        },
      });

    if (!item) {
      throw new NotFoundException(
        'Registro de legalización no encontrado.',
      );
    }

    return item;
  }
}