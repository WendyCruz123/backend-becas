import { Module } from '@nestjs/common';
import { GrupoUsuarioService } from './grupo-usuario.service';
import { GrupoUsuarioController } from './grupo-usuario.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [GrupoUsuarioController],
  providers: [GrupoUsuarioService, PrismaService],
  exports: [GrupoUsuarioService],
})
export class GrupoUsuarioModule {}
