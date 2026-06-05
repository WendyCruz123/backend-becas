// src/postulaciones/postulaciones-notif.controller.ts
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { PostulacionesNotifService } from './postulaciones-notif.service';
import { NotificarLoteDto } from './dto/notificar-lote.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('postulaciones/notif')
export class PostulacionesNotifController {
  constructor(private readonly service: PostulacionesNotifService) {}

  @Post()
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async notificar(@Body() dto: NotificarLoteDto, @Req() req) {
    return this.service.notificarLote(dto, req.user.sub);
  }
}
