import {
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificacionesSistemaService } from './notificaciones-sistema.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('notificaciones-sistema')
export class NotificacionesSistemaController {
  constructor(private readonly service: NotificacionesSistemaService) {}

  @Get('mias')
  misNotificaciones(@Req() req) {
    return this.service.misNotificaciones(req.user.sub);
  }

  @Patch(':id/leida')
  marcarLeida(@Req() req, @Param('id') id: string) {
    return this.service.marcarLeida(req.user.sub, id);
  }

  @Patch('leidas-todas')
  marcarTodasLeidas(@Req() req) {
    return this.service.marcarTodasLeidas(req.user.sub);
  }
}