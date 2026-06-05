import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificacionesSistemaController } from './notificaciones-sistema.controller';
import { NotificacionesSistemaService } from './notificaciones-sistema.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificacionesSistemaController],
  providers: [NotificacionesSistemaService],
  exports: [NotificacionesSistemaService],
})
export class NotificacionesSistemaModule {}