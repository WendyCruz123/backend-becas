import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { UpdatePersonaDto } from './dto/update-persona.dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PersonaService {
  private readonly logger = new Logger('PersonaService');

  constructor(private readonly prisma: PrismaService) {}

  // persona.service.ts (create)
async create(createPersonaDto: CreatePersonaDto) {
  try {
    const {
      ru,
      promedio,
      numero_Materias_Reprobadas,
      año_ingreso,
      semestre,
      ...dto
    } = createPersonaDto;

    dto.correo_electronico = dto.correo_electronico.trim().toLowerCase();

    if (dto.fecha_nacimiento) {
      dto.fecha_nacimiento = new Date(dto.fecha_nacimiento).toISOString();
    }

    const persona = await this.prisma.persona.create({ data: dto });

    const username = dto.correo_electronico;
    const plainPassword = `${dto.ci}#cfea`;
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    await this.prisma.usuario.create({
      data: {
        username,
        password: hashedPassword,
        persona: { connect: { ID_persona: persona.ID_persona } },
      },
    });

    if (
      promedio !== undefined &&
      numero_Materias_Reprobadas !== undefined &&
      año_ingreso !== undefined
    ) {
      await this.prisma.estudiante.create({
        data: {
          personaId: persona.ID_persona,
          ru: ru ?? 0,
          promedio,
          numero_Materias_Reprobadas,
          año_ingreso,
          semestre: !!semestre,
        },
      });
    }

    return {
      status: 'success',
      message: 'Persona, usuario y datos académicos creados correctamente',
      data: { persona, usuario: { username } },
    };
  } catch (error) {
    this.handleDBExceptions(error);
  }
}

  async findAll(paginationDto: PaginationDto) {
    const { limit = 10, offset = 0, search = '' } = paginationDto;

    const where =
      search.trim() !== ''
        ? {OR: [
              { ci: { contains: search, mode: 'insensitive' as const} },
              { nombre: { contains: search, mode: 'insensitive' as const } },
              { apellido_paterno: { contains: search, mode: 'insensitive' as const } },
              { apellido_materno: { contains: search, mode: 'insensitive' as const} },
        ]}
        : {};

    const [rows, count] = await Promise.all([
      this.prisma.persona.findMany({
        skip: offset,
        take: limit,
        where,
        orderBy: [
          { apellido_paterno: 'asc' },
          { apellido_materno: 'asc' },
          { nombre: 'asc' },
        ],
        include: {
          usuario: true,
          estudiante: true,
        },
      }),
      this.prisma.persona.count({ where }),
    ]);

    if (rows.length === 0) {
      throw new NotFoundException(`No se encontraron personas con "${search}"`);
    }

    return {
      status: 'success',
      message: 'Datos recuperados exitosamente',
      data: { count, rows },
    };
  }

  async findOne(id: number) {
    const persona = await this.prisma.persona.findUnique({
      where: { ID_persona: id },
      include: {
        usuario: true,
        estudiante: true,
      },
    });

    if (!persona) {
      throw new NotFoundException(`Persona con ID ${id} no encontrada`);
    }

    return {
      status: 'success',
      message: 'Persona encontrada',
      data: persona,
    };
  }

// persona.service.ts (update)
async update(id: number, updateDto: UpdatePersonaDto) {
  try {
    const {
      ru,
      promedio,
      numero_Materias_Reprobadas,
      año_ingreso,
      semestre,
      ...data
    } = updateDto;

    if (data.correo_electronico) {
      data.correo_electronico = data.correo_electronico.trim().toLowerCase();
    }

    if (data.fecha_nacimiento) {
      data.fecha_nacimiento = new Date(data.fecha_nacimiento).toISOString();
    }

    const personaBefore = await this.prisma.persona.findUnique({
      where: { ID_persona: id },
      include: { usuario: true },
    });

    const persona = await this.prisma.persona.update({
      where: { ID_persona: id },
      data,
    });

    if (
      data.correo_electronico &&
      personaBefore?.usuario &&
      personaBefore.usuario.username === personaBefore.correo_electronico
    ) {
      await this.prisma.usuario.update({
        where: { ID_usuario: personaBefore.usuario.ID_usuario },
        data: { username: persona.correo_electronico },
      });
    }

    if (
      promedio !== undefined ||
      numero_Materias_Reprobadas !== undefined ||
      año_ingreso !== undefined ||
      semestre !== undefined ||
      ru !== undefined
    ) {
      await this.prisma.estudiante.upsert({
        where: { personaId: id },
        update: {
          ...(ru !== undefined && { ru }),
          ...(promedio !== undefined && { promedio }),
          ...(numero_Materias_Reprobadas !== undefined && {
            numero_Materias_Reprobadas,
          }),
          ...(año_ingreso !== undefined && { año_ingreso }),
          ...(semestre !== undefined && { semestre }),
        },
        create: {
          personaId: id,
          ru: ru ?? 0,
          promedio: promedio ?? 0,
          numero_Materias_Reprobadas: numero_Materias_Reprobadas ?? 0,
          año_ingreso: año_ingreso ?? new Date().getFullYear(),
          semestre: semestre ?? false,
        },
      });
    }

    return {
      status: 'success',
      message: 'Persona y datos académicos actualizados correctamente',
      data: persona,
    };
  } catch (error: any) {
    this.handleDBExceptions(error);
  }
}
  async remove(id: number) {
    const persona = await this.prisma.persona.findUnique({
      where: { ID_persona: id },
    });

    if (!persona) {
      throw new NotFoundException(`No se encontró la persona con ID ${id}`);
    }

    await this.prisma.persona.delete({ where: { ID_persona: id } });

    return {
      status: 'success',
      message: 'Persona eliminada correctamente',
    };
  }

 private handleDBExceptions(error: any) {
  if (error.code === 'P2002') {
    const target = error.meta?.target?.join(', ') || 'dato único';
    if (target.includes('correo_electronico')) {
      throw new BadRequestException('Ese correo ya está registrado');
    }
    throw new BadRequestException(`Ya existe un registro con el campo único: ${target}`);
  }
  this.logger.error(error);
  throw new InternalServerErrorException('Error inesperado, revise los logs del servidor.');
}

}
