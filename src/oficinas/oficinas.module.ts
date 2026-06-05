import { Module } from '@nestjs/common';
import { OficinasService } from './oficinas.service';
import { OficinasController } from './oficinas.controller';

@Module({
  controllers: [OficinasController],
  providers: [OficinasService],
  exports: [OficinasService],
})
export class OficinasModule {}
