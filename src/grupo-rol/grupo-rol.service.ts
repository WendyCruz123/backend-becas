import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGrupoRolDto } from './dto/create-grupo-rol.dto';
import { UpdateGrupoRolDto } from './dto/update-grupo-rol.dto';

@Injectable()
export class GrupoRolService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateGrupoRolDto) {
    try {
      return await this.prisma.grupo_rol.create({ data: dto });
    } catch (e:any) {
      if (e.code === 'P2002') throw new BadRequestException('Ya existe un rol con ese nombre');
      throw e;
    }
  }

  async findAll({ limit = 20, offset = 0, search = '' }: {limit?: number; offset?: number; search?: string}) {
    const where = search
      ? { OR: [{ nombre: { contains: search, mode: 'insensitive' as const } }, { descripcion: { contains: search, mode: 'insensitive' as const } }] }
      : {};
    const [rows, count] = await this.prisma.$transaction([
      this.prisma.grupo_rol.findMany({ where, skip: offset, take: limit, orderBy: { nombre: 'asc' } }),
      this.prisma.grupo_rol.count({ where }),
    ]);
    return { count, rows };
  }

  async findOne(id: number) {
    const rol = await this.prisma.grupo_rol.findUnique({ where: { ID_grupo_rol: id } });
    if (!rol) throw new NotFoundException('Rol no encontrado');
    return rol;
  }

  async update(id: number, dto: UpdateGrupoRolDto) {
    await this.findOne(id);
    return this.prisma.grupo_rol.update({ where: { ID_grupo_rol: id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.grupo_rol.delete({ where: { ID_grupo_rol: id } });
  }
}
