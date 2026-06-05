import { Module } from '@nestjs/common';
import { CargoAdministrativoService } from './cargo-administrativo.service';
import { CargoAdministrativoController } from './cargo-administrativo.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CargoAdministrativoController],
  providers: [CargoAdministrativoService, PrismaService],
})
export class CargoAdministrativoModule {}
