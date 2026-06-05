import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NotificacionesSistemaService {
  constructor(private readonly prisma: PrismaService) {}

  async misNotificaciones(userId: number) {
    const rows = await this.prisma.notificacionSistema.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const noLeidas = await this.prisma.notificacionSistema.count({
      where: { userId, leido: false },
    });

    return { rows, noLeidas };
  }

  async marcarLeida(userId: number, id: string) {
    const notif = await this.prisma.notificacionSistema.findFirst({
      where: { id, userId },
    });

    if (!notif) {
      throw new NotFoundException('Notificación no encontrada.');
    }

    return this.prisma.notificacionSistema.update({
      where: { id },
      data: { leido: true },
    });
  }

  async marcarTodasLeidas(userId: number) {
    return this.prisma.notificacionSistema.updateMany({
      where: { userId, leido: false },
      data: { leido: true },
    });
  }
}