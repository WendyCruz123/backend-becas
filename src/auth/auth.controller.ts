import { Body, Controller, Post, Req, Res, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from '../security/otp.service';


@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private readonly jwt: JwtService,          // ✅ necesario para verifyAsync
    private readonly prisma: PrismaService,    // ✅ necesario para actualizar password
    private readonly otp: OtpService,          // ✅ necesario para consumeAllFor
  ) {}

  @Post('login')
  async login(
    @Body() body: { username: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.auth.login(body.username, body.password);

    // Cookie segura para refresh (ajusta flags en prod: secure: true, etc.)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false,       // true en producción (HTTPS)
      sameSite: 'lax',     // 'strict' si todo es mismo sitio
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días para que se borre en el navegador
    });
    return { accessToken, user };
  }

    @Post('refresh')
  async refresh(
    @Req() req: Request) {
    const rt = req.cookies?.refresh_token;
    if (!rt) throw new UnauthorizedException('No refresh cookie');
    // sin rotacion
    const { accessToken } = await this.auth.refreshToken(rt);
    return { accessToken };
  }
    @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.cookie('refresh_token', '', {
      httpOnly: true,
      secure: false, // true en prod
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return { ok: true };
  }
  // auth.controller.ts
@Post('_echo')
echo(@Req() req: any, @Body() body: any) {
  console.log('ECHO headers:', req.headers);
  console.log('ECHO body:', body);
  return { got: body };
}

// src/auth/auth.controller.ts (solo el handler)
@Post('change-password')
async changePassword(
  @Req() req: any,
  @Body() dto: ChangePasswordDto,
  @Res({ passthrough: true }) res: Response,
) {
  const authz = req.headers?.authorization || '';
  const ct = req.headers?.['content-type'];

  console.log('[change-password] CT=', ct);
  console.log('[change-password] AuthZ=', authz?.slice(0, 35) + '...');
  console.log('[change-password] DTO=', dto);

  try {
    // === token desde Authorization Bearer, X-Reset-Token o body.token ===
    const headerToken = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    const token = headerToken || req.headers['x-reset-token'] || (req.body?.token ?? '');
    if (!token) throw new UnauthorizedException('Token requerido (Bearer / X-Reset-Token / body.token)');

    // === verificar JWT ===
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_SECRET });
    } catch (e: any) {
      console.error('[change-password] verifyAsync:', e?.message || e);
      throw new UnauthorizedException('Token inválido o expirado');
    }
    console.log('[change-password] payload =', { sub: payload?.sub, scope: payload?.scope });

    // === política mínima ===
    const newPassword = String(dto?.newPassword ?? '');
    if (newPassword.length < 8) throw new BadRequestException('Contraseña muy corta (>=8)');

    // === Flujo A: reset por OTP ===
    if (payload?.scope === 'pwd_reset') {
      const hash = await bcrypt.hash(newPassword, 10);

      // ⚠️ Si tu columna NO se llama 'password', cámbiala aquí:
      await this.prisma.usuario.update({
        where: { ID_usuario: payload.sub },
        data: { password: hash }, // ej: { contrasenha: hash }
      });

      await this.otp.consumeAllFor(payload.sub, 'password_reset');
      console.log('[change-password] OK -> modo pwd_reset');
      return { ok: true, mode: 'pwd_reset' };
    }

    // === Flujo B: cambio autenticado ===
    if (!dto?.currentPassword) {
      throw new BadRequestException('Debe enviar la contraseña actual');
    }

    const result = await this.auth.changePassword(
      payload.sub,
      dto.currentPassword,
      newPassword,
    );

    if (result?.refreshToken) {
      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: false, // true en prod
        sameSite: 'lax',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
    }

    console.log('[change-password] OK -> modo authenticated');
    return {
      message: result?.message ?? 'Contraseña actualizada',
      accessToken: result?.accessToken,
      user: result?.user,
      mode: 'authenticated',
    };
  } catch (e: any) {
    console.error('[change-password] ERROR:', e?.message || e);
    // Repropaga para que Postman vea el mensaje exacto
    throw e;
  }
}
}



