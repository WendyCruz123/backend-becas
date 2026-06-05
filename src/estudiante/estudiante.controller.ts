import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { EstudianteService } from './estudiante.service';
import { CreateEstudianteDto } from './dto/create-estudiante.dto';
import { UpdateEstudianteDto } from './dto/update-estudiante.dto';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('estudiante')
export class EstudianteController {
  constructor(private readonly estudianteService: EstudianteService) {}

  // 🔹 Obtener los datos del estudiante por personaId
  @Get('me/:personaId')
  findMine(@Param('personaId', ParseIntPipe) personaId: number) {
    return this.estudianteService.findByPersona(personaId);
  }

  // 🔹 Crear el registro de estudiante (primer llenado)
  @Post(':personaId')
  create(
    @Param('personaId', ParseIntPipe) personaId: number,
    @Body() dto: CreateEstudianteDto,
  ) {
    return this.estudianteService.create(personaId, dto);
  }

  // 🔹 Actualizar datos del estudiante
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstudianteDto,
  ) {
    return this.estudianteService.update(id, dto);
  }
}
