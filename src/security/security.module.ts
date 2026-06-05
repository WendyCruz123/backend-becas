import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityController } from './security.controller';
import { MailerModule } from '../mailer/mailer.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    MailerModule,
    JwtModule.register({ secret: process.env.JWT_SECRET }),
  ],
  controllers: [SecurityController],
  providers: [OtpService, PrismaService],
  exports: [OtpService],
})
export class SecurityModule {}
