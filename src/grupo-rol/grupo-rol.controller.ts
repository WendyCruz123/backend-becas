import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { GrupoRolService } from './grupo-rol.service';
import { CreateGrupoRolDto } from './dto/create-grupo-rol.dto';
import { UpdateGrupoRolDto } from './dto/update-grupo-rol.dto';

@Controller('grupo-rol')
export class GrupoRolController {
  constructor(private readonly service: GrupoRolService) {}

  @Post()
  create(@Body() dto: CreateGrupoRolDto) { return this.service.create(dto); }

  @Get()
  list(@Query() q: { limit?: number; offset?: number; search?: string }) { return this.service.findAll(q); }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.findOne(+id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGrupoRolDto) { return this.service.update(+id, dto); }

  @Delete(':id')
  del(@Param('id') id: string) { return this.service.remove(+id); }
}
