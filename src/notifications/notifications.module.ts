import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { MailerModule } from '../mailer/mailer.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [WhatsAppModule, MailerModule],
  providers: [NotificationsService, PrismaService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
