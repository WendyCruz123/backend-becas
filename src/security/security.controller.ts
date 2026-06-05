import { Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import { OtpService } from './otp.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

type Purpose = 'password_reset' | 'password_change';

@Controller('security/otp/password')
export class SecurityController {
  constructor(
    private prisma: PrismaService,
    private otp: OtpService,
    private jwt: JwtService,
  ) {}

  // 🔹 Solicitar envío de OTP
  @Post('request')
  async request(@Req() req: any, @Body() body: any) {
    const purpose: Purpose = body?.purpose || 'password_reset';
    const maybeUserId = req.user?.sub;

    if (maybeUserId) {
      const user = await this.prisma.usuario.findUnique({ 
      where: { ID_usuario: maybeUserId },
        select: { ID_usuario: true,
        persona: { select: { correo_electronico: true } }
        }
    });
       if (!user || !user.persona?.correo_electronico) throw new UnauthorizedException();

      await this.otp.requestOtpByEmail(
        user.ID_usuario,
        user.persona.correo_electronico,
        purpose,
      );
      return { ok: true };
    }

    const email = (body?.email || '').trim().toLowerCase();
    if (!email) return { ok: true };

    const persona = await this.prisma.persona.findUnique({ 
      where: { correo_electronico: email }, 
      select: { ID_persona: true }}
    );
    if (!persona) return { ok: true };

    const u = await this.prisma.usuario.findUnique({
      where: { personaId: persona.ID_persona },
      select: { ID_usuario: true },
    });
    if (!u) return { ok: true };

    await this.otp.requestOtpByEmail(u.ID_usuario, email, 'password_reset');
    return { ok: true };
  }

  // 🔹 Verificar OTP y emitir token de reseteo
  @Post('verify')
  async verify(@Req() req: any, @Body() body: any) {
    const purpose: Purpose = body?.purpose || 'password_reset';
    const ttlMin = Number(process.env.RESET_TOKEN_TTL_MINUTES || 15);

    let userId: number | null = req.user?.sub ?? null;
    let email = (body?.email || '').trim().toLowerCase();

    if (!userId) {
      if (!email) throw new UnauthorizedException('Falta email');
      const persona = await this.prisma.persona.findUnique({ where: { correo_electronico: email } });
      if (!persona) throw new UnauthorizedException();
      const user = await this.prisma.usuario.findUnique({ where: { personaId: persona.ID_persona } });
      if (!user) throw new UnauthorizedException();
      userId = user.ID_usuario;
    }

    await this.otp.verifyEmailOtp(userId!, String(body?.code || ''), purpose);

    const resetToken = await this.jwt.signAsync(
      { sub: userId, scope: 'pwd_reset' },
      { secret: process.env.JWT_SECRET, expiresIn: `${ttlMin}m` },
    );

    return { resetToken, expiresInMinutes: ttlMin };
  }
}
