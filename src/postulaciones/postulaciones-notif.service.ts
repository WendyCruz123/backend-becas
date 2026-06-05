import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificarLoteDto, TipoNotificacionPostulacion } from './dto/notificar-lote.dto';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class PostulacionesNotifService {
  private readonly log = new Logger('PostulacionesNotifService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async notificarLote(dto: NotificarLoteDto, usuarioId: number) {
    const {
      becaId,
      gestion,
      tipo,
      idsSeleccionados,
      mensajePersonalizado,
      oficinaIdObservacion,
    } = dto;
    if (!idsSeleccionados?.length)
      throw new BadRequestException('Debe seleccionar al menos una postulación.');

    //  Buscar postulaciones
    const postulaciones = await this.prisma.postulacion.findMany({
      where: { becaId, gestion },
      include: {
        estudiante: {
          include: {
            persona: { include: { usuario: true } },
          },
        },
        beca: true,
      },
    });

    if (postulaciones.length === 0)
      throw new BadRequestException('No hay postulaciones registradas para esa beca y gestión.');

    //  Filtrar seleccionadas
    const seleccionadas = postulaciones.filter((p) =>
      idsSeleccionados.includes(String(p.ID_postulacion)),
    );
    const noSeleccionadas = postulaciones.filter(
      (p) => !idsSeleccionados.includes(String(p.ID_postulacion)),
    );

    if (seleccionadas.length === 0) {
      throw new BadRequestException(
        'No se encontraron postulaciones seleccionadas para notificar.',
      );
    }
    //  Tipos de notificación
    switch (tipo) {
      case TipoNotificacionPostulacion.OBSERVACION: {
        if (!oficinaIdObservacion) {
          throw new BadRequestException(
            'Debe seleccionar la oficina donde el estudiante debe apersonarse.',
          );
        }

        const oficina = await this.prisma.oficina.findUnique({
          where: { ID_oficina: oficinaIdObservacion },
          select: {
            ID_oficina: true,
            nombre: true,
            horario_atencion: true,
          },
        });

        if (!oficina) {
          throw new BadRequestException('La oficina seleccionada no existe.');
        }

        await this.actualizarObservacion(
  seleccionadas,
  noSeleccionadas,
  usuarioId,
  mensajePersonalizado,
  oficina,
);
        return this.enviarMensajesObservacion(
          seleccionadas,
          mensajePersonalizado,
          oficina,
        );
      }
      case TipoNotificacionPostulacion.ESTADO: {
        if (dto.subTipo === 'REPROBADO') {
          await this.actualizarReprobado(seleccionadas, usuarioId);

          return this.enviarNotificacionSistemaReprobado(
            seleccionadas,
            dto.nota,
            dto.descripcion,
          );
        }

        await this.actualizarEstadoFinal(seleccionadas, usuarioId);
        return this.enviarMensajesEstadoFinal(
          seleccionadas,
          'APROBADO',
          mensajePersonalizado,
        );
      }
      case TipoNotificacionPostulacion.PERSONALIZADO:
        return this.enviarMensajesPersonalizados(seleccionadas, mensajePersonalizado);

      default:
        throw new BadRequestException(`Tipo de notificación no reconocido: ${tipo}`);
    }
  }

  // 🔹 Actualizar campos según tipo
private async actualizarObservacion(
  seleccionadas: any[],
  noSeleccionadas: any[],
  usuarioId: number,
  mensajePersonalizado?: string,
  oficina?: {
    ID_oficina: number;
    nombre: string;
    horario_atencion?: string | null;
  },
) {
  await this.prisma.$transaction(async (tx) => {
    for (const p of seleccionadas) {
      const persona = p.estudiante?.persona;

      const mensaje =
        mensajePersonalizado ||
        `Estimado/a ${persona?.nombre || ''}, su postulación a la beca "${p.beca.nombre}" fue OBSERVADA. Por favor apersónese a la oficina "${oficina?.nombre}".${
          oficina?.horario_atencion
            ? ` Horario de atención: ${oficina.horario_atencion}.`
            : ''
        }`;

      await tx.postulacion.update({
        where: { ID_postulacion: p.ID_postulacion },
        data: {
          estado_observacion: 'OBSERVADO',
          observacion: mensaje,
        },
      });

      await tx.audit_log.create({
        data: {
          tabla: 'postulacion',
          registroId: String(p.ID_postulacion),
          accion: 'POSTULACION_OBSERVADA',
          usuarioId,
          detalle: mensaje,
          antes: {
            estado_observacion: p.estado_observacion,
            observacion: p.observacion,
          },
          despues: {
            estado_observacion: 'OBSERVADO',
            observacion: mensaje,
            oficinaId: oficina?.ID_oficina ?? null,
            oficinaNombre: oficina?.nombre ?? null,
            horario_atencion: oficina?.horario_atencion ?? null,
          },
        },
      });
    }

    if (noSeleccionadas.length > 0) {
      await tx.postulacion.updateMany({
        where: {
          ID_postulacion: {
            in: noSeleccionadas.map((p) => p.ID_postulacion),
          },
        },
        data: {
          estado_observacion: 'NO OBSERVADO',
        },
      });
    }
  });
}

private async actualizarEstadoFinal(seleccionadas: any[], usuarioId: number) {
  await this.prisma.$transaction(async (tx) => {
    for (const p of seleccionadas) {
      await tx.postulacion.update({
        where: { ID_postulacion: p.ID_postulacion },
        data: {
          estado: 'APROBADO',
          estado_observacion: 'NO OBSERVADO',
          observacion: 'Postulación aprobada por revisión administrativa.',
        },
      });

      await tx.audit_log.create({
        data: {
          tabla: 'postulacion',
          registroId: String(p.ID_postulacion),
          accion: 'POSTULACION_APROBADA_ADMIN',
          usuarioId,
          detalle: 'Administrador aprobó la postulación por revisión administrativa.',
          antes: {
            estado: p.estado,
            estado_observacion: p.estado_observacion,
            observacion: p.observacion,
          },
          despues: {
            estado: 'APROBADO',
            estado_observacion: 'NO OBSERVADO',
            observacion: 'Postulación aprobada por revisión administrativa.',
          },
        },
      });
    }
  });
}

private async actualizarReprobado(seleccionadas: any[], usuarioId: number) {
  await this.prisma.$transaction(async (tx) => {
    for (const p of seleccionadas) {
      await tx.postulacion.update({
        where: { ID_postulacion: p.ID_postulacion },
        data: {
          estado: 'REPROBADO',
          estado_observacion: 'REPROBADO',
          observacion: 'Postulación reprobada por revisión administrativa.',
        },
      });

      await tx.audit_log.create({
        data: {
          tabla: 'postulacion',
          registroId: String(p.ID_postulacion),
          accion: 'POSTULACION_REPROBADA_ADMIN',
          usuarioId,
          detalle: 'Administrador reprobó la postulación por revisión administrativa.',
          antes: {
            estado: p.estado,
            estado_observacion: p.estado_observacion,
            observacion: p.observacion,
          },
          despues: {
            estado: 'REPROBADO',
            estado_observacion: 'REPROBADO',
            observacion: 'Postulación reprobada por revisión administrativa.',
          },
        },
      });
    }
  });
}

  private async enviarNotificacionSistemaReprobado(
    seleccionadas: any[],
    nota?: number,
    descripcion?: string,
  ) {
    let notificados = 0;
    let fallaron = 0;

    for (const p of seleccionadas) {
      const persona = p.estudiante?.persona;
      const usuarioId = persona?.usuario?.ID_usuario;

      if (!usuarioId) {
        fallaron++;
        continue;
      }

      const partes: string[] = [];

      partes.push(
        `Su postulación a la beca "${p.beca.nombre}" fue reprobada.`,
      );

      if (nota !== undefined && nota !== null) {
        partes.push(`Nota: ${nota}.`);
      }

      if (descripcion?.trim()) {
        partes.push(descripcion.trim());
      }

      const mensaje = partes.join(' ');

      await this.prisma.notificacionSistema.create({
        data: {
          userId: usuarioId,
          titulo: 'Postulación reprobada',
          mensaje,
          tipo: 'ERROR',
          url: `/becas-disponibles/${p.beca.ID_beca}`,
        },
      });

      notificados++;
    }

    return {
      tipo: 'REPROBADO',
      estado: 'REPROBADO',
      seleccionados: seleccionadas.length,
      notificados,
      fallaron,
      mensaje:
        'Postulaciones reprobadas. La notificación fue enviada solo al sistema.',
    };
  }

  private getErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  // 🔹 Envío con delay anti-spam (para WhatsApp)
  private async enviarMensajesObservacion(
  seleccionadas: any[],
  mensajePersonalizado?: string,
  oficina?: {
    ID_oficina: number;
    nombre: string;
    horario_atencion?: string | null;
  },
) {
    let notificados = 0;
    let fallaron = 0;
    const delay = 1200;

    for (const p of seleccionadas) {
      const persona = p.estudiante?.persona;
      const usuarioId = persona?.usuario?.ID_usuario;

      if (!usuarioId) {fallaron++;
        this.log.warn(`No se encontró usuario asociado para ${persona?.nombre ?? 'sin nombre'}`,); continue;}
      
      const mensaje =
        mensajePersonalizado ||
        `Estimado/a ${persona.nombre}, su postulación a la beca "${p.beca.nombre}" fue OBSERVADA. Por favor apersónese a la oficina "${oficina?.nombre}".${
          oficina?.horario_atencion
            ? ` Horario de atención: ${oficina.horario_atencion}.`
            : ''
        }`;

      try {
        const result = await this.notifications.sendToUser(
          usuarioId,
          'Postulación Observada',
          mensaje,
          ['email', 'whatsapp'],
        );

        if (result.ok) {

      await this.prisma.notificacionSistema.create({
        data: {
          userId: usuarioId,
          titulo: 'Postulación observada',
          mensaje,
          tipo: 'WARNING',
          url: `/becas-disponibles/${p.beca.ID_beca}`,
        },
        });

        notificados++;

        this.log.log(`Observación enviada a ${persona.nombre}`);
      } else {fallaron++;
          this.log.warn(`No se pudo enviar por ningún canal a ${persona.nombre}`,);}

      } catch (err: unknown) {
        fallaron++;
        this.log.error(`Error al notificar a ${persona.nombre}: ${this.getErrorMessage(err)}`,);}


      await new Promise((r) => setTimeout(r, delay));
    }

    return {
      tipo: 'OBSERVACION',
      seleccionados: seleccionadas.length,
      notificados,
      fallaron,
      mensaje: 'Notificaciones de observación procesadas correctamente.',
    };
  }

    // 🔹 Enviar SOLO a los APROBADOS (no notifica reprobados)
  private async enviarMensajesEstadoFinal(
    seleccionadas: any[],
    estado: 'APROBADO' | 'REPROBADO',
    mensajePersonalizado?: string,
  ) {
    // 🔸 Filtrar solo los aprobados (ignorar reprobados)
    const aprobados = seleccionadas.filter((p) => estado === 'APROBADO');
    if (aprobados.length === 0) {
      this.log.warn('No hay postulaciones aprobadas para notificar.');
      return {
        tipo: 'ESTADO_FINAL',
        seleccionados: 0,
        notificados: 0,
        fallaron: 0,
        estado: 'APROBADO',
        mensaje: 'No se enviaron mensajes porque no hubo aprobados.',
      };
    }

    let notificados = 0; let fallaron = 0; const delay = 1200; // ⏱ 1.2 segundos entre mensajes

    const subject = 'Resultado de Beca: Aprobado';
    const baseMessage = mensajePersonalizado || '¡Felicitaciones {nombre}! Tu postulación a la beca fue aprobada con éxito. 🎓';

    for (const p of aprobados) {
      const persona = p.estudiante?.persona;
      const usuarioId = persona?.usuario?.ID_usuario;

      if (!usuarioId) { fallaron++; this.log.warn(`No se encontró usuario asociado para ${persona?.nombre ?? 'sin nombre'}`,);
        continue;}

      const mensaje = baseMessage.replace('{nombre}', persona.nombre || '');

      try {
        const result = await this.notifications.sendToUser(
          usuarioId, subject, mensaje,['email', 'whatsapp'],
        );

        if (result.ok) {

          await this.prisma.notificacionSistema.create({
            data: {
              userId: usuarioId,
              titulo: 'Postulación aprobada',
              mensaje,
              tipo: 'SUCCESS',
              url: `/becas-disponibles/${p.beca.ID_beca}`,
            },
          });

          notificados++;

          this.log.log(`Mensaje enviado a ${persona.nombre}`);
        } else {
          fallaron++;
          this.log.warn(`No se pudo enviar por ningún canal a ${persona.nombre}`,); }
      } catch (err: unknown) {
        fallaron++;
        this.log.error(`Error al notificar a ${persona.nombre}: ${this.getErrorMessage(err)}`,);}


      await new Promise((r) => setTimeout(r, delay));
    }

    return {
      tipo: 'ESTADO_FINAL',
      estado: 'APROBADO',
      seleccionados: aprobados.length,
      notificados,
      fallaron,
      mensaje: 'Notificaciones de aprobación procesadas correctamente.',
    };
  }

  // 🔹 Envío PERSONALIZADO: solo mensaje, sin cambiar estado
  private async enviarMensajesPersonalizados(seleccionadas: any[], mensajePersonalizado?: string) {
    if (!mensajePersonalizado) throw new BadRequestException('Debe escribir un mensaje personalizado.');

    let notificados = 0;
    let fallaron = 0;
    const delay = 1200;

    for (const p of seleccionadas) {
      const persona = p.estudiante?.persona;
      const usuarioId = persona?.usuario?.ID_usuario;

     if (!usuarioId) {
        fallaron++;
        this.log.warn( `No se encontró usuario asociado para ${persona?.nombre ?? 'sin nombre'}`,);
        continue; }

      try {
        const result = await this.notifications.sendToUser(
          usuarioId,
          'Mensaje Institucional',
          mensajePersonalizado,
          ['email', 'whatsapp'],
        );

        if (result.ok) {

            await this.prisma.notificacionSistema.create({
              data: {
                userId: usuarioId,
                titulo: 'Mensaje institucional',
                mensaje: mensajePersonalizado,
                tipo: 'INFO',
                url: '/dashboard',
              },
            });

            notificados++;

            this.log.log(`Mensaje personalizado enviado a ${persona.nombre}`);
          } else {
          fallaron++;
          this.log.warn( `No se pudo enviar por ningún canal a ${persona.nombre}`,);}
      } catch (err: unknown) {
        fallaron++;
        this.log.error(`Error al enviar mensaje a ${persona.nombre}: ${this.getErrorMessage(err)}`, );}

      await new Promise((r) => setTimeout(r, delay));
    }

    return {
      tipo: 'PERSONALIZADO',
      seleccionados: seleccionadas.length,
      notificados,
      fallaron,
      mensaje: 'Mensajes personalizados procesados correctamente.',
    };
  }
  async notificarResultadoEtapa(params: {
  usuarioId: number;
  nombreEtapa: string;
  aprobado: boolean;
  nota?: number;
  fecha?: string;
  descripcion?: string;
  codigoSeguimiento?: string | null;
  oficinaRutaId?: number | null;
}) {
  const {
    usuarioId,
    nombreEtapa,
    aprobado,
    nota,
    fecha,
    descripcion,
    codigoSeguimiento,
    oficinaRutaId,
  } = params;

  // 🔹 Buscar oficina
  let oficina: {
    nombre: string;
    horario_atencion?: string | null;
  } | null = null;

  if (oficinaRutaId) {
    oficina = await this.prisma.oficina.findUnique({
      where: {
        ID_oficina: oficinaRutaId,
      },
      select: {
        nombre: true,
        horario_atencion: true,
      },
    });
  }

  const titulo = aprobado
    ? `Etapa aprobada: ${nombreEtapa}`
    : `Etapa reprobada: ${nombreEtapa}`;

  const partes: string[] = [];

  partes.push(
    aprobado
      ? `Usted aprobó la etapa "${nombreEtapa}".`
      : `Usted reprobó la etapa "${nombreEtapa}".`,
  );

  if (nota !== undefined && nota !== null) {
    partes.push(`Nota obtenida: ${nota}.`);
  }

if (aprobado && fecha) {
  partes.push(
    `Fecha programada: ${new Date(fecha).toLocaleDateString('es-BO')}.`,
  );
}

if (aprobado && descripcion) {
  partes.push(descripcion);
}

// 🔹 Oficina
if (aprobado && oficina) {
  partes.push(
    `Debe apersonarse a la oficina "${oficina.nombre}".`,
  );

  if (oficina.horario_atencion) {
    partes.push(
      `Horario de atención: ${oficina.horario_atencion}.`,
    );
  }

  partes.push(
    'Ingrese al sistema para visualizar el recorrido virtual 360°.',
  );
}

  const mensaje = partes.join(' ');

  // 🔔 Notificación sistema
  await this.prisma.notificacionSistema.create({
    data: {
      userId: usuarioId,
      titulo,
      mensaje,
      tipo: aprobado ? 'SUCCESS' : 'WARNING',

      url: codigoSeguimiento
        ? `/seguimiento?codigo=${codigoSeguimiento}`
        : '/seguimiento',
    },
  });

  // 📧📱 Email + WhatsApp
  await this.notifications.sendToUser(
    usuarioId,
    titulo,
    mensaje,
    ['email', 'whatsapp'],
  );

  return {
    ok: true,
  };
}
  async notificarResultadoDocumentacionEtapa(params: {
    usuarioId: number;
    nombreEtapa: string;
    fecha?: string;
    descripcion?: string;
    codigoSeguimiento?: string | null;
    oficinaRutaId?: number | null;
    nota?: number;
    textoExtra?: string;
  }) {
  const {
    usuarioId,
    nombreEtapa,
    fecha,
    descripcion,
    codigoSeguimiento,
    oficinaRutaId,
    nota,
    textoExtra,
  } = params;

  let oficina: {
    nombre: string;
    horario_atencion?: string | null;
  } | null = null;

  if (oficinaRutaId) {
    oficina = await this.prisma.oficina.findUnique({
      where: { ID_oficina: oficinaRutaId },
      select: {
        nombre: true,
        horario_atencion: true,
      },
    });
  }

  const titulo = `Documentación aprobada`;

  const partes: string[] = [];

  partes.push(
    `Su documentación fue aprobada. Se habilitó la etapa "${nombreEtapa}".`,
  );

  if (fecha) {
    partes.push(
      `Fecha programada: ${new Date(fecha).toLocaleDateString('es-BO')}.`,
    );
  }

  if (descripcion) {
    partes.push(descripcion);
  }

  if (oficina) {
    partes.push(`Debe apersonarse a la oficina "${oficina.nombre}".`);

    if (oficina.horario_atencion) {
      partes.push(`Horario de atención: ${oficina.horario_atencion}.`);
    }

    partes.push(
      'Ingrese al sistema para visualizar el recorrido virtual 360°.',
    );
  }
  if (nota !== undefined && nota !== null) {
  partes.push(`Nota asignada: ${nota}.`);
}

if (textoExtra) {
  partes.push(textoExtra);
}

  const mensaje = partes.join(' ');

  await this.prisma.notificacionSistema.create({
    data: {
      userId: usuarioId,
      titulo,
      mensaje,
      tipo: 'SUCCESS',
      url: codigoSeguimiento
        ? `/seguimiento?codigo=${codigoSeguimiento}`
        : '/seguimiento',
    },
  });

  await this.notifications.sendToUser(
    usuarioId,
    titulo,
    mensaje,
    ['email', 'whatsapp'],
  );

  return { ok: true };
}
}
