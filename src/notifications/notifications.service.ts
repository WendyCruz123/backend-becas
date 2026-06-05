import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';

type Channel = 'email' | 'whatsapp';

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  constructor(
    private readonly wa: WhatsAppService,
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  async sendToUser(userId: number, subject: string, body: string, channels: Channel[]) {
    // Busca correo/celular
    const user = await this.prisma.usuario.findUnique({
      where: { ID_usuario: userId },
      select: {persona: {select: { correo_electronico: true, celular: true, nombre: true } },},
    });

    if (!user?.persona) {return { email: false, whatsapp: false, ok: false };}

    let emailOk = false;
    let waOk = false;

    if (channels.includes('email') && user.persona.correo_electronico) {
      emailOk = await this.mailer.sendMail({
        to: user.persona.correo_electronico,
        subject,
        html: `<p>${body}</p>`,
      });
      await this.prisma.notificationLog.create({
        data: {
          userId,
          channel: 'email',
          template: subject,
          payload: { body },
          status: emailOk ? 'SENT' : 'FAILED',
        },
      });
    }

    if (channels.includes('whatsapp') && user.persona.celular) {
      waOk = await this.wa.sendMessage(user.persona.celular, body);
      await this.prisma.notificationLog.create({
        data: {
          userId,
          channel: 'whatsapp',
          template: subject,
          payload: { body },
          status: waOk ? 'SENT' : 'FAILED',
        },
      });
    }
    this.log.log(
  `Notif a userId=${userId} | email:${emailOk ? 'OK' : 'NO'} | whatsapp:${waOk ? 'OK' : 'NO'}`,
);
    return { email: emailOk, whatsapp: waOk, ok: emailOk || waOk, };
  }
}
