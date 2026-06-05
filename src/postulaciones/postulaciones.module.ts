import { Module } from '@nestjs/common';
import { PostulacionesService } from './postulaciones.service';
import { PostulacionesController } from './postulaciones.controller';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PostulacionesNotifController } from './postulaciones-notif.controller';
import { PostulacionesNotifService } from './postulaciones-notif.service';

@Module({
  imports: [PrismaModule, NotificationsModule], // 👈 agrega este import
  controllers: [PostulacionesController, PostulacionesNotifController],
  providers: [PostulacionesService, PostulacionesNotifService], 
  exports: [PostulacionesService, PostulacionesNotifService],
})
export class PostulacionesModule {}
