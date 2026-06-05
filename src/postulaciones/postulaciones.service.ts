import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostulacionDto } from './dto/create-postulacion.dto';
import { MarcarPasoDto } from './dto/marcar-paso.dto';
import { Prisma } from '@prisma/client';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PostulacionesNotifService } from './postulaciones-notif.service';

@Injectable()
export class PostulacionesService {
  constructor(
  private prisma: PrismaService,
  private readonly notifications: NotificationsService,
  private readonly postulacionesNotif: PostulacionesNotifService,
) {}


// 🟢 Empezar trámite 
async empezarTramite(dto: { becaId: number; gestion: string; usuarioId: number }) {
  const { becaId, gestion, usuarioId } = dto;

  // 🔹 1. Obtener usuario y su persona vinculada
  const usuario = await this.prisma.usuario.findUnique({
    where: { ID_usuario: usuarioId },
    include: { persona: true },
  });

  if (!usuario?.persona) {
    throw new BadRequestException('El usuario no tiene persona asociada.');
  }

  // 🔹 2. Buscar registro académico del estudiante
  const estudiante = await this.prisma.estudiante.findFirst({
    where: { personaId: usuario.persona.ID_persona },
  });

  if (!estudiante) {
    throw new BadRequestException(
      'No cuenta con datos académicos registrados. Solicite al administrador la actualización de su información.'
    );
  }

  // 🔹 3. Validar si cumple requisitos de postulación
  const validacion = this.validarElegibilidad(estudiante);
  // const validacion = this.validarElegibilidad(estudiante, Number(gestion));

  if (!validacion.ok) {
    throw new BadRequestException(validacion.message);
  }
  // 🔹 Si aplica para excelencia, se incluye el mensaje de recomendación
const mensajeExtra = validacion.tipo === 'EXCELENCIA' ? validacion.message : undefined;
   // 🔹 4. Verificar que la beca exista
  const beca = await this.prisma.beca.findUnique({
    where: { ID_beca: becaId },
  });

  if (!beca) {
    throw new NotFoundException('Beca no encontrada.');
  }

  // 🔹 5. No permitir iniciar trámite si la convocatoria ya venció
  if (beca.fecha_fin) {
    const hoy = new Date();
    const fechaFin = new Date(beca.fecha_fin);

    if (hoy > fechaFin) {
      throw new BadRequestException(
        'La convocatoria ya finalizó. No puedes registrar un nuevo trámite.',
      );
    }
  }

  // 🔹 6. Si tiene un trámite abandonado recuperable en la misma beca, debe continuarlo
  const abandonadoMismaBeca = await this.prisma.postulacion.findFirst({
    where: {
      gestion,
      estudianteId: estudiante.ID_estudiante,
      becaId,
      estado: 'ABANDONADO',
      abandono_recuperable: true,
    },
  });

  if (abandonadoMismaBeca) {
    throw new BadRequestException(
      'Ya tienes un trámite abandonado con avance de legalización presencial en esta beca. Debes usar CONTINUAR TRÁMITE.',
    );
  }

  // 🔹 7. Si tiene otro trámite abandonado recuperable y registra otra beca,
  // se cierra definitivamente el anterior.
  const abandonadoRecuperableOtraBeca =
    await this.prisma.postulacion.findFirst({
      where: {
        gestion,
        estudianteId: estudiante.ID_estudiante,
        estado: 'ABANDONADO',
        abandono_recuperable: true,
        becaId: { not: becaId },
      },
    });

  if (abandonadoRecuperableOtraBeca) {
    await this.prisma.postulacion.update({
      where: {
        ID_postulacion: abandonadoRecuperableOtraBeca.ID_postulacion,
      },
      data: {
        abandono_recuperable: false,
        motivo_abandono:
          'Trámite cerrado definitivamente porque el estudiante inició una postulación en otra beca.',
        observacion:
          'El trámite abandonado recuperable fue cerrado definitivamente al iniciar otra beca.',
      },
    });

    await this.prisma.audit_log.create({
      data: {
        tabla: 'postulacion',
        registroId: abandonadoRecuperableOtraBeca.ID_postulacion,
        accion: 'CERRAR_ABANDONO_RECUPERABLE_POR_NUEVA_POSTULACION',
        usuarioId,
        detalle:
          'El estudiante inició otra postulación; se cerró definitivamente el trámite abandonado recuperable anterior.',
        antes: {
          estado: 'ABANDONADO',
          abandono_recuperable: true,
        },
        despues: {
          estado: 'ABANDONADO',
          abandono_recuperable: false,
        },
      },
    });
  }

  // 🔹 8. Evitar duplicados activos o aprobados
const periodoPostulacion = this.calcularPeriodoPostulacion();
// const periodoPostulacion = this.calcularPeriodoPostulacion(Number(gestion));

const bloqueoActivo = await this.prisma.postulacion.findFirst({
  where: {
    gestion,
    estudianteId: estudiante.ID_estudiante,
    estado: {
      in: [
        'EN_PROCESO',
        'PENDIENTE',
        'HABILITADO',
        'REMITIDO_A_DISBECT',
      ],
    },
  },
});

if (bloqueoActivo) {
  throw new BadRequestException(
    'Ya tienes una postulación activa en esta gestión. No puedes iniciar otra mientras siga en proceso administrativo.',
  );
}

const aprobadasGestion = await this.prisma.postulacion.findMany({
  where: {
    gestion,
    estudianteId: estudiante.ID_estudiante,
    estado: 'APROBADO',
  },
  include: {
    beca: {
      select: {
        periodo_bloqueo: true,
        nombre: true,
      },
    },
  },
});

const aprobadoBloqueante = aprobadasGestion.find((p) => {
  if (p.beca.periodo_bloqueo === 'ANUAL') return true;

  if (p.beca.periodo_bloqueo === 'SEMESTRAL') {
    if (!p.periodo_postulacion) return true;
    return p.periodo_postulacion === periodoPostulacion;
  }

  return true;
});

if (aprobadoBloqueante) {
  const nombreBeca = aprobadoBloqueante.beca.nombre;

  if (aprobadoBloqueante.beca.periodo_bloqueo === 'SEMESTRAL') {
    throw new BadRequestException(
      aprobadoBloqueante.periodo_postulacion
        ? `Ya tienes una beca aprobada en el semestre ${aprobadoBloqueante.periodo_postulacion}: "${nombreBeca}". Podrás postular nuevamente en otro semestre.`
        : `Ya tienes una beca aprobada en esta gestión: "${nombreBeca}". Como esa postulación no tiene periodo registrado, no puedes iniciar otra postulación en esta gestión.`,
    );
  }

  throw new BadRequestException(
    `Ya tienes una beca aprobada en esta gestión: "${nombreBeca}". No puedes postular a otra beca hasta la siguiente gestión.`,
  );
}


// 🔹 5. Crear una nueva postulación
const nueva = await this.prisma.$transaction(async (tx) => {
  const post = await tx.postulacion.create({
    data: {
      becaId,
      gestion,
      periodo_postulacion: periodoPostulacion,
      estado: 'EN_PROCESO',
      estado_observacion: 'NO OBSERVADO',
      estudianteId: estudiante.ID_estudiante,

      beca_nombre_historico: beca.nombre,
      beca_tipo_historico: beca.tipo,
      beca_fecha_inicio_historico: beca.fecha_inicio,
      beca_fecha_fin_historico: beca.fecha_fin,
      beca_historial_capturado: true,
    },
  });

  await this.crearPasosYLegalizacion(tx, post.ID_postulacion, becaId);

  return post;
});

  return {
  ok: true,
  message: mensajeExtra ?? 'Postulación iniciada correctamente',
  ID_postulacion: nueva.ID_postulacion,
};

}

// 🧠 Reglas de elegibilidad para postular a becas
private validarElegibilidad(e: any) {
  const anios = new Date().getFullYear() - e.año_ingreso;
// private validarElegibilidad(e: any, gestion: number) {
//   const anios = gestion - e.año_ingreso;

  // ✅ No puede postular si tiene 2 o más materias reprobadas
  if (e.numero_Materias_Reprobadas >= 3)
    return { ok: false, message: 'Usted sobrepasa la cantidad permitida de materias reprobadas para realizar una postulación.' };

  // ✅ No puede postular si lleva más de 7 años desde su ingreso
  if (anios < 1 || anios >= 7)
    return { ok: false, message: 'Usted no cumple con el tiempo académico establecido para realizar una postulación.' };

  // ✅ No puede postular si está en semestre 3 o menor
  if (e.semestre)
    return { ok: false, message: 'Usted no cumple con el nivel académico requerido para realizar una postulación.' };

  // ✅ Caso especial: Promedio alto → sugerencia, no restricción
  if (e.promedio >= 85) {
    return {
      ok: true,
      message: 'Usted puede postularse a la BECA EXCELENCIA.',
      tipo: 'EXCELENCIA',
    };
  }

  // ✅ Cumple requisitos generales
  return { ok: true };
}

async obtenerDetalle(id: string) {
  const post = await this.prisma.postulacion.findUnique({
    where: { ID_postulacion: id },
    include: {
      beca: true,
      estudiante: { include: { persona: true } },
      paso_estudiante: {
        include: {
          oficinaRuta: true,
          pasoBeca: {
            include: {
              requisito: true,
            },
          },
        },
        orderBy: [{ pasoBeca: { orden: 'asc' } }],
      },
    },
  });

  if (!post) throw new NotFoundException('Postulación no encontrada');
  return post;
}


async finalizarTramite(id: string, usuarioId?: number) {
  const postulacion = await this.prisma.postulacion.findUnique({
    where: { ID_postulacion: id },
    include: {
      estudiante: { include: { persona: true } },
      paso_estudiante: {
        include: {
          pasoBeca: {
            include: {
              requisito: true,
            },
          },
        },
      },
    },
  });

  if (!postulacion) {
    throw new NotFoundException('Postulación no encontrada');
  }

  if (usuarioId) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { ID_usuario: usuarioId },
      include: { persona: true },
    });

    if (usuario?.persona.ID_persona !== postulacion.estudiante.personaId) {
      throw new BadRequestException('No puedes finalizar una postulación ajena.');
    }
  }

  if (postulacion.estado !== 'EN_PROCESO') {
    throw new BadRequestException('Solo se puede finalizar un trámite en proceso.');
  }

  const pendienteKardex = postulacion.paso_estudiante.find(
  (p) =>
    p.pasoBeca.requisito.requiere_legalizacion &&
    ['PENDIENTE_LEGALIZACION', 'EN_REVISION'].includes(p.estado_revision),
  );

  if (pendienteKardex) {
  throw new BadRequestException(
    `No puedes finalizar el trámite. El requisito "${pendienteKardex.pasoBeca.requisito.nombre}" todavía no fue legalizado.`,
  );
}
  const rechazadoKardex = postulacion.paso_estudiante.find(
  (p) =>
    p.pasoBeca.requisito.requiere_legalizacion &&
    p.estado_revision === 'RECHAZADO',
);

  if (rechazadoKardex) {
  throw new BadRequestException(
    `No puedes finalizar el trámite. El requisito "${rechazadoKardex.pasoBeca.requisito.nombre}" fue rechazado. Debes regularizarlo.`,
  );
}

const legalizableNoLegalizado = postulacion.paso_estudiante.find(
  (p) =>
    p.pasoBeca.requisito.requiere_legalizacion &&
    p.estado_revision !== 'LEGALIZADO',
);

if (legalizableNoLegalizado) {
  throw new BadRequestException(
    `No puedes finalizar el trámite. El requisito "${legalizableNoLegalizado.pasoBeca.requisito.nombre}" debe estar legalizado.`,
  );
}

  const incompleto = postulacion.paso_estudiante.find(
  (p) =>
    p.pasoBeca.requisito.tipo_requisito !== 'ETAPA' &&
    !p.pasoBeca.requisito.requiere_legalizacion &&
    !p.completado,
);
  if (incompleto) {
    throw new BadRequestException(
      `No puedes finalizar el trámite. Aún falta completar el requisito "${incompleto.pasoBeca.requisito.nombre}".`,
    );
  }
  

  // 🔹 Generar código de seguimiento
  const codigo = `BEC-${new Date().getFullYear()}-${Math.random()
  // const codigo = `BEC-${postulacion.gestion}-${Math.random()

    .toString(36)
    .substring(2, 7)
    .toUpperCase()}`;


  // 🔹 Actualizar postulación
  const updated = await this.prisma.postulacion.update({
    where: { ID_postulacion: id },
    data: {
      estado: 'PENDIENTE',
      codigo_seguimiento: codigo,
    },
  });
  await this.registrarCambioEstadoPostulacion({
    postulacionId: id,
    usuarioId: usuarioId ?? null,
    accion: 'FINALIZAR_TRAMITE',
    detalle: 'El estudiante finalizó el trámite. La postulación pasó a PENDIENTE.',
    estadoAnterior: postulacion.estado,
    estadoNuevo: 'PENDIENTE',
    extraDespues: {
      codigo_seguimiento: codigo,
    },
  });

  return updated;
}
async resolverEtapa(
  dto: {
    pasoEstudianteId: number;
    resultado: 'APROBADO' | 'REPROBADO' | 'ABANDONADO';
    nota?: number;
    fecha?: string;
    descripcion?: string;
    textoExtra?: string;
    oficinaRutaId?: number;
  },
  usuarioId: number,
) {
  const paso = await this.prisma.paso_estudiante.findUnique({
    where: {
      ID_paso_estudiante: dto.pasoEstudianteId,
    },
    include: {
      postulacion: true,
      pasoBeca: {
        include: {
          requisito: {
            include: {
              encargados: true,
            },
          },
          beca: {
            include: {
              pasos: {
                include: {
                  requisito: true,
                },
                orderBy: [
                  { orden: 'asc' },
                  { ID_pasosBeca: 'asc' },
                ],
              },
            },
          },
        },
      },
    },
  });

  if (!paso) {
    throw new NotFoundException('Etapa no encontrada');
  }

  if (paso.pasoBeca.requisito.tipo_requisito !== 'ETAPA') {
    throw new BadRequestException(
      'Este requisito no es una etapa.',
    );
  }
  const encargadoAsignado = paso.pasoBeca.requisito.encargados.some(
  (e) => e.usuarioId === usuarioId,
  );

  if (!encargadoAsignado) {
    throw new BadRequestException(
      'No estás asignado como encargado de esta etapa.',
    );
  }

  if (paso.estado_etapa !== 'EN_REVISION') {
  throw new BadRequestException(
    'La etapa no se encuentra en revisión.',
  );
}

  const nuevoEstado = dto.resultado;

  const updated = await this.prisma.paso_estudiante.update({
  where: {
    ID_paso_estudiante: paso.ID_paso_estudiante,
  },
  data: {
    estado_etapa: nuevoEstado,
    nota_etapa: dto.nota,
    fecha_revision: new Date(),
  },
});
  await this.prisma.audit_log.create({
    data: {
      tabla: 'paso_estudiante',
      registroId: String(paso.ID_paso_estudiante),
      accion:
      dto.resultado === 'APROBADO'
        ? 'APROBAR_ETAPA'
        : dto.resultado === 'REPROBADO'
          ? 'REPROBAR_ETAPA'
          : 'ABANDONAR_ETAPA',
      usuarioId,
      detalle:
      dto.resultado === 'APROBADO'
        ? `Encargado aprobó la etapa ${paso.pasoBeca.requisito.nombre}`
        : dto.resultado === 'REPROBADO'
          ? `Encargado reprobó la etapa ${paso.pasoBeca.requisito.nombre}`
          : `Encargado marcó como abandonada la etapa ${paso.pasoBeca.requisito.nombre}`,
      antes: {
        estado_etapa: paso.estado_etapa,
        nota_etapa: paso.nota_etapa,
      },
      despues: {
        estado_etapa: dto.resultado,
        nota_etapa: dto.nota ?? null,
        fecha_etapa: dto.fecha ?? null,
        descripcion_etapa: dto.descripcion ?? null,
        oficinaRutaId: dto.oficinaRutaId ?? null,
      },
    },
  });
  // 🔴 Si reprueba → termina todo
  if (dto.resultado === 'REPROBADO' || dto.resultado === 'ABANDONADO') {
    await this.prisma.postulacion.update({
      where: {
        ID_postulacion: paso.postulacionId,
      },
      data: {
        estado: dto.resultado,
        ...(dto.resultado === 'ABANDONADO'
          ? {
              abandono_recuperable: false,
              estado_antes_abandono: null,
              fecha_abandono: new Date(),
              motivo_abandono:
                'Postulación abandonada administrativamente por etapa.',
              observacion:
                'El encargado marcó la etapa como abandonada. Este abandono es final administrativo.',
            }
          : {}),
      },
    });
    await this.registrarCambioEstadoPostulacion({
      postulacionId: paso.postulacionId,
      usuarioId,
      accion:
        dto.resultado === 'REPROBADO'
          ? 'POSTULACION_REPROBADA_POR_ETAPA'
          : 'POSTULACION_ABANDONADA_POR_ETAPA',
      detalle:
        dto.resultado === 'REPROBADO'
          ? `La postulación fue reprobada por la etapa "${paso.pasoBeca.requisito.nombre}".`
          : `La postulación fue abandonada por la etapa "${paso.pasoBeca.requisito.nombre}".`,
      estadoAnterior: paso.postulacion.estado,
      estadoNuevo: dto.resultado,
    });
    const postulacionCompleta =
  await this.prisma.postulacion.findUnique({
    where: {
      ID_postulacion: paso.postulacionId,
    },
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
  });

    const usuarioIdNotif =
      postulacionCompleta?.estudiante?.persona?.usuario?.ID_usuario;

    if (usuarioIdNotif) {
      await this.postulacionesNotif.notificarResultadoEtapa({
        usuarioId: usuarioIdNotif,
        nombreEtapa: paso.pasoBeca.requisito.nombre,
        aprobado: false,
        nota: dto.nota,
        fecha: dto.fecha,
        descripcion: dto.descripcion,
        codigoSeguimiento:
          postulacionCompleta?.codigo_seguimiento,
        oficinaRutaId: dto.oficinaRutaId,
      });
    }
    return {
      ok: true,
      message:
        dto.resultado === 'ABANDONADO'
          ? 'Etapa abandonada. Postulación finalizada.'
          : 'Etapa reprobada. Postulación finalizada.',
      data: updated,
    };
  }

  // Buscar siguiente etapa
  const pasosBeca = paso.pasoBeca.beca.pasos;

  const indexActual = pasosBeca.findIndex(
    (p) => p.ID_pasosBeca === paso.pasoBecaId,
  );

  const siguiente = pasosBeca
    .slice(indexActual + 1)
    .find(
      (p) =>
        p.requisito.tipo_requisito === 'ETAPA',
    );

  // Si existe siguiente etapa → habilitar
  if (siguiente) {
    await this.prisma.paso_estudiante.updateMany({
      where: {
        postulacionId: paso.postulacionId,
        pasoBecaId: siguiente.ID_pasosBeca,
      },
      data: {
        estado_etapa: 'EN_REVISION',
        fecha_etapa: dto.fecha ? new Date(dto.fecha) : null,
        descripcion_etapa: dto.descripcion,
        texto_extra_etapa: dto.textoExtra,
        oficinaRutaId: dto.oficinaRutaId,
      },
    });
    const postulacionCompleta =
  await this.prisma.postulacion.findUnique({
    where: {
      ID_postulacion: paso.postulacionId,
    },
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
  });

const usuarioIdNotif =
  postulacionCompleta?.estudiante?.persona?.usuario?.ID_usuario;

if (usuarioIdNotif) {
  await this.postulacionesNotif.notificarResultadoEtapa({
    usuarioId: usuarioIdNotif,
    nombreEtapa: paso.pasoBeca.requisito.nombre,
    aprobado: true,
    nota: dto.nota,
    fecha: dto.fecha,
    descripcion: dto.descripcion,
    codigoSeguimiento:
      postulacionCompleta?.codigo_seguimiento,
    oficinaRutaId: dto.oficinaRutaId,
  });
}
    return {
      ok: true,
      message:
        'Etapa aprobada. Siguiente etapa habilitada.',
      data: updated,
    };
  }

  // Si no hay más etapas → APROBADO FINAL
  await this.prisma.postulacion.update({
    where: {
      ID_postulacion: paso.postulacionId,
    },
    data: {
      estado: 'APROBADO',
    },
  });
  await this.registrarCambioEstadoPostulacion({
  postulacionId: paso.postulacionId,
  usuarioId,
  accion: 'POSTULACION_APROBADA_POR_ETAPAS',
  detalle: 'La última etapa fue aprobada. La postulación pasó a APROBADO.',
  estadoAnterior: paso.postulacion.estado,
  estadoNuevo: 'APROBADO',
});
  const postulacionCompleta =
  await this.prisma.postulacion.findUnique({
    where: {
      ID_postulacion: paso.postulacionId,
    },
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
  });

    const usuarioIdNotif =
      postulacionCompleta?.estudiante?.persona?.usuario?.ID_usuario;

    if (usuarioIdNotif) {
      await this.postulacionesNotif.notificarResultadoEtapa({
        usuarioId: usuarioIdNotif,
        nombreEtapa: paso.pasoBeca.requisito.nombre,
        aprobado: true,
        nota: dto.nota,
        descripcion: 'Última etapa aprobada. Su postulación fue aprobada finalmente.',
        codigoSeguimiento: postulacionCompleta?.codigo_seguimiento,
      });
    }

  return {
    ok: true,
    message:
      'Última etapa aprobada. Postulación aprobada.',
    data: updated,
  };
}
// Abandonar trámite: solo EN_PROCESO o PENDIENTE
async abandonarTramite(id: string, usuarioId: number) {
  const postulacion = await this.prisma.postulacion.findUnique({
    where: { ID_postulacion: id },
    include: {
      beca: true,
      estudiante: { include: { persona: true } },
      paso_estudiante: {
        include: {
          legalizaciones: true,
        },
      },
    },
  });

  if (!postulacion) {
    throw new NotFoundException('Postulación no encontrada.');
  }

  const usuario = await this.prisma.usuario.findUnique({
    where: { ID_usuario: usuarioId },
    include: { persona: true },
  });

  if (!usuario || usuario.persona.ID_persona !== postulacion.estudiante.personaId) {
    throw new BadRequestException('No puedes abandonar un trámite que no te pertenece.');
  }

  if (!['EN_PROCESO', 'PENDIENTE'].includes(postulacion.estado)) {
    throw new BadRequestException(
      'Solo puedes abandonar el trámite mientras está en proceso o pendiente. Si ya fue habilitado, remitido o finalizado, queda bajo revisión administrativa.',
    );
  }

const tieneAvanceLegalizacion = postulacion.paso_estudiante.some((p) => {
  const estadoPaso = String(p.estado_revision || '');

  const avanceEnPaso = ['EN_REVISION', 'LEGALIZADO'].includes(estadoPaso);

  const avanceEnFlujo = p.legalizaciones.some((l) =>
    ['EN_REVISION', 'LEGALIZADO', 'ENTREGADO'].includes(String(l.estado)),
  );

  return avanceEnPaso || avanceEnFlujo;
});

const tieneAvanceEtapa = postulacion.paso_estudiante.some((p) =>
  ['EN_REVISION', 'APROBADO'].includes(String(p.estado_etapa)),
);

if (tieneAvanceEtapa) {
  throw new BadRequestException(
    'No puedes abandonar este trámite porque ya tiene avance institucional en etapas.',
  );
}

const abandonoRecuperable = tieneAvanceLegalizacion;

  await this.prisma.$transaction(async (tx) => {
    if (!abandonoRecuperable) {
      await tx.paso_legalizacion_estudiante.deleteMany({
        where: {
          pasoEstudiante: {
            postulacionId: id,
          },
        },
      });

      await tx.paso_estudiante.updateMany({
        where: { postulacionId: id },
        data: {
          completado: false,
          fecha_completado: null,
          notas: null,
          estado_revision: 'NO_REQUIERE',
          observacion_revision: null,
          fecha_revision: null,
          estado_etapa: 'BLOQUEADO',
          nota_etapa: null,
          fecha_etapa: null,
          descripcion_etapa: null,
          texto_extra_etapa: null,
          oficinaRutaId: null,
        },
      });
} else {
  for (const paso of postulacion.paso_estudiante) {
    const tieneMovimientoAdministrativo = paso.legalizaciones.some((l) =>
      ['EN_REVISION', 'LEGALIZADO', 'RECHAZADO', 'ENTREGADO'].includes(
        String(l.estado),
      ),
    );

    const soloPendienteSinEntregaFisica =
      !tieneMovimientoAdministrativo &&
      paso.legalizaciones.every(
        (l) => String(l.estado) === 'PENDIENTE_LEGALIZACION',
      );

    if (soloPendienteSinEntregaFisica) {
      await tx.paso_legalizacion_estudiante.deleteMany({
        where: {
          pasoEstudianteId: paso.ID_paso_estudiante,
        },
      });

      await tx.paso_estudiante.update({
        where: { ID_paso_estudiante: paso.ID_paso_estudiante },
        data: {
          estado_revision: 'NO_REQUIERE',
          completado: false,
          fecha_completado: null,
          observacion_revision: null,
          fecha_revision: null,
        },
      });

      continue;
    }

    if (tieneMovimientoAdministrativo) {
      await tx.paso_estudiante.update({
        where: { ID_paso_estudiante: paso.ID_paso_estudiante },
        data: {
          estado_revision: 'EN_REVISION',
          fecha_revision: paso.fecha_revision ?? new Date(),
        },
      });
    }
  }
}

    await tx.postulacion.update({
      where: { ID_postulacion: id },
      data: {
        estado: 'ABANDONADO',
        abandono_recuperable: abandonoRecuperable,
        estado_antes_abandono: postulacion.estado,
        fecha_abandono: new Date(),
        motivo_abandono: abandonoRecuperable
          ? 'Trámite abandonado con avance de legalización presencial conservado.'
          : 'Trámite abandonado sin avance institucional.',
        observacion: abandonoRecuperable
          ? 'Trámite abandonado. Puede continuar porque conserva avance de legalización presencial.'
          : 'Trámite abandonado por el estudiante.',
      },
    });

    await tx.audit_log.create({
      data: {
        tabla: 'postulacion',
        registroId: id,
        accion: abandonoRecuperable
          ? 'ABANDONAR_TRAMITE_RECUPERABLE'
          : 'ABANDONAR_TRAMITE_SIMPLE',
        usuarioId,
        detalle: abandonoRecuperable
          ? 'El estudiante abandonó el trámite conservando avance de legalización presencial.'
          : 'El estudiante abandonó el trámite sin avance institucional.',
        antes: {
          estado: postulacion.estado,
          abandono_recuperable: postulacion.abandono_recuperable,
        },
        despues: {
          estado: 'ABANDONADO',
          abandono_recuperable: abandonoRecuperable,
        },
      },
    });
  });

  return {
    ok: true,
message: abandonoRecuperable
  ? 'Trámite abandonado. Tu avance institucional de legalización fue conservado y podrás continuarlo mientras la convocatoria siga vigente.'
  : 'Trámite abandonado correctamente.',
  };
}

// Continuar trámite abandonado recuperable
async continuarTramite(id: string, usuarioId: number) {
  const postulacion = await this.prisma.postulacion.findUnique({
    where: { ID_postulacion: id },
    include: {
      beca: true,
      estudiante: { include: { persona: true } },
      paso_estudiante: {
        include: {
          pasoBeca: {
            include: {
              requisito: {
                include: {
                  legalizacion_flujo: {
                    where: { activo: true },
                    orderBy: { orden: 'asc' },
                  },
                },
              },
            },
          },
          legalizaciones: true,
        },
      },
    },
  });

  if (!postulacion) {
    throw new NotFoundException('Postulación no encontrada.');
  }

  const usuario = await this.prisma.usuario.findUnique({
    where: { ID_usuario: usuarioId },
    include: { persona: true },
  });

  if (!usuario || usuario.persona.ID_persona !== postulacion.estudiante.personaId) {
    throw new BadRequestException('No puedes continuar un trámite que no te pertenece.');
  }

  if (postulacion.estado !== 'ABANDONADO') {
    throw new BadRequestException('Solo se puede continuar un trámite abandonado.');
  }

  if (!postulacion.abandono_recuperable) {
    throw new BadRequestException(
      'Este trámite abandonado no tiene avance de legalización presencial recuperable.',
    );
  }

  if (postulacion.beca.fecha_fin) {
    const hoy = new Date();
    const fechaFin = new Date(postulacion.beca.fecha_fin);

    if (hoy > fechaFin) {
      throw new BadRequestException(
        'No puedes continuar el trámite porque la convocatoria ya finalizó.',
      );
    }
  }

  const estadoRestaurado: string = ['EN_PROCESO', 'PENDIENTE'].includes(
    String(postulacion.estado_antes_abandono),
  )
    ? String(postulacion.estado_antes_abandono)
    : 'EN_PROCESO';

  const updated = await this.prisma.$transaction(async (tx) => {
    for (const paso of postulacion.paso_estudiante) {
      const req = paso.pasoBeca.requisito;

      if (!req.requiere_legalizacion) continue;

      const yaTieneFlujo = paso.legalizaciones.length > 0;

      if (!yaTieneFlujo) {
        if (!req.legalizacion_flujo.length) {
          throw new BadRequestException(
            `El requisito "${req.nombre}" requiere legalización, pero no tiene flujo configurado.`,
          );
        }

        await tx.paso_estudiante.update({
          where: { ID_paso_estudiante: paso.ID_paso_estudiante },
          data: {
            estado_revision: 'PENDIENTE_LEGALIZACION',
            completado: false,
            fecha_completado: null,
          },
        });

        await tx.paso_legalizacion_estudiante.createMany({
          data: req.legalizacion_flujo.map((f, index) => ({
            pasoEstudianteId: paso.ID_paso_estudiante,
            usuarioId: f.usuarioId,
            orden: f.orden,
            estado: 'PENDIENTE_LEGALIZACION',
            activo_revision: index === 0,
            fecha_inicio: index === 0 ? new Date() : null,
          })),
        });
      }
    }

    const post = await tx.postulacion.update({
      where: { ID_postulacion: id },
      data: {
        estado: estadoRestaurado,
        abandono_recuperable: false,
        estado_antes_abandono: null,
        fecha_abandono: null,
        motivo_abandono: null,
        observacion: 'El estudiante continuó el trámite abandonado.',
      },
    });

    await tx.audit_log.create({
      data: {
        tabla: 'postulacion',
        registroId: id,
        accion: 'CONTINUAR_TRAMITE',
        usuarioId,
        detalle: 'El estudiante continuó un trámite abandonado recuperable.',
        antes: {
          estado: 'ABANDONADO',
          estado_antes_abandono: postulacion.estado_antes_abandono,
          abandono_recuperable: postulacion.abandono_recuperable,
        },
        despues: {
          estado: estadoRestaurado,
          abandono_recuperable: false,
        },
      },
    });

    return post;
  });

  return {
    ok: true,
    message: 'Trámite recuperado correctamente.',
    data: updated,
  };
}
  // 🔍 Obtener trámite activo
  async obtenerTramiteActivo(estudianteId: number, gestion: string) {
    return this.prisma.postulacion.findFirst({
      where: {
        estudianteId,
        gestion,
        estado: { notIn: ['APROBADO', 'ABANDONADO','REPROBADO'] },
      },
      include: { beca: true },
    });

  }
// resuelve estudianteId a partir de usuarioId si hace falta
async obtenerTramiteActivoFlexible(args: {
  gestion: string;
  estudianteId?: number;
  usuarioId?: number;
  becaId?: number;
}) {
  const { gestion, estudianteId, usuarioId, becaId } = args;

  let finalEstudianteId = estudianteId;

  if (!finalEstudianteId && usuarioId) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { ID_usuario: usuarioId },
      include: { persona: true },
    });

    if (!usuario?.persona) return null;

    const est = await this.prisma.estudiante.findFirst({
      where: { personaId: usuario.persona.ID_persona },
      select: { ID_estudiante: true },
    });

    if (!est) return null;

    finalEstudianteId = est.ID_estudiante;
  }

  if (!finalEstudianteId) return null;

  const postulaciones = await this.prisma.postulacion.findMany({
    where: {
      estudianteId: finalEstudianteId,
      gestion,
      ...(becaId ? { becaId } : {}),
      estado: {
        in: [
          'EN_PROCESO',
          'PENDIENTE',
          'HABILITADO',
          'REMITIDO_A_DISBECT',
          'APROBADO',
          'REPROBADO',
          'ABANDONADO',
          'NO_REMITIDO',
        ],
      },
    },
    include: { beca: true },
    orderBy: { fecha: 'desc' },
  });

  if (!postulaciones.length) return null;

  const activa =
    postulaciones.find((p) => p.estado === 'EN_PROCESO') ||
    postulaciones.find((p) => p.estado === 'PENDIENTE') ||
    postulaciones.find((p) => p.estado === 'HABILITADO') ||
    postulaciones.find((p) => p.estado === 'REMITIDO_A_DISBECT');

  if (activa) return activa;

  const recuperable = postulaciones.find((p) => {
    if (p.estado !== 'ABANDONADO') return false;
    if (p.abandono_recuperable !== true) return false;

    if (!p.beca?.fecha_fin) return true;

    return new Date() <= new Date(p.beca.fecha_fin);
  });

  if (recuperable) return recuperable;

const periodoActual = this.calcularPeriodoPostulacion();
// const periodoActual = this.calcularPeriodoPostulacion(Number(gestion));

const finalVisible = postulaciones.find((p) => {
  const estado = String(p.estado);

  if (
    !['APROBADO', 'REPROBADO', 'ABANDONADO', 'NO_REMITIDO'].includes(estado)
  ) {
    return false;
  }

  if (p.beca?.periodo_bloqueo === 'SEMESTRAL') {
    return p.periodo_postulacion === periodoActual;
  }

  return true;
});

if (finalVisible) return finalVisible;

return null;
}

  // Listado general con filtros (para backend)
  async findAll(params: {limit?: number; offset?: number; gestion?: string; estado?: string; estudianteId?: number; becaId?: number; search?: string; }) {
    const {
      limit = 10,
      offset = 0,
      gestion,
      estado,
      estudianteId,
      becaId,
      search,
    } = params;

    const where: Prisma.postulacionWhereInput = {
      ...(gestion ? { gestion } : {}),
      ...(estado ? { estado } : {}),
      ...(estudianteId ? { estudianteId } : {}),
      ...(becaId ? { becaId } : {}),
      ...(search
        ? {
            OR: [
              { beca: { nombre: { contains: search, mode: 'insensitive' } } },
              {
                estudiante: {
                  persona: {
                    OR: [
                      { nombre: { contains: search, mode: 'insensitive' } },
                      { apellido_paterno: { contains: search, mode: 'insensitive' } },
                      { apellido_materno: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.postulacion.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ fecha: 'desc' }],
        include: {
          beca: true,
          estudiante: { include: { persona: true } },
        },
      }),
      this.prisma.postulacion.count({ where }),
    ]);

    return { count, rows };
  }

  // Listado para administrador (año actual, búsqueda, sin aprobados)
  async adminList(q: {
    offset?: number;
    limit?: number;
    year?: number;
    becaId?: number;
    search?: string;
    searchEstudiante?: string;
    searchBeca?: string;
    estado?: string;
    tipoBeca?: 'CON_ETAPAS' | 'SIN_ETAPAS';
    modoEstado?: 'ACTUAL' | 'HISTORICO';
  }) {
    const {
      offset = 0,
      limit = 10,
      year,
      becaId,
      search = '',
      searchEstudiante = '',
      searchBeca = '',
      estado,
      tipoBeca,
      modoEstado = 'ACTUAL',
    } = q ?? {};

  const gestionFilter = year ? { startsWith: String(year) } : undefined;

  const estudianteText = (searchEstudiante || search).trim();
  const becaText = searchBeca.trim();

  const estudianteWords = estudianteText
    .split(/\s+/)
    .filter(Boolean);

  const andFilters: Prisma.postulacionWhereInput[] = [];

for (const word of estudianteWords) {
  andFilters.push({
    OR: [
      { estudiante: { persona: { ci: { contains: word } } } },
      { estudiante: { persona: { nombre: { contains: word, mode: Prisma.QueryMode.insensitive } } } },
      { estudiante: { persona: { apellido_paterno: { contains: word, mode: Prisma.QueryMode.insensitive } } } },
      { estudiante: { persona: { apellido_materno: { contains: word, mode: Prisma.QueryMode.insensitive } } } },
    ],
  });
}

if (becaText) {
  andFilters.push({
    OR: [
      { beca: { nombre: { contains: becaText, mode: Prisma.QueryMode.insensitive } } },
      { beca: { tipo: { contains: becaText, mode: Prisma.QueryMode.insensitive } } },
    ],
  });
}
if (tipoBeca === 'CON_ETAPAS') {
  andFilters.push({
    beca: {
      pasos: {
        some: {
          requisito: {
            tipo_requisito: 'ETAPA',
          },
        },
      },
    },
  });
}

if (tipoBeca === 'SIN_ETAPAS') {
  andFilters.push({
    beca: {
      pasos: {
        none: {
          requisito: {
            tipo_requisito: 'ETAPA',
          },
        },
      },
    },
  });
}
let idsHistoricos: string[] = [];

if (modoEstado === 'HISTORICO' && estado && estado !== 'TODOS') {
  if (estado !== 'EN_PROCESO') {
    const logs = await this.prisma.audit_log.findMany({
      where: {
        tabla: 'postulacion',
      },
      select: {
        registroId: true,
        despues: true,
      },
    });

    idsHistoricos = Array.from(
      new Set(
        logs
          .filter((log) => {
            const despues = log.despues as any;

            return (
              String(despues?.estado || '').toUpperCase() === estado ||
              String(despues?.estado_observacion || '').toUpperCase() === estado
            );
          })
          .map((log) => log.registroId),
      ),
    );
  }
}
const where: Prisma.postulacionWhereInput = {
  ...(gestionFilter ? { gestion: gestionFilter } : {}),
  ...(becaId ? { becaId } : {}),

  ...(estado && estado !== 'TODOS' && modoEstado === 'ACTUAL'
    ? estado === 'OBSERVADO'
      ? { estado_observacion: 'OBSERVADO' }
      : { estado }
    : {}),

  ...(estado && estado !== 'TODOS' && modoEstado === 'HISTORICO'
    ? estado === 'EN_PROCESO'
      ? {}
      : {
          OR: [
            { ID_postulacion: { in: idsHistoricos } },
            estado === 'OBSERVADO'
              ? { estado_observacion: 'OBSERVADO' }
              : { estado },
          ],
        }
    : {}),

  ...(andFilters.length > 0 ? { AND: andFilters } : {}),
};
  const [rows, count] = await this.prisma.$transaction([
    this.prisma.postulacion.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: [{ fecha: 'desc' }],
      select: {
        ID_postulacion: true,
        gestion: true,
        fecha: true,
        estado: true,
        estado_observacion: true,
        observacion: true,
        beca_nombre_historico: true,
        beca_tipo_historico: true,
        beca_fecha_inicio_historico: true,
        beca_fecha_fin_historico: true,
        beca_historial_capturado: true,
        beca: {
          select: {
            ID_beca: true,
            nombre: true,
            tipo: true,
            cupos: true,
            fecha_inicio: true,
            fecha_fin: true,
            pasos: {
              select: {
                requisito: {
                  select: {
                    tipo_requisito: true,
                  },
                },
              },
            },
          },
        },
        estudiante: {
          select: {
            ID_estudiante: true,
            semestre: true,
            persona: {
              select: {
                ci: true,
                nombre: true,
                apellido_paterno: true,
                apellido_materno: true,
              },
            },
          },
        },
      },
    }),
    this.prisma.postulacion.count({ where }),
  ]);
  const logsFinales = await this.prisma.audit_log.findMany({
  where: {
    tabla: 'postulacion',
    registroId: {
      in: rows.map((r) => r.ID_postulacion),
    },
  },
  include: {
    usuario: {
      include: {
        persona: true,
      },
    },
  },
  orderBy: {
    createdAt: 'desc',
  },
});

const obtenerLogEstadoFinal = (postulacionId: string, estadoActual: string) => {
  return logsFinales.find((log) => {
    const despues = log.despues as any;

    return (
      log.registroId === postulacionId &&
      String(despues?.estado || '').toUpperCase() ===
        String(estadoActual || '').toUpperCase()
    );
  });
};

const obtenerNombreUsuarioLog = (log: any) => {
  if (!log?.usuario) return 'Sistema';

  const nombreCompleto = [
    log.usuario.persona?.nombre,
    log.usuario.persona?.apellido_paterno,
    log.usuario.persona?.apellido_materno,
  ]
    .filter(Boolean)
    .join(' ');

  return nombreCompleto || log.usuario.username || 'Sistema';
};
  return {
    count,
    rows: rows.map((r) => ({
      id: r.ID_postulacion,
      gestion: r.gestion,
      fecha: r.fecha,
      estado: r.estado,
      estado_observacion: r.estado_observacion,
      observacion: r.observacion,
      ci: r.estudiante.persona.ci,
      nombre: r.estudiante.persona.nombre,
      apellido_paterno: r.estudiante.persona.apellido_paterno,
      apellido_materno: r.estudiante.persona.apellido_materno,
      semestre: r.estudiante.semestre,
      beca_id: r.beca.ID_beca,
      beca_nombre: r.beca_historial_capturado
        ? r.beca_nombre_historico
        : r.beca.nombre,

      beca_tipo: r.beca_historial_capturado
        ? r.beca_tipo_historico
        : r.beca.tipo,
        
      beca_cupos: r.beca.cupos,

      beca_fecha_inicio: r.beca_historial_capturado
        ? r.beca_fecha_inicio_historico
        : r.beca.fecha_inicio,

      beca_fecha_fin: r.beca_historial_capturado
        ? r.beca_fecha_fin_historico
        : r.beca.fecha_fin,
      tiene_etapas: r.beca.pasos.some(
        (p) => p.requisito.tipo_requisito === 'ETAPA',
      ),
fecha_estado_final: (() => {
  if (r.estado === 'EN_PROCESO') return r.fecha;

  const log = obtenerLogEstadoFinal(r.ID_postulacion, r.estado);
  return log?.createdAt ?? null;
})(),

usuario_estado_final: (() => {
  if (r.estado === 'EN_PROCESO') return 'Estudiante';

  const log = obtenerLogEstadoFinal(r.ID_postulacion, r.estado);
  return obtenerNombreUsuarioLog(log);
})(),
    })),
  };
}
    // Crear postulación directamente (por admin o proceso manual)
  async create(dto: CreatePostulacionDto) {
  const beca = await this.prisma.beca.findUnique({
    where: { ID_beca: dto.becaId },
  });

  if (!beca) {
    throw new NotFoundException('Beca no encontrada.');
  }

  const periodoPostulacion = this.calcularPeriodoPostulacion();
// const periodoPostulacion = this.calcularPeriodoPostulacion(Number(dto.gestion));
  const abierta = await this.prisma.postulacion.findFirst({
    where: {
      estudianteId: dto.estudianteId,
      gestion: dto.gestion,
      estado: {
        in: [
          'EN_PROCESO',
          'PENDIENTE',
          'HABILITADO',
          'REMITIDO_A_DISBECT',
        ],
      },
    },
    select: { ID_postulacion: true },
  });

  if (abierta) {
    throw new BadRequestException(
      'Ya existe una postulación activa en esta gestión.',
    );
  }

  return this.prisma.$transaction(async (tx) => {
    const post = await tx.postulacion.create({
      data: {
        estudianteId: dto.estudianteId,
        becaId: dto.becaId,
        gestion: dto.gestion,
        periodo_postulacion: periodoPostulacion,
        estado: 'EN_PROCESO',
        estado_observacion: 'NO OBSERVADO',

        beca_nombre_historico: beca.nombre,
        beca_tipo_historico: beca.tipo,
        beca_fecha_inicio_historico: beca.fecha_inicio,
        beca_fecha_fin_historico: beca.fecha_fin,
        beca_historial_capturado: true,
      },
    });

    await this.crearPasosYLegalizacion(tx, post.ID_postulacion, dto.becaId);

    return tx.postulacion.findUnique({
      where: { ID_postulacion: post.ID_postulacion },
      include: {
        beca: true,
        estudiante: { include: { persona: true } },
        paso_estudiante: {
          include: {
            legalizaciones: true,
            pasoBeca: {
              include: {
                requisito: {
                  include: {
                    legalizacion_flujo: true,
                  },
                },
              },
            },
          },
          orderBy: [{ pasoBeca: { orden: 'asc' } }],
        },
      },
    });
  });
}
  async countEstudiantesUnicosPorGestion(year: number) {
  const gestionPrefix = String(year);

  const result = await this.prisma.postulacion.groupBy({
    by: ['estudianteId'],
    where: {
      gestion: { startsWith: gestionPrefix },
    },
  });

  return result.length;
}

async reportePostulacionesPorBeca(year?: number) {
  const gestionPrefix = year ? String(year) : undefined;

  const rows = await this.prisma.postulacion.findMany({
    where: {
      ...(gestionPrefix
        ? {
            gestion: {
              startsWith: gestionPrefix,
            },
          }
        : {}),
    },
    select: {
      estado: true,
      estado_observacion: true,
      gestion: true,
      beca_nombre_historico: true,
      beca_tipo_historico: true,
      beca_fecha_inicio_historico: true,
      beca_fecha_fin_historico: true,
      beca_historial_capturado: true,
      beca: {
      select: {
        ID_beca: true,
        nombre: true,
        tipo: true,
        fecha_inicio: true,
        fecha_fin: true,
      },
    },
    },
  });

  const mapa = new Map<string, any>();

  for (const r of rows) {
    const key = `${r.beca.ID_beca}-${r.gestion}`;

    if (!mapa.has(key)) {
      mapa.set(key, {
        becaId: r.beca.ID_beca,
        beca: r.beca_historial_capturado
          ? r.beca_nombre_historico
          : r.beca.nombre,

        tipo: r.beca_historial_capturado
          ? r.beca_tipo_historico
          : r.beca.tipo,

        beca_fecha_inicio: r.beca_historial_capturado
          ? r.beca_fecha_inicio_historico
          : r.beca.fecha_inicio,

        beca_fecha_fin: r.beca_historial_capturado
          ? r.beca_fecha_fin_historico
          : r.beca.fecha_fin,
        gestion: r.gestion,
        totalPostulaciones: 0,
        pendientes: 0,
        habilitados: 0,
        remitidosDisbect: 0,
        aprobados: 0,
        reprobados: 0,
        noRemitidos: 0,
        abandonados: 0,
        observados: 0,
      });
    }

    const item = mapa.get(key);
    const estado = String(r.estado || '').toUpperCase();
    const observacion = String(r.estado_observacion || '').toUpperCase();

    item.totalPostulaciones++;

    if (estado === 'APROBADO') item.aprobados++;
    if (estado === 'REPROBADO') item.reprobados++;
    if (observacion === 'OBSERVADO') item.observados++;
    if (estado === 'PENDIENTE') item.pendientes++;
    if (estado === 'HABILITADO') item.habilitados++;
    if (estado === 'REMITIDO_A_DISBECT') item.remitidosDisbect++;
    if (estado === 'NO_REMITIDO') item.noRemitidos++;
    if (estado === 'ABANDONADO') item.abandonados++;
  }

  const data = Array.from(mapa.values());

  return {
    gestion: year || 'Todas',
    fechaGeneracion: new Date(),
    rows: data,
  };
}
// Marcar o desmarcar paso (cuando el estudiante completa un requisito)
async marcarPaso(idPostulacion: string, dto: MarcarPasoDto) {
  const paso = await this.prisma.paso_estudiante.findUnique({
    where: {
      postulacionId_pasoBecaId: {
        postulacionId: idPostulacion,
        pasoBecaId: dto.pasoBecaId,
      },
    },
    include: {
      postulacion: true,
      pasoBeca: {
        include: {
          requisito: true,
        },
      },
    },
  });

  if (!paso) {
    throw new NotFoundException(
      'Paso no encontrado para esta postulación',
    );
  }

  const requisito = paso.pasoBeca.requisito;

  const esEtapa =
    requisito.tipo_requisito === 'ETAPA';

  // =====================================================
  // FLUJO ETAPAS
  // =====================================================

  if (esEtapa) {
  throw new BadRequestException(
    'Las etapas serán gestionadas por el encargado asignado.',
  );
}

  // =====================================================
  //  FLUJO DOCUMENTOS NORMALES
  // =====================================================
  else {
    const requiereLegalizacion =
      requisito.requiere_legalizacion;

    if (requiereLegalizacion) {
  throw new BadRequestException(
    'Este requisito requiere legalización. No puede ser marcado por el estudiante.',
  );
} else {
      await this.prisma.paso_estudiante.update({
        where: {
          postulacionId_pasoBecaId: {
            postulacionId: idPostulacion,
            pasoBecaId: dto.pasoBecaId,
          },
        },
        data: {
          completado: dto.completado,
          fecha_completado: dto.completado
            ? new Date()
            : null,
          notas: dto.notas,

          estado_revision: 'NO_REQUIERE',
          observacion_revision: null,
          fecha_revision: null,
        },
      });
    }
  }

  return this.prisma.postulacion.findUnique({
    where: {
      ID_postulacion: idPostulacion,
    },
    include: {
      beca: true,
      estudiante: {
        include: {
          persona: true,
        },
      },
      paso_estudiante: {
        include: {
          oficinaRuta: true,
          pasoBeca: {
            include: {
              requisito: true,
            },
          },
        },
        orderBy: [
          {
            pasoBeca: {
              orden: 'asc',
            },
          },
        ],
      },
    },
  });
}
async actualizarPostulacionAdmin(
  id: string,
  dto: {
    becaId?: number;
    gestion?: string;
    estado?: string;
    estado_observacion?: string;
    observacion?: string;
  },
  usuarioId: number,
) {
  const postulacion = await this.prisma.postulacion.findUnique({
    where: { ID_postulacion: id },
  });

  if (!postulacion) {
    throw new NotFoundException('Postulación no encontrada.');
  }
  const antes = {
  becaId: postulacion.becaId,
  gestion: postulacion.gestion,
  estado: postulacion.estado,
  estado_observacion: postulacion.estado_observacion,
  observacion: postulacion.observacion,
};
  const updated = await this.prisma.postulacion.update({
    where: { ID_postulacion: id },
    data: {
      ...(dto.becaId !== undefined ? { becaId: Number(dto.becaId) } : {}),
      ...(dto.gestion !== undefined ? { gestion: dto.gestion } : {}),
      ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
      ...(dto.estado_observacion !== undefined
        ? { estado_observacion: dto.estado_observacion }
        : {}),
      ...(dto.observacion !== undefined ? { observacion: dto.observacion } : {}),
    },
    include: {
      beca: true,
      estudiante: { include: { persona: true } },
    },
  });
  await this.registrarCambioEstadoPostulacion({
    postulacionId: id,
    usuarioId,
    accion: 'ADMIN_EDITAR_POSTULACION',
    detalle: 'Administrador actualizó una postulación.',
    estadoAnterior: postulacion.estado,
    estadoNuevo: updated.estado,
    extraAntes: {
      becaId: postulacion.becaId,
      gestion: postulacion.gestion,
      estado_observacion: postulacion.estado_observacion,
      observacion: postulacion.observacion,
    },
    extraDespues: {
      becaId: updated.becaId,
      gestion: updated.gestion,
      estado_observacion: updated.estado_observacion,
      observacion: updated.observacion,
    },
  });
return updated;
}
async consultarSeguimientoPorCodigo(codigo: string) {
  const postulacion = await this.prisma.postulacion.findUnique({
    where: { codigo_seguimiento: codigo },
    select: {
      ID_postulacion: true,
      codigo_seguimiento: true,
      estado: true,
      gestion: true,
      fecha: true,
      observacion: true,
      estado_observacion: true,
      abandono_recuperable: true,
      motivo_abandono: true,

      beca_nombre_historico: true,
      beca_tipo_historico: true,
      beca_fecha_inicio_historico: true,
      beca_fecha_fin_historico: true,
      beca_historial_capturado: true,

      beca: {
        select: {
          nombre: true,
          tipo: true,
          fecha_inicio: true,
          fecha_fin: true,
        },
      },

      paso_estudiante: {
        include: {
          oficinaRuta: true,
          pasoBeca: {
            include: { requisito: true },
          },
        },
        orderBy: [{ pasoBeca: { orden: 'asc' } }],
      },
    },
  });

  if (!postulacion) {
    throw new NotFoundException(
      'No se encontró ningún trámite con ese código.',
    );
  }

const logs = await this.prisma.audit_log.findMany({
  where: {
    tabla: 'postulacion',
    registroId: postulacion.ID_postulacion,
  },
  include: {
    usuario: {
      include: { persona: true },
    },
  },
  orderBy: { createdAt: 'asc' },
});

  const estadosPermitidos = [
    'PENDIENTE',
    'HABILITADO',
    'REMITIDO_A_DISBECT',
    'NO_REMITIDO',
    'APROBADO',
    'REPROBADO',
    'ABANDONADO',
  ];

  const historial_estados: {
    estado: string;
    fecha: Date | null;
    accion: string;
    descripcion: string | null;
  }[] = [
    {
      estado: 'EN_PROCESO',
      fecha: postulacion.fecha,
      accion: 'INICIO_TRAMITE',
      descripcion: 'El estudiante inició el trámite.',
    },
    ...logs
      .map((log) => {
        const despues = log.despues as any;
        const estadoNuevo = despues?.estado;

        if (!estadoNuevo) return null;
        if (!estadosPermitidos.includes(String(estadoNuevo))) return null;

        return {
          estado: String(estadoNuevo),
          fecha: log.createdAt,
          accion: log.accion,
          descripcion: log.detalle,
        };
      })
      .filter(
        (
          item,
        ): item is {
          estado: string;
          fecha: Date;
          accion: string;
          descripcion: string | null;
        } => item !== null,
      ),
  ];

  const existeEstadoActual = historial_estados.some(
    (h) => h.estado === postulacion.estado,
  );

  if (!existeEstadoActual) {
    historial_estados.push({
      estado: postulacion.estado,
      fecha: null,
      accion: 'ESTADO_ACTUAL',
      descripcion: 'Estado actual del trámite.',
    });
  }

  const mensajesEstado: Record<string, string> = {
    EN_PROCESO:
      'El trámite se encuentra en proceso. Aún no fue finalizado por el estudiante.',
    PENDIENTE:
      'El trámite fue finalizado por el estudiante y se encuentra pendiente de revisión administrativa.',
    HABILITADO:
      'La documentación fue aprobada y el trámite se encuentra habilitado para evaluación de etapas.',
    REMITIDO_A_DISBECT:
      'La carpeta fue remitida a DISBECT para revisión administrativa.',
    NO_REMITIDO:
      'La carpeta no logró ser remitida a DISBECT. El trámite fue cerrado administrativamente.',
    APROBADO:
      'La postulación fue aprobada.',
    REPROBADO:
      'La postulación fue reprobada.',
    ABANDONADO: postulacion.abandono_recuperable
      ? 'El trámite fue abandonado, pero conserva avance institucional y puede ser continuado desde el sistema.'
      : 'El trámite fue abandonado.',
  };
  const nombreUsuario = (u: any) =>
  u
    ? [
        u.persona?.nombre,
        u.persona?.apellido_paterno,
        u.persona?.apellido_materno,
      ]
        .filter(Boolean)
        .join(' ') || u.username
    : 'Sistema';

const logObservacion = [...logs]
  .reverse()
  .find((log) => {
    const despues = log.despues as any;
    return String(despues?.estado_observacion || '').toUpperCase() === 'OBSERVADO';
  });

const observacion_detalle = {
  tipo: postulacion.estado_observacion,
  mensaje: postulacion.observacion,
  fecha: logObservacion?.createdAt || null,
  realizada_por: nombreUsuario(logObservacion?.usuario),
  oficina: logObservacion
    ? {
        id: (logObservacion.despues as any)?.oficinaId ?? null,
        nombre: (logObservacion.despues as any)?.oficinaNombre ?? null,
        horario_atencion:
          (logObservacion.despues as any)?.horario_atencion ?? null,
      }
    : null,
};
  return {
    codigo_seguimiento: postulacion.codigo_seguimiento,
    estado_general: postulacion.estado,
    mensaje_estado:
      mensajesEstado[postulacion.estado] ||
      'Estado del trámite no reconocido.',
    observacion_detalle,
    abandono_recuperable: postulacion.abandono_recuperable,
    motivo_abandono: postulacion.motivo_abandono,
    gestion: postulacion.gestion,

    beca: {
      nombre: postulacion.beca_historial_capturado
        ? postulacion.beca_nombre_historico
        : postulacion.beca.nombre,

      tipo: postulacion.beca_historial_capturado
        ? postulacion.beca_tipo_historico
        : postulacion.beca.tipo,

      fecha_inicio: postulacion.beca_historial_capturado
        ? postulacion.beca_fecha_inicio_historico
        : postulacion.beca.fecha_inicio,

      fecha_fin: postulacion.beca_historial_capturado
        ? postulacion.beca_fecha_fin_historico
        : postulacion.beca.fecha_fin,
    },

    historial_estados,

    etapas: postulacion.paso_estudiante
      .filter((p) => p.pasoBeca.requisito.tipo_requisito === 'ETAPA')
      .map((p) => ({
        nombre: p.pasoBeca.requisito.nombre,
        descripcion_requisito: p.pasoBeca.requisito.descripcion,
        estado_etapa: p.estado_etapa,
        completado: p.completado,
        nota: p.nota_etapa,
        fecha: p.fecha_etapa,
        descripcion: p.descripcion_etapa,
        texto_extra: p.texto_extra_etapa,
        ruta360: p.oficinaRuta
          ? {
              oficinaId: p.oficinaRuta.ID_oficina,
              nombre: p.oficinaRuta.nombre,
              slug: p.oficinaRuta.panorama_route_slug,
            }
          : null,
        oficina: p.oficinaRuta
          ? {
              id: p.oficinaRuta.ID_oficina,
              nombre: p.oficinaRuta.nombre,
              horario_atencion: p.oficinaRuta.horario_atencion,
            }
          : null,
      })),
  };
}
async consultarSeguimientoAdminPorId(id: string) {
  const postulacion = await this.prisma.postulacion.findUnique({
    where: { ID_postulacion: id },
    select: {
      codigo_seguimiento: true,
    },
  });

  if (!postulacion) {
    throw new NotFoundException('Postulación no encontrada.');
  }

  if (postulacion.codigo_seguimiento) {
    return this.consultarSeguimientoPorCodigo(
      postulacion.codigo_seguimiento,
    );
  }

  return this.consultarSeguimientoPorPostulacionId(id);
}
private async consultarSeguimientoPorPostulacionId(id: string) {
  const postulacion = await this.prisma.postulacion.findUnique({
    where: { ID_postulacion: id },
    select: {
      ID_postulacion: true,
      codigo_seguimiento: true,
      estado: true,
      gestion: true,
      fecha: true,
      abandono_recuperable: true,
      motivo_abandono: true,
      observacion: true,
estado_observacion: true,
      beca_nombre_historico: true,
      beca_tipo_historico: true,
      beca_historial_capturado: true,

      beca: {
        select: {
          nombre: true,
          tipo: true,
        },
      },

      paso_estudiante: {
        include: {
          oficinaRuta: true,
          pasoBeca: {
            include: { requisito: true },
          },
        },
        orderBy: [{ pasoBeca: { orden: 'asc' } }],
      },
    },
  });

  if (!postulacion) {
    throw new NotFoundException('Postulación no encontrada.');
  }
const logs = await this.prisma.audit_log.findMany({
  where: {
    tabla: 'postulacion',
    registroId: postulacion.ID_postulacion,
  },
  include: {
    usuario: {
      include: { persona: true },
    },
  },
  orderBy: { createdAt: 'asc' },
});

const nombreUsuario = (u: any) =>
  u
    ? [
        u.persona?.nombre,
        u.persona?.apellido_paterno,
        u.persona?.apellido_materno,
      ].filter(Boolean).join(' ') || u.username
    : 'Sistema';

const logObservacion = [...logs].reverse().find((log) => {
  const despues = log.despues as any;
  return String(despues?.estado_observacion || '').toUpperCase() === 'OBSERVADO';
});

const observacion_detalle = {
  tipo: postulacion.estado_observacion,
  mensaje: postulacion.observacion,
  fecha: logObservacion?.createdAt || null,
  realizada_por: nombreUsuario(logObservacion?.usuario),
  oficina: logObservacion
    ? {
        id: (logObservacion.despues as any)?.oficinaId ?? null,
        nombre: (logObservacion.despues as any)?.oficinaNombre ?? null,
        horario_atencion:
          (logObservacion.despues as any)?.horario_atencion ?? null,
      }
    : null,
};
  return {
    codigo_seguimiento:
      postulacion.codigo_seguimiento || 'SIN CÓDIGO GENERADO',
    estado_general: postulacion.estado,
    mensaje_estado:
      postulacion.estado === 'EN_PROCESO'
        ? 'El trámite fue registrado, pero aún no fue finalizado por el estudiante.'
        : 'Estado del trámite registrado.',
    observacion_detalle,
    abandono_recuperable: postulacion.abandono_recuperable,
    motivo_abandono: postulacion.motivo_abandono,
    gestion: postulacion.gestion,

    beca: {
      nombre: postulacion.beca_historial_capturado
        ? postulacion.beca_nombre_historico
        : postulacion.beca.nombre,

      tipo: postulacion.beca_historial_capturado
        ? postulacion.beca_tipo_historico
        : postulacion.beca.tipo,
    },

    historial_estados: [
      {
        estado: 'EN_PROCESO',
        fecha: postulacion.fecha,
        accion: 'INICIO_TRAMITE',
        descripcion: 'El estudiante inició el trámite.',
      },
    ],

    etapas: postulacion.paso_estudiante
      .filter((p) => p.pasoBeca.requisito.tipo_requisito === 'ETAPA')
      .map((p) => ({
        nombre: p.pasoBeca.requisito.nombre,
        descripcion_requisito: p.pasoBeca.requisito.descripcion,
        estado_etapa: p.estado_etapa,
        completado: p.completado,
        nota: p.nota_etapa,
        fecha: p.fecha_etapa,
        descripcion: p.descripcion_etapa,
        texto_extra: p.texto_extra_etapa,
        ruta360: p.oficinaRuta
          ? {
              oficinaId: p.oficinaRuta.ID_oficina,
              nombre: p.oficinaRuta.nombre,
              slug: p.oficinaRuta.panorama_route_slug,
            }
          : null,
      })),
  };
}
async etapasEncargado(usuarioId: number) {
  const rows = await this.prisma.paso_estudiante.findMany({
    where: {
      pasoBeca: {
        requisito: {
          tipo_requisito: 'ETAPA',
          encargados: {
            some: { usuarioId },
          },
        },
      },
      estado_etapa: {
        in: ['EN_REVISION', 'APROBADO', 'REPROBADO', 'ABANDONADO'],
      },
    },
    include: {
      oficinaRuta: true,
      postulacion: {
        select: {
          ID_postulacion: true,
          gestion: true,

          beca_nombre_historico: true,
          beca_tipo_historico: true,
          beca_historial_capturado: true,

          beca: true,

          estudiante: {
            include: {
              persona: true,
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
    orderBy: [
      { estado_etapa: 'asc' },
      { fecha_completado: 'desc' },
    ],
  });

  return {
    pendientes: rows
      .filter((r) => r.estado_etapa === 'EN_REVISION')
      .map((r) => this.mapEtapaEncargado(r)),

    revisados: rows
      .filter((r) =>
        ['APROBADO', 'REPROBADO', 'ABANDONADO'].includes(String(r.estado_etapa))
      )
      .map((r) => this.mapEtapaEncargado(r)),
  };
}

private mapEtapaEncargado(r: any) {
  return {
    pasoEstudianteId: r.ID_paso_estudiante,
    postulacionId: r.postulacionId,
    pasoBecaId: r.pasoBecaId,

    estado_etapa: r.estado_etapa,
    completado: r.completado,
    fecha_completado: r.fecha_completado,

    nota: r.nota_etapa,
    fecha: r.fecha_etapa,
    descripcion: r.descripcion_etapa,
    texto_extra: r.texto_extra_etapa,

    oficina: r.oficinaRuta
      ? {
          ID_oficina: r.oficinaRuta.ID_oficina,
          nombre: r.oficinaRuta.nombre,
          horario_atencion: r.oficinaRuta.horario_atencion,
        }
      : null,

    beca: {
      ID_beca: r.postulacion.beca.ID_beca,

      nombre: r.postulacion.beca_historial_capturado
        ? r.postulacion.beca_nombre_historico
        : r.postulacion.beca.nombre,

      tipo: r.postulacion.beca_historial_capturado
        ? r.postulacion.beca_tipo_historico
        : r.postulacion.beca.tipo,

      gestion: r.postulacion.gestion,
    },

    estudiante: {
      ID_estudiante: r.postulacion.estudiante.ID_estudiante,
      ci: r.postulacion.estudiante.persona.ci,
      nombre: r.postulacion.estudiante.persona.nombre,
      apellido_paterno: r.postulacion.estudiante.persona.apellido_paterno,
      apellido_materno: r.postulacion.estudiante.persona.apellido_materno,
    },

    requisito: {
      ID_paso: r.pasoBeca.requisito.ID_paso,
      nombre: r.pasoBeca.requisito.nombre,
      requiere_nota: r.pasoBeca.requisito.requiere_nota,
      requiere_fecha_descripcion:
        r.pasoBeca.requisito.requiere_fecha_descripcion,
      requiere_ruta_360: r.pasoBeca.requisito.requiere_ruta_360,
      requiere_otro: r.pasoBeca.requisito.requiere_otro,
    },
  };
}
async aprobarDocumentacionConEtapas(
  id: string,
  dto: {
  nota?: number;
  fecha?: string;
  descripcion?: string;
  textoExtra?: string;
  oficinaRutaId?: number;
},
  usuarioId: number,
) {
  const postulacion = await this.prisma.postulacion.findUnique({
    where: { ID_postulacion: id },
    include: {
      beca: {
        include: {
          pasos: {
            include: { requisito: true },
            orderBy: [{ orden: 'asc' }, { ID_pasosBeca: 'asc' }],
          },
        },
      },
      estudiante: {
        include: {
          persona: {
            include: { usuario: true },
          },
        },
      },
      paso_estudiante: {
        include: {
          pasoBeca: {
            include: { requisito: true },
          },
        },
      },
    },
  });

  if (!postulacion) {
    throw new NotFoundException('Postulación no encontrada.');
  }

  if (postulacion.estado !== 'PENDIENTE') {
    throw new BadRequestException(
      'Solo se puede aprobar documentación de postulaciones pendientes.',
    );
  }

const primeraEtapaBeca = postulacion.beca.pasos.find(
  (p) => p.requisito.tipo_requisito === 'ETAPA',
);

if (!primeraEtapaBeca) {
  throw new BadRequestException(
    'Esta postulación no tiene requisitos-etapa.',
  );
}

const primeraEtapa = postulacion.paso_estudiante.find(
  (p) => p.pasoBecaId === primeraEtapaBeca.ID_pasosBeca,
);

if (!primeraEtapa) {
  throw new BadRequestException(
    'No se encontró la etapa del estudiante.',
  );
}

  const updatedPostulacion = await this.prisma.postulacion.update({
    where: { ID_postulacion: id },
    data: {
      estado: 'HABILITADO',
      observacion: 'La documentación fue aprobada. Se habilitó la primera etapa.',
    },
  });
  await this.registrarCambioEstadoPostulacion({
  postulacionId: id,
  usuarioId,
  accion: 'APROBAR_DOCUMENTACION_ETAPAS',
  detalle: 'Administrador aprobó la documentación. La postulación pasó a HABILITADO.',
  estadoAnterior: postulacion.estado,
  estadoNuevo: 'HABILITADO',
  extraDespues: {
    etapaHabilitadaId: primeraEtapa.ID_paso_estudiante,
  },
});
  const etapaActualizada = await this.prisma.paso_estudiante.update({
    where: {
      ID_paso_estudiante: primeraEtapa.ID_paso_estudiante,
    },
    data: {
      estado_etapa: 'EN_REVISION',
      nota_etapa: dto.nota ?? null,
      fecha_etapa: dto.fecha ? new Date(dto.fecha) : null,
      descripcion_etapa: dto.descripcion,
      texto_extra_etapa: dto.textoExtra,
      oficinaRutaId: dto.oficinaRutaId,
    },
  });

  const usuarioEstudiante =
    postulacion.estudiante.persona.usuario?.ID_usuario;

  if (usuarioEstudiante) {
    await this.postulacionesNotif.notificarResultadoDocumentacionEtapa({
      usuarioId: usuarioEstudiante,
      nombreEtapa: primeraEtapa.pasoBeca.requisito.nombre,
      fecha: dto.fecha,
      descripcion:
        dto.descripcion ||
        `Debe presentarse para la etapa "${primeraEtapa.pasoBeca.requisito.nombre}".`,
      textoExtra: dto.textoExtra,
      nota: dto.nota,
      codigoSeguimiento: postulacion.codigo_seguimiento,
      oficinaRutaId: dto.oficinaRutaId,
    });
  }

  return {
    ok: true,
    message: 'Documentación aprobada. Primera etapa habilitada.',
    postulacion: updatedPostulacion,
    etapa: etapaActualizada,
  };
}
// Cierre automático de trámites vencidos
async cerrarPostulacionesVencidas() {
  const hoy = new Date();

  const postulaciones = await this.prisma.postulacion.findMany({
    where: {
      OR: [
        { estado: 'EN_PROCESO' },
        { estado: 'ABANDONADO', abandono_recuperable: true },
      ],
    },
    include: {
      beca: true,
      paso_estudiante: {
        include: {
          legalizaciones: true,
        },
      },
    },
  });

  let cerradas = 0;

  for (const p of postulaciones) {
    let fechaFin = p.beca.fecha_fin ? new Date(p.beca.fecha_fin) : null;

    if (!fechaFin) {
      const year = Number(p.gestion);
      if (!Number.isNaN(year)) {
        fechaFin = new Date(year, 11, 31, 23, 59, 59);
      }
    }

    if (!fechaFin) continue;

    const fechaLimite = new Date(fechaFin);
    fechaLimite.setDate(fechaLimite.getDate() + 3);

    if (hoy <= fechaLimite) continue;

    const tieneAvanceLegalizacion = p.paso_estudiante.some((paso) =>
      ['EN_REVISION', 'LEGALIZADO'].includes(String(paso.estado_revision)),
    );

    await this.prisma.$transaction(async (tx) => {
      if (!tieneAvanceLegalizacion) {
        await tx.paso_legalizacion_estudiante.deleteMany({
          where: {
            pasoEstudiante: {
              postulacionId: p.ID_postulacion,
            },
          },
        });

        await tx.paso_estudiante.updateMany({
          where: {
            postulacionId: p.ID_postulacion,
          },
          data: {
            completado: false,
            fecha_completado: null,
            notas: null,
            estado_revision: 'NO_REQUIERE',
            observacion_revision: null,
            fecha_revision: null,
            estado_etapa: 'BLOQUEADO',
            nota_etapa: null,
            fecha_etapa: null,
            descripcion_etapa: null,
            texto_extra_etapa: null,
            oficinaRutaId: null,
          },
        });
      } else {
        const pasosPendientes = p.paso_estudiante.filter(
          (paso) => paso.estado_revision === 'PENDIENTE_LEGALIZACION',
        );

        for (const paso of pasosPendientes) {
          await tx.paso_legalizacion_estudiante.deleteMany({
            where: {
              pasoEstudianteId: paso.ID_paso_estudiante,
            },
          });

          await tx.paso_estudiante.update({
            where: {
              ID_paso_estudiante: paso.ID_paso_estudiante,
            },
            data: {
              estado_revision: 'NO_REQUIERE',
              completado: false,
              fecha_completado: null,
              observacion_revision: null,
              fecha_revision: null,
            },
          });
        }
      }

      await tx.postulacion.update({
        where: {
          ID_postulacion: p.ID_postulacion,
        },
        data: {
          estado: 'ABANDONADO',
          abandono_recuperable: false,
          estado_antes_abandono: p.estado_antes_abandono ?? p.estado,
          fecha_abandono: new Date(),
          motivo_abandono:
            'Trámite cerrado automáticamente por vencimiento de convocatoria.',
          observacion:
            'Trámite abandonado automáticamente por vencimiento. No es recuperable.',
        },
      });

      await tx.audit_log.create({
        data: {
          tabla: 'postulacion',
          registroId: p.ID_postulacion,
          accion: 'ABANDONO_AUTOMATICO_POR_VENCIMIENTO',
          usuarioId: null,
          detalle:
            'La postulación fue cerrada automáticamente por vencimiento de convocatoria.',
          antes: {
            estado: p.estado,
            abandono_recuperable: p.abandono_recuperable,
          },
          despues: {
            estado: 'ABANDONADO',
            abandono_recuperable: false,
          },
        },
      });
    });

    cerradas++;
  }

  return {
    ok: true,
    cerradas,
    message: `Se cerraron ${cerradas} postulaciones vencidas.`,
  };
}
// Cambiar estado administrativo con notificación interna
async cambiarEstadoAdministrativo(
  id: string,
  dto: {
    estado: 'REMITIDO_A_DISBECT' | 'NO_REMITIDO';
    observacion?: string;
  },
  usuarioId: number,
) {
  const postulacion = await this.prisma.postulacion.findUnique({
    where: { ID_postulacion: id },
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
  });

  if (!postulacion) {
    throw new NotFoundException('Postulación no encontrada.');
  }

  if (dto.estado === 'REMITIDO_A_DISBECT') {
    if (postulacion.estado !== 'PENDIENTE') {
      throw new BadRequestException(
        'Solo se puede remitir a DISBECT una postulación pendiente.',
      );
    }
  }

  if (dto.estado === 'NO_REMITIDO') {
    if (postulacion.estado !== 'PENDIENTE') {
      throw new BadRequestException(
        'Solo se puede marcar como NO REMITIDO una postulación pendiente.',
      );
    }
  }

  const updated = await this.prisma.postulacion.update({
    where: { ID_postulacion: id },
    data: {
      estado: dto.estado,
      estado_observacion:
        dto.estado === 'REMITIDO_A_DISBECT'
          ? 'NO OBSERVADO'
          : 'NO_REMITIDO',
      observacion:
        dto.observacion ||
        (dto.estado === 'REMITIDO_A_DISBECT'
          ? 'La carpeta fue remitida a DISBECT para revisión administrativa.'
          : 'La carpeta no logró ser remitida a DISBECT.'),
    },
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
  });

await this.registrarCambioEstadoPostulacion({
  postulacionId: id,
  usuarioId,
  accion:
    dto.estado === 'REMITIDO_A_DISBECT'
      ? 'REMITIR_A_DISBECT'
      : 'MARCAR_NO_REMITIDO',
  detalle:
    dto.estado === 'REMITIDO_A_DISBECT'
      ? 'Administrador marcó la postulación como remitida a DISBECT.'
      : 'Administrador marcó la postulación como no remitida.',
  estadoAnterior: postulacion.estado,
  estadoNuevo: updated.estado,
  extraAntes: {
    estado_observacion: postulacion.estado_observacion,
    observacion: postulacion.observacion,
  },
  extraDespues: {
    estado_observacion: updated.estado_observacion,
    observacion: updated.observacion,
  },
});
  const usuarioEstudiante =
    updated.estudiante.persona.usuario?.ID_usuario;

  if (usuarioEstudiante) {
    await this.prisma.notificacionSistema.create({
      data: {
        userId: usuarioEstudiante,
        titulo:
          dto.estado === 'REMITIDO_A_DISBECT'
            ? 'Carpeta remitida a DISBECT'
            : 'Carpeta no remitida',
        mensaje:
          dto.estado === 'REMITIDO_A_DISBECT'
            ? `Su carpeta de postulación a la beca "${updated.beca.nombre}" fue remitida a DISBECT para revisión administrativa.`
            : `Su carpeta de postulación a la beca "${updated.beca.nombre}" no logró ser remitida a DISBECT.`,
        tipo:
          dto.estado === 'REMITIDO_A_DISBECT'
            ? 'INFO'
            : 'WARNING',
        url: updated.codigo_seguimiento
          ? `/seguimiento?codigo=${updated.codigo_seguimiento}`
          : `/becas-disponibles/${updated.beca.ID_beca}`,
      },
    });
  }

  return {
    ok: true,
    message:
      dto.estado === 'REMITIDO_A_DISBECT'
        ? 'Postulación marcada como REMITIDO A DISBECT.'
        : 'Postulación marcada como NO REMITIDO.',
    data: updated,
  };
}
private async registrarCambioEstadoPostulacion(params: {
  postulacionId: string;
  usuarioId?: number | null;
  accion: string;
  detalle: string;
  estadoAnterior?: string | null;
  estadoNuevo: string;
  extraAntes?: any;
  extraDespues?: any;
}) {
  await this.prisma.audit_log.create({
    data: {
      tabla: 'postulacion',
      registroId: params.postulacionId,
      accion: params.accion,
      usuarioId: params.usuarioId ?? null,
      detalle: params.detalle,
      antes: {
        estado: params.estadoAnterior ?? null,
        ...(params.extraAntes ?? {}),
      },
      despues: {
        estado: params.estadoNuevo,
        ...(params.extraDespues ?? {}),
      },
    },
  });
}
async obtenerHistorialEstadosPostulacion(
  id: string,
  usuarioId?: number,
  roles: string[] = [],
) {
  const postulacion = await this.prisma.postulacion.findUnique({
    where: { ID_postulacion: id },
    select: {
      ID_postulacion: true,
      fecha: true,
      estado: true,
      abandono_recuperable: true,
      estudiante: {
        select: {
          persona: {
            select: {
              usuario: {
                select: {
                  ID_usuario: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!postulacion) {
    throw new NotFoundException('Postulación no encontrada.');
  }

  const esAdmin = roles.includes('admin');
  const esPropietario =
    postulacion.estudiante.persona.usuario?.ID_usuario === usuarioId;

  if (!esAdmin && !esPropietario) {
    throw new BadRequestException(
      'No puedes ver el historial de una postulación ajena.',
    );
  }

  const logs = await this.prisma.audit_log.findMany({
    where: {
      tabla: 'postulacion',
      registroId: id,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const estadosPermitidos = [
    'PENDIENTE',
    'HABILITADO',
    'REMITIDO_A_DISBECT',
    'NO_REMITIDO',
    'APROBADO',
    'REPROBADO',
    'ABANDONADO',
  ];

    const historial: {
      estado: string;
      fecha: Date | null;
      accion: string;
    }[] = [
      {
        estado: 'EN_PROCESO',
        fecha: postulacion.fecha,
        accion: 'INICIO_TRAMITE',
      },
      ...logs
        .map((log) => {
          const despues = log.despues as any;
          const estadoNuevo = despues?.estado;

          if (!estadoNuevo) return null;

          if (!estadosPermitidos.includes(String(estadoNuevo))) {
            return null;
          }

          return {
            estado: String(estadoNuevo),
            fecha: log.createdAt,
            accion: log.accion,
          };
        })
        .filter(
          (
            item,
          ): item is {
            estado: string;
            fecha: Date;
            accion: string;
          } => item !== null,
        ),
    ];

  const existeEstadoActual = historial.some(
    (h: any) => h.estado === postulacion.estado,
  );

  if (!existeEstadoActual) {
    historial.push({
      estado: postulacion.estado,
      fecha: null,
      accion: 'ESTADO_ACTUAL_SIN_REGISTRO_DE_AUDITORIA',
    });
  }

  return {
    ok: true,
    postulacionId: id,
    estadoActual: postulacion.estado,
    historial,
  };
}
// private calcularPeriodoPostulacion(fecha = new Date()) {
//   return '1-2027';
// }
private calcularPeriodoPostulacion(fecha = new Date()) {
  const year = fecha.getFullYear();
  const mes = fecha.getMonth() + 1;
  return mes <= 6 ? `1-${year}` : `2-${year}`;
}
// private calcularPeriodoPostulacion(year = new Date().getFullYear()) {
//   const mes = new Date().getMonth() + 1;
//   return mes <= 6 ? `1-${year}` : `2-${year}`;
// }


private async crearPasosYLegalizacion(
  tx: Prisma.TransactionClient,
  postulacionId: string,
  becaId: number,
) {
  const pasos = await tx.pasosPorBeca.findMany({
    where: {
      becaId,
      estado: true,
    },
    include: {
      requisito: {
        include: {
          legalizacion_flujo: {
            where: { activo: true },
            orderBy: { orden: 'asc' },
          },
        },
      },
    },
    orderBy: [{ orden: 'asc' }, { ID_pasosBeca: 'asc' }],
  });

  for (const paso of pasos) {
    const esEtapa = paso.requisito.tipo_requisito === 'ETAPA';
    const requiereLegalizacion = paso.requisito.requiere_legalizacion;

    const pasoEstudiante = await tx.paso_estudiante.create({
      data: {
        postulacionId,
        pasoBecaId: paso.ID_pasosBeca,
        completado: false,
        estado_revision: requiereLegalizacion
          ? 'PENDIENTE_LEGALIZACION'
          : 'NO_REQUIERE',
        estado_etapa: esEtapa ? 'BLOQUEADO' : null,
      },
    });

    if (requiereLegalizacion) {
      if (!paso.requisito.legalizacion_flujo.length) {
        throw new BadRequestException(
          `El requisito "${paso.requisito.nombre}" requiere legalización, pero no tiene flujo configurado.`,
        );
      }

      await tx.paso_legalizacion_estudiante.createMany({
        data: paso.requisito.legalizacion_flujo.map((f, index) => ({
          pasoEstudianteId: pasoEstudiante.ID_paso_estudiante,
          usuarioId: f.usuarioId,
          orden: f.orden,
          estado: 'PENDIENTE_LEGALIZACION',
          activo_revision: index === 0,
          fecha_inicio: index === 0 ? new Date() : null,
        })),
      });
    }
  }
}
async obtenerAbandonoRecuperable(args: {
  gestion: string;
  usuarioId: number;
}) {
  const { gestion, usuarioId } = args;

  const usuario = await this.prisma.usuario.findUnique({
    where: { ID_usuario: usuarioId },
    include: { persona: true },
  });

  if (!usuario?.persona) return null;

  const estudiante = await this.prisma.estudiante.findFirst({
    where: { personaId: usuario.persona.ID_persona },
    select: { ID_estudiante: true },
  });

  if (!estudiante) return null;

  const post = await this.prisma.postulacion.findFirst({
    where: {
      gestion,
      estudianteId: estudiante.ID_estudiante,
      estado: 'ABANDONADO',
      abandono_recuperable: true,
    },
    include: {
      beca: true,
    },
    orderBy: {
      fecha_abandono: 'desc',
    },
  });

  if (!post) return null;

  if (post.beca.fecha_fin && new Date() > new Date(post.beca.fecha_fin)) {
    return null;
  }

  return post;
}
async obtenerUltimaPostulacionGlobal(args: {
  gestion: string;
  usuarioId: number;
}) {
  const { gestion, usuarioId } = args;

  const usuario = await this.prisma.usuario.findUnique({
    where: { ID_usuario: usuarioId },
    include: { persona: true },
  });

  if (!usuario?.persona) return null;

  const estudiante = await this.prisma.estudiante.findFirst({
    where: { personaId: usuario.persona.ID_persona },
    select: { ID_estudiante: true },
  });

  if (!estudiante) return null;

  return this.prisma.postulacion.findFirst({
    where: {
      gestion,
      estudianteId: estudiante.ID_estudiante,
      estado: {
        in: [
          'EN_PROCESO',
          'PENDIENTE',
          'HABILITADO',
          'REMITIDO_A_DISBECT',
          'NO_REMITIDO',
          'APROBADO',
          'REPROBADO',
          'ABANDONADO',
        ],
      },
    },
    include: { beca: true },
    orderBy: [{ fecha: 'desc' }],
  });
}

}