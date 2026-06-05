import { Module } from '@nestjs/common';
import { EstudianteService } from './estudiante.service';
import { EstudianteController } from './estudiante.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [EstudianteController],
  providers: [EstudianteService, PrismaService],
  exports: [EstudianteService],
})
export class EstudianteModule {}
