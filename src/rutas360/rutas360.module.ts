import { Module } from '@nestjs/common';
import { Rutas360Service } from './rutas360.service';
import { Rutas360Controller } from './rutas360.controller';

@Module({
  providers: [Rutas360Service],
  controllers: [Rutas360Controller],
})
export class Rutas360Module {}