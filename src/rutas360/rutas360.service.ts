import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function makeSlug(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

@Injectable()
export class Rutas360Service {
  constructor(private prisma: PrismaService) {}

  async create(body: { nombre: string; slug?: string }) {
    const nombre = body.nombre?.trim();

    if (!nombre) {
      throw new BadRequestException('El nombre de la ruta es obligatorio');
    }

    const slug = makeSlug(body.slug || nombre);

    const exists = await this.prisma.ruta_360.findUnique({
      where: { slug },
    });

    if (exists) {
      throw new BadRequestException('Ya existe una ruta con ese nombre o slug');
    }

    return this.prisma.ruta_360.create({
      data: {
        nombre,
        slug,
      },
    });
  }

  findAll() {
    return this.prisma.ruta_360.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        panoramas: {
          select: {
            id: true,
            name: true,
            fileUrl: true,
            es_portada: true,
            publicado: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    const ruta = await this.prisma.ruta_360.findUnique({
      where: { slug },
      include: {
        panoramas: {
          include: {
            hotspots: {
              where: { activo: true },
              include: { link: true },
              orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ruta) {
      throw new NotFoundException('Ruta 360 no encontrada');
    }

    return ruta;
  }

  async remove(id: string) {
    const ruta = await this.prisma.ruta_360.findUnique({
      where: { id },
      include: { panoramas: true },
    });

    if (!ruta) {
      throw new NotFoundException('Ruta 360 no encontrada');
    }

    await this.prisma.hotspotLink.deleteMany({
      where: {
        OR: [
          {
            hotspot: {
              panorama: {
                rutaId: id,
              },
            },
          },
          {
            targetPanorama: {
              rutaId: id,
            },
          },
        ],
      },
    });

    await this.prisma.hotspot.deleteMany({
      where: {
        panorama: {
          rutaId: id,
        },
      },
    });

    await this.prisma.panorama.deleteMany({
      where: { rutaId: id },
    });

    return this.prisma.ruta_360.delete({
      where: { id },
    });
  }
}