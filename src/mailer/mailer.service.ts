import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;

  private readonly fromName = process.env.MAIL_FROM_NAME || 'Carrera';
  private readonly fromAddr = process.env.MAIL_FROM_ADDR || 'no-reply@example.com';

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  private from() {
    return `"${this.fromName}" <${this.fromAddr}>`;
  }

  // 📩 Enviar OTP
  async sendOtpEmail(toEmail: string, code: string, ttlMin: number) {
    try {
      await this.transporter.sendMail({
        from: this.from(),
        to: toEmail,
        subject: `Código de verificación (${ttlMin} min)`,
        html: `
          <div style="font-family:system-ui">
            <p>Tu código de verificación es:</p>
            <p style="font-size:24px;font-weight:700;letter-spacing:2px">${code}</p>
            <p>Vence en ${ttlMin} minutos.</p>
            <p>Si no solicitaste este código, ignora este mensaje.</p>
          </div>
        `,
      });
      return true;
    } catch (e: any) {
      this.logger.error(`SMTP send error: ${e?.message || e}`);
      return false;
    }
  }
    /**
   * Método genérico para enviar correos HTML.
   */
  async sendMail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: `"${process.env.MAIL_FROM_NAME || 'UPEA Becas'}" <${process.env.MAIL_FROM_ADDR || process.env.MAIL_USER}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });
      this.logger.log(`Correo enviado a ${opts.to}`);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      this.logger.error(`Error enviando correo a ${opts.to}: ${message}`);
      return false;
    }
  }
}
