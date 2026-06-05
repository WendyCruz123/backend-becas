import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CargoAdministrativoService } from './cargo-administrativo.service';
import { CreateCargoDto } from './dto/create-cargo.dto';
import { UpdateCargoDto } from './dto/update-cargo.dto';

@Controller('cargo-administrativo')
export class CargoAdministrativoController {
  constructor(private readonly service: CargoAdministrativoService) {}

  @Post()
  create(@Body() dto: CreateCargoDto) { return this.service.create(dto); }

  @Get()
  list(@Query() q: { limit?: number; offset?: number; usuarioId?: number }) { return this.service.findAll(q); }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.findOne(+id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCargoDto) { return this.service.update(+id, dto); }

  // atajo para cerrar hoy y desactivar
  @Patch(':id/cerrar')
  cerrar(@Param('id') id: string) {
    const hoyIso = new Date().toISOString();
    return this.service.update(+id, { estado_cargo: false, fecha_fin: hoyIso } as any);
  }

  // atajo para reabrir (fecha_fin = null) y activar, validando que no haya otro vigente
  @Patch(':id/reabrir')
  reabrir(@Param('id') id: string) {
    return this.service.update(+id, { estado_cargo: true, fecha_fin: null } as any);
  }

  @Delete(':id')
  del(@Param('id') id: string) { return this.service.remove(+id); }
}
