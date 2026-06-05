import { Module } from '@nestjs/common';
import { RequisitosService } from './requisitos.service';
import { RequisitosController } from './requisitos.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [RequisitosController],
  providers: [RequisitosService, PrismaService],
  exports: [RequisitosService],
})
export class RequisitosModule {}
