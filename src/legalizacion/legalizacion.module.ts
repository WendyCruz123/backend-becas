import { Module } from '@nestjs/common';
import { LegalizacionController } from './legalizacion.controller';
import { LegalizacionService } from './legalizacion.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [LegalizacionController],
  providers: [LegalizacionService],
  exports: [LegalizacionService],
})
export class LegalizacionModule {}