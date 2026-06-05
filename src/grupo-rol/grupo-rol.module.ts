import { Module } from '@nestjs/common';
import { GrupoRolService } from './grupo-rol.service';
import { GrupoRolController } from './grupo-rol.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [GrupoRolController],
  providers: [GrupoRolService, PrismaService],
  exports: [GrupoRolService],
})
export class GrupoRolModule {}
