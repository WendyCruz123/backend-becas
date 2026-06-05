import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequisitosService } from './requisitos.service';
import { CreateRequisitoDto } from './dto/create-requisito.dto';
import { UpdateRequisitoDto } from './dto/update-requisito.dto';
import { AttachRequisitoDto } from './dto/attach-requisito.dto';
import { ReordenarPasosBecaDto, UpdatePasoBecaDto } from './dto/update-paso-beca.dto';

@Controller()
export class RequisitosController {
  constructor(private readonly service: RequisitosService) {}

  @Post('requisitos')
  create(@Body() dto: CreateRequisitoDto) {
    return this.service.create(dto);
  }

  @Get('requisitos')
  findAll(@Query('search') search?: string) {
    return this.service.findAll(search);
  }

  @Get('requisitos/encargados')
  listEncargados() {
    return this.service.listEncargados();
  }

  @Get('requisitos/oficinas-ruta-360')
  listOficinasConRuta360() {
    return this.service.listOficinasConRuta360();
  }
  @Get('requisitos/usuarios-legalizacion')
    listUsuariosLegalizacion() {
      return this.service.listUsuariosLegalizacion();
    }
  @Get('requisitos/:id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch('requisitos/:id')
  update(@Param('id') id: string, @Body() dto: UpdateRequisitoDto) {
    return this.service.update(+id, dto);
  }

  @Delete('requisitos/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }

  @Get('becas/:becaId/requisitos')
  listByBeca(@Param('becaId') becaId: string) {
    return this.service.listByBeca(+becaId);
  }

  @Post('becas/:becaId/requisitos')
  attach(@Param('becaId') becaId: string, @Body() dto: AttachRequisitoDto) {
    return this.service.attachToBeca(+becaId, dto);
  }

  @Patch('becas/:becaId/requisitos/reordenar')
  reordenar(@Param('becaId') becaId: string, @Body() dto: ReordenarPasosBecaDto) {
    return this.service.reordenarPasos(+becaId, dto);
  }

  @Patch('pasos-beca/:pasoBecaId')
  updatePaso(@Param('pasoBecaId') pasoBecaId: string, @Body() dto: UpdatePasoBecaDto) {
    return this.service.updatePaso(+pasoBecaId, dto);
  }

  @Delete('pasos-beca/:pasoBecaId')
  detach(@Param('pasoBecaId') pasoBecaId: string) {
    return this.service.detachFromBeca(+pasoBecaId);
  }
}