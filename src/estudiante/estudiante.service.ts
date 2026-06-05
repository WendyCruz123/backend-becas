import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEstudianteDto } from './dto/create-estudiante.dto';
import { UpdateEstudianteDto } from './dto/update-estudiante.dto';
import { estudiante as Estudiante } from '@prisma/client';

@Injectable()
export class EstudianteService {
  private readonly logger = new Logger('EstudianteService');

  constructor(private readonly prisma: PrismaService) {}

  // Crear nuevo registro de estudiante
  async create(personaId: number, dto: CreateEstudianteDto) {
    try {
      const existing = await this.prisma.estudiante.findUnique({ where: { personaId } });
      if (existing) {
        throw new BadRequestException('El estudiante ya tiene un registro.');
      }

      const estudiante = await this.prisma.estudiante.create({
        data: { ...dto, personaId },
      });

      return {
        status: 'success',
        message: 'Datos académicos guardados correctamente.',
        data: estudiante,
      };
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  // Obtener registro por persona
  async findByPersona(personaId: number) {
    const estudiante = await this.prisma.estudiante.findUnique({ where: { personaId } });
    if (!estudiante) {
      throw new NotFoundException('No se encontró registro de estudiante para esta persona.');
    }

    return {
  status: 'success',
  message: 'Datos encontrados.',
  data: {
    ...estudiante,
    evaluacion: this.evaluarElegibilidad(estudiante),
  },
    };
  }

  // Actualizar estudiante
  async update(id: number, dto: UpdateEstudianteDto) {
    try {
      const estudiante = await this.prisma.estudiante.update({
        where: { ID_estudiante: id },
        data: dto,
      });

      return {
        status: 'success',
        message: 'Datos del estudiante actualizados correctamente.',
        data: estudiante,
      };
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  // === REGLAS DE ELEGIBILIDAD ===
private evaluarElegibilidad(
  e: Estudiante
): { puedePostular: boolean; razones: string[] } {
  const razones: string[] = [];
  const anios = new Date().getFullYear() - e.año_ingreso;

  if (e.numero_Materias_Reprobadas >= 3) razones.push('Tiene 3 o más materias reprobadas.');
  if ( anios >= 7 || anios <= 1) razones.push('No cumple con el requisito de antigüedad (entre 1 y 7 años).');
  if (e.semestre) razones.push('Cursa materias de 3er semestre.');

  return {
    puedePostular: razones.length === 0,
    razones,
  };
}

  // === MANEJO DE ERRORES ===
   private handleDBExceptions(error: any): never {
    if (error instanceof HttpException) {
      throw error;
    }

    if (error.code === 'P2002') {
      throw new BadRequestException(
        'Ya existe un registro con el mismo valor único.',
      );
    }

    if (error.code === 'P2025') {
      throw new NotFoundException('No se encontró el registro solicitado.');
    }

    this.logger.error(error);
    throw new InternalServerErrorException(
      'Error inesperado. Verifique los logs del servidor.',
    );
  }
}
