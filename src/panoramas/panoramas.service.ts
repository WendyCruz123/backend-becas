import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePanoramaDto } from './dto/create-panorama.dto';
import { UpdatePanoramaDto } from './dto/update-panorama.dto';

@Injectable()
export class PanoramasService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreatePanoramaDto) {
  const data: any = {
    name: dto.name,
    fileUrl: dto.fileUrl,
    publicado: dto.publicado ?? false,
    orden: dto.orden ?? 0,
    es_portada: dto.es_portada ?? false,
  };

  if (dto.projection) {
    data.projection = dto.projection;
  }

  if (dto.oficina_id) {
    data.oficina = {
      connect: { ID_oficina: dto.oficina_id },
    };
  }

  if (dto.rutaId) {
    data.ruta = {
      connect: { id: dto.rutaId },
    };
  }

  return this.prisma.panorama.create({
    data,
  });
}

  findAll(rutaId?: string) {
    return this.prisma.panorama.findMany({
      where: rutaId
        ? {
            rutaId,
          }
        : undefined,

      orderBy: [
        { es_portada: 'desc' },
        { orden: 'asc' },
        { createdAt: 'asc' },
      ],

      include: {
        hotspots: {
          where: { activo: true },
          include: { link: true },
          orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
        },

        ruta: true,

        oficina: {
          select: {
            ID_oficina: true,
            nombre: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const pano = await this.prisma.panorama.findUnique({
      where: { id },
      include: {
        oficina: true, // nombre, horario, etc.
        hotspots: {
          where: { activo: true },
          orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
          include: { link: true },
        },
      },
    });
    if (!pano) throw new NotFoundException('Panorama no encontrado');

    // encargado vigente de esa oficina
    const encargado_actual = pano.oficina_id
  ? await this.prisma.encargado_oficina.findFirst({
      where: { oficinaId: pano.oficina_id, estado: true, fecha_fin: null },
      orderBy: { fecha_inicio: 'desc' },
    })
  : null;

    return { ...pano, encargado_actual };
  }


    async update(id: string, dto: UpdatePanoramaDto) {
      await this.ensureExists(id);

      const data: any = {};

      if (dto.name !== undefined) data.name = dto.name;
      if (dto.fileUrl !== undefined) data.fileUrl = dto.fileUrl;
      if (dto.projection !== undefined) data.projection = dto.projection;
      if (dto.publicado !== undefined) data.publicado = dto.publicado;
      if (dto.orden !== undefined) data.orden = dto.orden;
      if (dto.es_portada !== undefined) data.es_portada = dto.es_portada;

      if (dto.oficina_id) {
        data.oficina = {
          connect: { ID_oficina: dto.oficina_id },
        };
      }

      if (dto.rutaId) {
        data.ruta = {
          connect: { id: dto.rutaId },
        };
      }

      return this.prisma.panorama.update({
        where: { id },
        data,
      });
    }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.panorama.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.panorama.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Panorama no encontrado');
  }
}
