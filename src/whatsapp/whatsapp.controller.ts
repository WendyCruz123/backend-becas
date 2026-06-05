import { Controller, Get, Post } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get('status')
  getStatus() {
    return this.whatsapp.getStatus();
  }
  @Get('can-send')
  canSend() {
    const s = this.whatsapp.getStatus();
    return { ok: s.status === 'READY' && s.ready === true };
  }

  @Post('authenticate')
  async authenticate() {
    return this.whatsapp.startAuthentication();
  }

  @Get('qr')
  async getQR() {
    return this.whatsapp.getQR();
  }
  @Post('logout')
  async logout() {
    return this.whatsapp.logout();
  }

  @Post('reset-session')
  async resetSession() {
    return this.whatsapp.resetSession();
  }
}