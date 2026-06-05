import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHotspotDto } from './dto/create-hotspot.dto';
import { UpdateHotspotDto } from './dto/update-hotspot.dto';
import { HotspotType } from '@prisma/client';

@Injectable()
export class HotspotsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateHotspotDto) {
    await this.ensurePanorama(dto.panoramaId);
    if (dto.type === HotspotType.LINK) {
      if (!dto.targetPanoramaId) throw new BadRequestException('targetPanoramaId es requerido para LINK');
      await this.ensurePanorama(dto.targetPanoramaId);
    }

    return this.prisma.$transaction(async (tx) => {
      const hotspot = await tx.hotspot.create({
        data: {
          panoramaId: dto.panoramaId,
          type: dto.type,
          x: dto.x, y: dto.y, z: dto.z,
          icon: dto.icon,
          titulo: dto.title,
          contenido: dto.content,
          orden: dto.orderIndex,
          activo: dto.isActive ?? true,
        },
      });

      if (dto.type === HotspotType.LINK) {
        await tx.hotspotLink.create({
          data: {
            hotspotId: hotspot.id,
            targetPanoramaId: dto.targetPanoramaId!,
            transition: dto.transition,
          },
        });
      }

      return tx.hotspot.findUnique({
        where: { id: hotspot.id },
        include: { link: true },
      });
    });
  }

findByPanorama(panoramaId?: string) {
  if (!panoramaId) {
    throw new BadRequestException('panoramaId es requerido');
  }

  return this.prisma.hotspot.findMany({
    where: {
      panoramaId,
      activo: true,
    },
    orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    include: { link: true },
  });
}

  async update(id: string, dto: UpdateHotspotDto) {
    const existing = await this.prisma.hotspot.findUnique({
      where: { id },
      include: { link: true },
    });
    if (!existing) throw new NotFoundException('Hotspot no encontrado');

    if (dto.type && dto.type === HotspotType.LINK) {
      const target = dto.targetPanoramaId ?? existing.link?.targetPanoramaId;
      if (!target) throw new BadRequestException('targetPanoramaId es requerido para LINK');
      await this.ensurePanorama(target);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.hotspot.update({
        where: { id },
        data: {
          panoramaId: dto.panoramaId ?? existing.panoramaId,
          type: dto.type ?? existing.type,
          x: dto.x ?? existing.x,
          y: dto.y ?? existing.y,
          z: dto.z ?? existing.z,
          icon: dto.icon ?? existing.icon,
          titulo: dto.title ?? existing.titulo,
          contenido: dto.content ?? existing.contenido,
          orden: dto.orderIndex ?? existing.orden,
          activo: dto.isActive ?? existing.activo,
        },
      });

      const finalType = dto.type ?? existing.type;
      if (finalType === HotspotType.LINK) {
        const target = dto.targetPanoramaId ?? existing.link?.targetPanoramaId!;
        if (existing.link) {
          await tx.hotspotLink.update({
            where: { hotspotId: id },
            data: { targetPanoramaId: target, transition: dto.transition ?? existing.link.transition },
          });
        } else {
          await tx.hotspotLink.create({
            data: { hotspotId: id, targetPanoramaId: target, transition: dto.transition },
          });
        }
      } else if (existing.link) {
        await tx.hotspotLink.delete({ where: { hotspotId: id } });
      }

      return tx.hotspot.findUnique({
        where: { id },
        include: { link: true },
      });
    });
  }

  async remove(id: string) {
    await this.ensureHotspot(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.hotspotLink.deleteMany({ where: { hotspotId: id } });
      return tx.hotspot.delete({ where: { id } });
    });
  }

  private async ensurePanorama(id: string) {
    const exists = await this.prisma.panorama.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new BadRequestException('Panorama no existe: ' + id);
  }
  private async ensureHotspot(id: string) {
    const exists = await this.prisma.hotspot.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Hotspot no encontrado');
  }
}
