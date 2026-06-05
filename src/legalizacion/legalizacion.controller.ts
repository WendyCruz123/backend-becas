import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LegalizacionService } from './legalizacion.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RevisarLegalizacionDto } from './dto/revisar-legalizacion.dto';

@UseGuards(JwtAuthGuard)
@Controller('legalizacion')
export class LegalizacionController {
  constructor(private readonly service: LegalizacionService) {}

  private validarRol(req: any) {
    const roles = (req.user.roles || []).map((r: string) =>
      String(r).toLowerCase(),
    );

    const permitido =
      roles.includes('admin') ||
      roles.includes('kardex') ||
      roles.includes('director');

    if (!permitido) {
      throw new ForbiddenException(
        'No tiene permisos para gestionar legalizaciones.',
      );
    }
  }

  @Get('mis-pendientes')
  misPendientes(@Req() req) {
    this.validarRol(req);
    return this.service.misPendientes(req.user.sub);
  }
// @Get('mis-pendientes')
// async misPendientes(@Req() req, @Query('gestion') gestion?: string) {
//   return this.service.misPendientes(req.user.sub, gestion);
// }

  @Patch(':id/pasar-revision')
  pasarARevision(@Param('id') id: string, @Req() req) {
    this.validarRol(req);
    return this.service.pasarARevision(Number(id), req.user.sub);
  }

  @Patch(':id/legalizar')
  legalizar(
    @Param('id') id: string,
    @Body() dto: RevisarLegalizacionDto,
    @Req() req,
  ) {
    this.validarRol(req);
    return this.service.legalizar(Number(id), req.user.sub, dto);
  }

  @Patch(':id/rechazar')
  rechazar(
    @Param('id') id: string,
    @Body() dto: RevisarLegalizacionDto,
    @Req() req,
  ) {
    this.validarRol(req);
    return this.service.rechazar(Number(id), req.user.sub, dto);
  }

  @Patch(':id/entregar')
  entregar(
    @Param('id') id: string,
    @Body() dto: RevisarLegalizacionDto,
    @Req() req,
  ) {
    this.validarRol(req);
    return this.service.entregar(Number(id), req.user.sub, dto);
  }
}