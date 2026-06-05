import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('usuario')
export class UsuarioController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
@Get('me')
async obtenerDatos(@UsuarioActual() user: any) {
const usuario = await this.prisma.usuario.findUnique({
  where: { ID_usuario: user.sub },
  include: {
    persona: {
      include: {
        estudiante: true,
      },
    },
    grupo_usuario: { include: { grupo_rol: true } },
  },
});

  if (!usuario) {
    return { message: 'Usuario no encontrado', user: null };
  }

  const roles = usuario.grupo_usuario.map((g) => g.grupo_rol.nombre.toLowerCase());

  return {
    message: 'Usuario autenticado correctamente',
    user: {
      sub: usuario.ID_usuario,
      username: usuario.username,
      personaId: usuario.persona?.ID_persona ?? null,

      nombre: usuario.persona?.nombre ?? null,
      apellido_paterno: usuario.persona?.apellido_paterno ?? null,
      apellido_materno: usuario.persona?.apellido_materno ?? null,
      ci: usuario.persona?.ci ?? null,
      celular: usuario.persona?.celular ?? null,
      ru: usuario.persona?.estudiante?.[0]?.ru ?? null,
      roles,
    },
  };
}


  @UseGuards(JwtAuthGuard)
  @Get()
  async obtenerTodos() {
    const usuarios = await this.prisma.usuario.findMany({
      include: { persona: true }, // si quieres los datos de la persona
    });
    return usuarios;
  }
}
