import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignRoleDto } from './dto/assign-roles.dto';
import { UpdateRolePeriodDto } from './dto/update-role-period.dto';

@Injectable()
export class GrupoUsuarioService {
  constructor(private prisma: PrismaService) {}

  // ------- helpers -------
  private validateRange(ini?: string, fin?: string | null) {
    if (ini && fin) {
      const a = new Date(ini).getTime();
      const b = new Date(fin).getTime();
      if (!isFinite(a) || !isFinite(b) || b < a) {
        throw new BadRequestException('fecha_fin no puede ser anterior a fecha_inicio');
      }
    }
  }

  // ------- list -------
  async listRolesForUser(usuarioId: number) {
    const user = await this.prisma.usuario.findUnique({
      where: { ID_usuario: usuarioId },
      select: { ID_usuario: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    return this.prisma.grupo_usuario.findMany({
      where: { usuarioId },
      include: { grupo_rol: true },
      orderBy: [{ fecha_inicio: 'desc' }],
    });
  }

  // ------- create many (cada rol con sus propias fechas) -------
  async assignMany(usuarioId: number, roles: AssignRoleDto[]) {
    if (!roles?.length) throw new BadRequestException('Debe enviar al menos un rol');

    // validar existencia de todos los roles
    const ids = roles.map((r) => r.grupoRolId);
    const found = await this.prisma.grupo_rol.findMany({
      where: { ID_grupo_rol: { in: ids } },
      select: { ID_grupo_rol: true },
    });
    const foundIds = new Set(found.map((f) => f.ID_grupo_rol));
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new BadRequestException(`Roles inexistentes: ${missing.join(', ')}`);
    }

    // validar rango por item y mapear a create
    const data = roles.map((item) => {
      if (!item.fecha_inicio) throw new BadRequestException('Cada rol debe incluir fecha_inicio');

      const iniMs = new Date(item.fecha_inicio).getTime();
      if (!isFinite(iniMs)) throw new BadRequestException('fecha_inicio inválida');

      if (item.fecha_fin) {
        const finMs = new Date(item.fecha_fin).getTime();
        if (!isFinite(finMs) || finMs < iniMs) {
          throw new BadRequestException('fecha_fin no puede ser anterior a fecha_inicio');
        }
      }

      return {
        usuarioId,
        grupoRolId: item.grupoRolId,
        fecha_inicio: new Date(item.fecha_inicio),
        ...(item.fecha_fin === undefined
          ? {}
          : { fecha_fin: item.fecha_fin === null ? null : new Date(item.fecha_fin) }),
      };
    });

    await this.prisma.grupo_usuario.createMany({
      data,
      skipDuplicates: true,
    });

    return this.listRolesForUser(usuarioId);
  }

  // ------- update (opción A: editar la asignación vigente de ese rol) -------
  async updateRolePeriod(
    usuarioId: number,
    grupoRolId: number,
    dto: UpdateRolePeriodDto,
  ) {
    const now = new Date();
    const row = await this.prisma.grupo_usuario.findFirst({
      where: {
        usuarioId,
        grupoRolId,
        OR: [{ fecha_fin: null }, { fecha_fin: { gt: now } }],
      },
      orderBy: { fecha_inicio: 'desc' }, // la más reciente vigente
    });

    if (!row) {
      throw new NotFoundException('No hay asignación vigente para este rol');
    }

    // validar coherencia de rango usando valores actuales como fallback
    const ini = dto.fecha_inicio ?? row.fecha_inicio.toISOString();
    const fin = dto.fecha_fin ?? row.fecha_fin?.toISOString() ?? null;
    this.validateRange(ini, fin);

    const data: any = {};
    if (dto.fecha_inicio) data.fecha_inicio = new Date(dto.fecha_inicio);
    if (Object.prototype.hasOwnProperty.call(dto, 'fecha_fin')) {
      data.fecha_fin = dto.fecha_fin === null ? null : new Date(dto.fecha_fin!);
    }

    return this.prisma.grupo_usuario.update({
      where: { ID_grupo_usuario: row.ID_grupo_usuario },
      data,
    });
  }

  // ------- delete -------
  async remove(usuarioId: number, grupoRolId: number) {
    const row = await this.prisma.grupo_usuario.findFirst({
      where: { usuarioId, grupoRolId },
    });
    if (!row) throw new NotFoundException('Asignación no existe');

    return this.prisma.grupo_usuario.delete({
      where: { ID_grupo_usuario: row.ID_grupo_usuario },
    });
  }
}
