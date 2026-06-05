import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OficinasService } from './oficinas.service';
import { CreateOficinaDto } from './dto/create-oficina.dto';
import { UpdateOficinaDto } from './dto/update-oficina.dto';
import { ListOficinasDto } from './dto/list-oficinas.dto';
import { SetEncargadoDto } from './dto/set-encargado.dto';

@Controller('oficinas')
export class OficinasController {
  constructor(private readonly service: OficinasService) {}

  @Post()
  create(@Body() dto: CreateOficinaDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() q: ListOficinasDto) {
    return this.service.findAll(q);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOficinaDto) {
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }

  // Encargado actual (solo lectura)
  @Get(':id/encargado-actual')
  encargado(@Param('id') id: string) {
    return this.service.getEncargadoActual(+id);
  }

  // Definir/cambiar encargado
  @Post(':id/encargado')
  setEncargado(@Param('id') id: string, @Body() dto: SetEncargadoDto) {
    return this.service.setEncargado(+id, dto);
  }

  // Panoramas de la oficina
  @Get(':id/panoramas')
  panoramas(@Param('id') id: string) {
    return this.service.listPanoramas(+id);
  }
}
