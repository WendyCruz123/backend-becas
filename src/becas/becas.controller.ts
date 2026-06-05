import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { BecasService } from './becas.service';
import { CreateBecaDto } from './dto/create-beca.dto';
import { UpdateBecaDto } from './dto/update-beca.dto';
import { ListBecasDto } from './dto/list-becas.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';

@Controller('becas')
export class BecasController {
  constructor(private readonly service: BecasService) {}

  @Post()
  create(@Body() dto: CreateBecaDto) {
    return this.service.create(dto);
  }

  // listado con paginación/búsqueda e include opcional
  @Get()
  findAll(@Query() q: ListBecasDto) {
    return this.service.findAll(q);
  }
  @Get('mis-registros/historial')
misRegistrosHistorial(
  @Query('usuarioId') usuarioId: string,
  @Query('gestion') gestion?: string,
  @Query('search') search?: string,
  @Query('limit') limit?: string,
  @Query('offset') offset?: string,
) {
  return this.service.misRegistrosHistorial({
    usuarioId: Number(usuarioId),
    gestion,
    search,
    limit: limit ? Number(limit) : 12,
    offset: offset ? Number(offset) : 0,
  });
}
  // solo detalle: incluye relaciones completas
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBecaDto) {
    return this.service.update(+id, dto);
  }

  // activar/desactivar (soft delete)
  @Patch(':id/estado')
  toggleEstado(@Param('id') id: string, @Body() body: { estado: boolean }) {
    return this.service.toggleEstado(+id, body.estado);
  }

  // eliminar definitivamente (hard delete)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }

  // vigentes por fecha actual (con paginación/búsqueda opcional)
  @Get('filtro/vigentes/list')
  vigentes(@Query() q: ListBecasDto) {
    return this.service.vigentes(q);
  }
}
