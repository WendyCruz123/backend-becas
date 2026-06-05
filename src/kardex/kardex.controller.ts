import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { KardexService } from './kardex.service';
import { RevisarKardexDto } from './dto/revisar-kardex.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('kardex', 'admin')
@Controller('kardex')
export class KardexController {
  constructor(private readonly kardexService: KardexService) {}

  @Get('pendientes')
  pendientes() {
    return this.kardexService.pendientes();
  }

  @Get('revisados')
  revisados() {
    return this.kardexService.revisados();
  }
  
  @Patch('solicitudes/:id/pasar-revision')
pasarARevision(
  @Param('id', ParseIntPipe) id: number,
  @Req() req,
) {
  return this.kardexService.pasarARevision(id, req.user.sub);
}

  @Patch('solicitudes/:id/revisar')
  revisar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RevisarKardexDto,
    @Req() req,
  ) {
    return this.kardexService.revisar(
      id,
      dto,
      req.user.sub,
    );
  }
}