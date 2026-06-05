import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto'; // Asegúrate que existe este archivo
import { ForbiddenException } from '@nestjs/common';


@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService
  ) {}

  // LOGIN
  async login(username: string, password: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { username },
      include: { persona: true },
    });

    if (!user) {
      throw new UnauthorizedException('Acceso denegado');
    }

    const passwordValido = await bcrypt.compare(password, user.password);
    if (!passwordValido) {
      throw new UnauthorizedException('Acceso denegado');
    }
// auth.service.ts (dentro de login, después de obtener user)
const rolesRows = await this.prisma.grupo_usuario.findMany({
  where: { usuarioId: user.ID_usuario, 
    OR: [
      { fecha_fin: null }, 
      { fecha_fin: { gt: new Date() } }
    ] 
  },
  include: { grupo_rol: true },
});
const roles = rolesRows.map(r => r.grupo_rol.nombre.toLowerCase()); // ['student','admin',...]

    const payload = {
      sub: user.ID_usuario,
      username: user.username,
      nombre: user.persona?.nombre,
      roles, // Agregar roles al payload
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRATION'),
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRATION'),
    });

    return {
      accessToken,
      refreshToken,
      user: payload,
    };
  }

  // REFRESH TOKEN
// src/auth/auth.service.ts
async refreshToken(refresh: string) {
  try {
    const decoded = this.jwt.verify(refresh, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
    });

    const user = await this.prisma.usuario.findUnique({
      where: { ID_usuario: decoded.sub },
      include: { persona: true },
    });
    if (!user) throw new UnauthorizedException();

    // Recalcular roles vigentes
    const rolesRows = await this.prisma.grupo_usuario.findMany({
      where: {
        usuarioId: user.ID_usuario,
        OR: [{ fecha_fin: null }, { fecha_fin: { gt: new Date() } }],
      },
      include: { grupo_rol: true },
    });
    const roles = rolesRows.map(r => r.grupo_rol.nombre.toLowerCase()); // ['admin','estudiante', ...]

    const payload = {
      sub: user.ID_usuario,
      username: user.username,
      nombre: user.persona?.nombre,
      roles, // 👈 IMPORTANTE
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRATION'),
    });

    return { accessToken };
  } catch {
    throw new UnauthorizedException('Refresh token inválido');
  }
}


  //REGISTRO DE USUARIO (con contraseña encriptada)
  async createUser(createUserDto: CreateUserDto) {
  const { password, persona, username } = createUserDto;

  const existingUser = await this.prisma.usuario.findUnique({
    where: { username },
  });

  if (existingUser) {
    throw new BadRequestException('Este nombre de usuario ya está registrado');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await this.prisma.usuario.create({
    data: {
      username,
      password: hashedPassword,
      persona: {
        connect: { ID_persona: persona },
      },
    },
  });

  return {
    message: 'Usuario creado exitosamente',
    user: {
      id: newUser.ID_usuario,
      username: newUser.username,
    },
  };
}
  // ======== CAMBIO DE CONTRASEÑA (propio) ========
  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { ID_usuario: userId },
      include: { persona: true },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw new UnauthorizedException('La contraseña actual es incorrecta');

    // Evitar misma contraseña
    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) throw new BadRequestException('La nueva contraseña no puede ser igual a la actual');

    // (Opcional) Política mínima
    if (newPassword.length < 8) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.usuario.update({
      where: { ID_usuario: userId },
      data: { password: hashed },
    });

    // Recalcular roles vigentes para emitir tokens nuevos
    const rolesRows = await this.prisma.grupo_usuario.findMany({
      where: {
        usuarioId: user.ID_usuario,
        OR: [{ fecha_fin: null }, { fecha_fin: { gt: new Date() } }],
      },
      include: { grupo_rol: true },
    });
    const roles = rolesRows.map(r => r.grupo_rol.nombre.toLowerCase());

    const payload = {
      sub: user.ID_usuario,
      username: user.username,
      nombre: user.persona?.nombre,
      roles,
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRATION'),
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRATION'),
    });

    return {
      message: 'Contraseña actualizada correctamente',
      accessToken,
      refreshToken,
      user: payload,
    };
  }

}
