import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Rutas360Service } from './rutas360.service';

@Controller('rutas360')
export class Rutas360Controller {
  constructor(private readonly service: Rutas360Service) {}

  @Post()
  create(@Body() body: { nombre: string; slug?: string }) {
    return this.service.create(body);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}