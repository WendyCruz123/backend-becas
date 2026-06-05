import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // sin restricción → acceso libre
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user?.sub) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Busca roles activos (sin fecha_fin o no vencidos)
    const roles = await this.prisma.grupo_usuario.findMany({
      where: {
        usuarioId: user.sub,
        OR: [{ fecha_fin: null }, { fecha_fin: { gt: new Date() } }],
      },
      include: { grupo_rol: true },
    });

    const nombres = roles.map((r) => r.grupo_rol.nombre.toLowerCase());
    const tieneRol = requiredRoles.some((r) => nombres.includes(r.toLowerCase()));

    if (!tieneRol) {
      throw new ForbiddenException('No tiene permiso para realizar esta acción');
    }

    return true;
  }
}
