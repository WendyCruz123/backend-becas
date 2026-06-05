import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRequisitoDto } from './dto/create-requisito.dto';
import { UpdateRequisitoDto } from './dto/update-requisito.dto';
import { AttachRequisitoDto } from './dto/attach-requisito.dto';
import { ReordenarPasosBecaDto, UpdatePasoBecaDto } from './dto/update-paso-beca.dto';

@Injectable()
export class RequisitosService {
  constructor(private prisma: PrismaService) {}

async create(dto: CreateRequisitoDto) {
  const {
    encargadoIds,
    legalizacionFlujo,
    entrega_final_usuarioId,
    ...data
  } = dto;

  if (data.tipo_requisito === 'ETAPA' && (!encargadoIds || encargadoIds.length === 0)) {
    throw new BadRequestException('Debe asignar al menos un encargado para un requisito-etapa');
  }

  if (data.requiere_legalizacion) {
    if (!legalizacionFlujo || legalizacionFlujo.length === 0) {
      throw new BadRequestException(
        'Debe configurar al menos un usuario en el flujo de legalización.',
      );
    }

    if (!entrega_final_usuarioId) {
      throw new BadRequestException(
        'Debe seleccionar el encargado final de entrega.',
      );
    }
  }

  return this.prisma.requisito.create({
    data: {
      ...data,
      entrega_final_usuarioId: data.requiere_legalizacion
        ? entrega_final_usuarioId
        : null,
      tipo_requisito: data.tipo_requisito ?? 'DOCUMENTO',

      encargados: encargadoIds?.length
        ? {
            create: encargadoIds.map((usuarioId) => ({ usuarioId })),
          }
        : undefined,

      legalizacion_flujo:
        data.requiere_legalizacion && legalizacionFlujo?.length
          ? {
              create: legalizacionFlujo.map((item) => ({
                usuarioId: Number(item.usuarioId),
                orden: Number(item.orden),
                activo: true,
              })),
            }
          : undefined,
    },
    include: {
      oficina: true,
      entrega_final_usuario: {
        include: { persona: true },
      },
      encargados: {
        include: {
          usuario: {
            include: { persona: true },
          },
        },
      },
      legalizacion_flujo: {
        include: {
          usuario: {
            include: { persona: true },
          },
        },
        orderBy: { orden: 'asc' },
      },
    },
  });
}

  findAll(search?: string) {
    const where = search?.trim()
      ? {
          OR: [
            { nombre: { contains: search, mode: 'insensitive' as const } },
            { descripcion: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    return this.prisma.requisito.findMany({
      where,
      orderBy: { ID_paso: 'asc' },
      include: {
        oficina: true,

        entrega_final_usuario: {
          include: { persona: true },
        },

        legalizacion_flujo: {
          include: {
            usuario: {
              include: { persona: true },
            },
          },
          orderBy: { orden: 'asc' },
        },

        encargados: {
          include: {
            usuario: {
              include: { persona: true },
            },
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const req = await this.prisma.requisito.findUnique({
      where: { ID_paso: id },
      include: {
        oficina: true,

        entrega_final_usuario: {
          include: { persona: true },
        },

        legalizacion_flujo: {
          include: {
            usuario: {
              include: { persona: true },
            },
          },
          orderBy: { orden: 'asc' },
        },

        encargados: {
          include: {
            usuario: {
              include: { persona: true },
            },
          },
        },
      },
    });

    if (!req) throw new NotFoundException('Requisito no encontrado');
    return req;
  }

async update(id: number, dto: UpdateRequisitoDto) {
  await this.ensureReq(id);

  const {
    encargadoIds,
    legalizacionFlujo,
    entrega_final_usuarioId,
    ...data
  } = dto as UpdateRequisitoDto & {
    encargadoIds?: number[];
    legalizacionFlujo?: { usuarioId: number; orden: number }[];
    entrega_final_usuarioId?: number;
  };

  return this.prisma.$transaction(async (tx) => {
    const requiereLegalizacion =
      data.requiere_legalizacion === true;

    if (requiereLegalizacion) {
      if (!legalizacionFlujo || legalizacionFlujo.length === 0) {
        throw new BadRequestException(
          'Debe configurar al menos un usuario en el flujo de legalización.',
        );
      }

      if (!entrega_final_usuarioId) {
        throw new BadRequestException(
          'Debe seleccionar el encargado final de entrega.',
        );
      }
    }

    const updated = await tx.requisito.update({
      where: { ID_paso: id },
      data: {
        ...data,
        ...(entrega_final_usuarioId !== undefined
          ? { entrega_final_usuarioId }
          : {}),
        ...(data.requiere_legalizacion === false
          ? { entrega_final_usuarioId: null }
          : {}),
      },
    });

    if (encargadoIds) {
      await tx.requisito_encargado.deleteMany({
        where: { requisitoId: id },
      });

      if (encargadoIds.length > 0) {
        await tx.requisito_encargado.createMany({
          data: encargadoIds.map((usuarioId) => ({
            requisitoId: id,
            usuarioId,
          })),
          skipDuplicates: true,
        });
      }
    }

    if (legalizacionFlujo) {
      await tx.requisito_legalizacion_flujo.deleteMany({
        where: { requisitoId: id },
      });

      if (data.requiere_legalizacion !== false && legalizacionFlujo.length > 0) {
        await tx.requisito_legalizacion_flujo.createMany({
          data: legalizacionFlujo.map((item) => ({
            requisitoId: id,
            usuarioId: Number(item.usuarioId),
            orden: Number(item.orden),
            activo: true,
          })),
          skipDuplicates: true,
        });
      }
    }

    return tx.requisito.findUnique({
      where: { ID_paso: updated.ID_paso },
      include: {
        oficina: true,
        entrega_final_usuario: {
          include: { persona: true },
        },
        encargados: {
          include: {
            usuario: {
              include: { persona: true },
            },
          },
        },
        legalizacion_flujo: {
          include: {
            usuario: {
              include: { persona: true },
            },
          },
          orderBy: { orden: 'asc' },
        },
      },
    });
  });
}

  async remove(id: number) {
    await this.ensureReq(id);
    return this.prisma.requisito.delete({ where: { ID_paso: id } });
  }

  async listEncargados() {
    return this.prisma.usuario.findMany({
      where: {
        activo: true,
        grupo_usuario: {
          some: {
            fecha_fin: null,
            grupo_rol: {
              nombre: {
                equals: 'ENCARGADO',
                mode: 'insensitive',
              },
            },
          },
        },
      },
      include: {
        persona: true,
      },
      orderBy: {
        persona: {
          nombre: 'asc',
        },
      },
    });
  }

  async listOficinasConRuta360() {
    return this.prisma.oficina.findMany({
      where: {
        estado_oficina: true,
        panorama_route_slug: {
          not: null,
        },
      },
      orderBy: {
        nombre: 'asc',
      },
      include: {
        panoramas: {
          where: { publicado: true },
          orderBy: { orden: 'asc' },
        },
      },
    });
  }

  async listByBeca(becaId: number) {
    await this.ensureBeca(becaId);

    return this.prisma.pasosPorBeca.findMany({
      where: { becaId },
      orderBy: [{ orden: 'asc' }, { ID_pasosBeca: 'asc' }],
      include: {
        requisito: {
  include: {
    oficina: true,

    entrega_final_usuario: {
      include: { persona: true },
    },

    legalizacion_flujo: {
      include: {
        usuario: {
          include: { persona: true },
        },
      },
      orderBy: { orden: 'asc' },
    },

    encargados: {
      include: {
        usuario: {
          include: { persona: true },
        },
      },
    },
  },
},
      },
    });
  }

  async attachToBeca(becaId: number, dto: AttachRequisitoDto) {
    await Promise.all([this.ensureBeca(becaId), this.ensureReq(dto.requisitoId)]);

    try {
      return await this.prisma.pasosPorBeca.create({
        data: {
          becaId,
          requisitoId: dto.requisitoId,
              orden:
      dto.orden ??
      ((await this.prisma.pasosPorBeca.aggregate({
        where: { becaId },
        _max: { orden: true },
      }))._max.orden ?? 0) + 1,
          estado: dto.estado ?? true,
        },
        include: {
          requisito: {
            include: {
              oficina: true,
              encargados: {
                include: {
                  usuario: {
                    include: { persona: true },
                  },
                },
              },
            },
          },
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new BadRequestException('Este requisito ya está asignado a esta beca');
      }
      throw e;
    }
  }

  async updatePaso(pasoBecaId: number, dto: UpdatePasoBecaDto) {
    await this.ensurePaso(pasoBecaId);

    return this.prisma.pasosPorBeca.update({
      where: { ID_pasosBeca: pasoBecaId },
      data: {
        orden: dto.orden ?? undefined,
        estado: dto.estado ?? undefined,
      },
      include: {
        requisito: true,
      },
    });
  }

  async reordenarPasos(becaId: number, dto: ReordenarPasosBecaDto) {
    await this.ensureBeca(becaId);

    return this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.pasosPorBeca.update({
          where: { ID_pasosBeca: Number(item.pasoBecaId) },
          data: { orden: Number(item.orden) },
        }),
      ),
    );
  }

  async detachFromBeca(pasoBecaId: number) {
    await this.ensurePaso(pasoBecaId);
    return this.prisma.pasosPorBeca.delete({
      where: { ID_pasosBeca: pasoBecaId },
    });
  }

  private async ensureReq(id: number) {
    const exists = await this.prisma.requisito.findUnique({
      where: { ID_paso: id },
      select: { ID_paso: true },
    });
    if (!exists) throw new NotFoundException('Requisito no encontrado');
  }

  private async ensureBeca(id: number) {
    const exists = await this.prisma.beca.findUnique({
      where: { ID_beca: id },
      select: { ID_beca: true },
    });
    if (!exists) throw new NotFoundException('Beca no encontrada');
  }

  private async ensurePaso(id: number) {
    const exists = await this.prisma.pasosPorBeca.findUnique({
      where: { ID_pasosBeca: id },
      select: { ID_pasosBeca: true },
    });
    if (!exists) throw new NotFoundException('Paso de beca no encontrado');
  }
  async listUsuariosLegalizacion() {
  return this.prisma.usuario.findMany({
    where: {
      activo: true,
      grupo_usuario: {
        some: {
          fecha_fin: null,
          grupo_rol: {
            nombre: {
              in: ['kardex', 'admin', 'director'],
              mode: 'insensitive',
            },
          },
        },
      },
    },
    include: {
      persona: true,
      grupo_usuario: {
        include: {
          grupo_rol: true,
        },
      },
    },
    orderBy: {
      persona: {
        nombre: 'asc',
      },
    },
  });
}
}