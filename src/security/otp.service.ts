import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { MailerService } from '../mailer/mailer.service';

// Genera números aleatorios
function randomNumeric(len: number) {
  let s = '';
  while (s.length < len) s += Math.floor(Math.random() * 10);
  return s.slice(0, len);
}

// Hashea con SHA256
function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

@Injectable()
export class OtpService {
  private readonly ttlMin = Number(process.env.OTP_TTL_MINUTES || 10);
  private readonly maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS || 5);
  private readonly codeLen = Number(process.env.OTP_CODE_LENGTH || 6);
  private readonly pepper = process.env.OTP_PEPPER || 'pepper';

  constructor(
    private prisma: PrismaService,
    private mailer: MailerService,
  ) {}

  // 🔹 Solicita envío de OTP al correo
  async requestOtpByEmail(userId: number, email: string, purpose: 'password_reset' | 'password_change') {
    // Invalida OTPs previos activos
    await this.prisma.otpCode.updateMany({
      where: { userId, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });

    // Genera el código y guarda hash
    const code = randomNumeric(this.codeLen);
    const codeHash = sha256(code + this.pepper);
    const expiresAt = new Date(Date.now() + this.ttlMin * 60 * 1000);

    await this.prisma.otpCode.create({
      data: {
        userId,
        purpose,
        channel: 'email',
        codeHash,
        expiresAt,
        maxAttempts: this.maxAttempts,
      },
    });

    // Envía correo
    const ok = await this.mailer.sendOtpEmail(email, code, this.ttlMin);
    if (!ok) throw new BadRequestException('No se pudo enviar el correo');
    return { ok: true };
  }

  // 🔹 Verifica código ingresado
  async verifyEmailOtp(userId: number, code: string, purpose: 'password_reset' | 'password_change') {
    const now = new Date();
    const otp = await this.prisma.otpCode.findFirst({
      where: { userId, purpose, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new BadRequestException('Código inválido o expirado');

    if (otp.attempts >= otp.maxAttempts) {
      throw new ForbiddenException('Intentos agotados; solicita un nuevo código');
    }

    const hash = sha256(code + this.pepper);
    const isOk = hash === otp.codeHash;

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 }, consumedAt: isOk ? now : undefined },
    });

    if (!isOk) throw new BadRequestException('Código incorrecto');
    return { ok: true };
  }

  // 🔹 Invalida todos los OTPs (cuando se cambia contraseña)
  async consumeAllFor(userId: number, purpose: 'password_reset' | 'password_change') {
    await this.prisma.otpCode.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }
}
