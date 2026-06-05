import { UseGuards,Req,  ForbiddenException,Body,Controller,Get,Param,Patch,Post,Query,Delete,} from '@nestjs/common';
import { PostulacionesService } from './postulaciones.service';
import { CreatePostulacionDto } from './dto/create-postulacion.dto';
import { MarcarPasoDto } from './dto/marcar-paso.dto';
import { ListAdminDto } from './dto/list-admin.dto';
import { IsArray, IsIn, IsOptional, IsString, ArrayNotEmpty } from 'class-validator';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { UpdatePostulacionAdminDto } from './dto/update-postulacion-admin.dto';
import { ResolverEtapaDto } from './dto/resolver-etapa.dto';

class MarcarObsDto {
  @IsArray() @ArrayNotEmpty()
  ids!: string[];

  @IsString()
  mensaje!: string;

  @IsArray() @IsIn(['email','whatsapp'], { each: true })
  channels!: ('email'|'whatsapp')[];
}

class MarcarEstadoFinalDto {
  @IsArray() @ArrayNotEmpty()
  ids!: string[];

  @IsIn(['APROBADO','REPROBADO'])
  estado!: 'APROBADO' | 'REPROBADO';

  @IsArray() @IsIn(['email','whatsapp'], { each: true })
  channels!: ('email'|'whatsapp')[];

  @IsOptional() @IsString()
  mensaje?: string;
}

@Controller('postulaciones')
export class PostulacionesController {
  constructor(private readonly service: PostulacionesService) {}

  // 🟢 Iniciar trámite
@UseGuards(JwtAuthGuard)
@Post('empezar')
async empezarTramite(
  @Req() req,
  @Body() body: { becaId: number; gestion: string },
) {
  const roles = req.user.roles || [];
  if (!roles.includes('estudiante')) {
    throw new ForbiddenException('Solo los estudiantes pueden iniciar un trámite.');
  }

  const usuarioId = req.user.sub;
  return this.service.empezarTramite({ ...body, usuarioId });
}

// 🔴 Abandonar trámite
@UseGuards(JwtAuthGuard)
@Patch(':id/abandonar')
async abandonarTramite(@Param('id') id: string, @Req() req) {
  const usuarioId = req.user?.sub;
  return this.service.abandonarTramite(id, usuarioId);
}
// 🟢 Continuar trámite abandonado recuperable
@UseGuards(JwtAuthGuard)
@Patch(':id/continuar')
async continuarTramite(@Param('id') id: string, @Req() req) {
  const usuarioId = req.user?.sub;
  return this.service.continuarTramite(id, usuarioId);
}

  // 🔵 Finalizar trámite
 @UseGuards(JwtAuthGuard)
@Patch(':id/finalizar')
async finalizarTramite(@Param('id') id: string, @Req() req) {
  return this.service.finalizarTramite(id, req.user?.sub);
}


// 🔍 Consultar trámite activo (acepta estudianteId o usuarioId)
@Get('activo')
async tramiteActivo(
  @Query('gestion') gestion: string,
  @Query('estudianteId') estudianteId?: string,
  @Query('usuarioId') usuarioId?: string,
  @Query('becaId') becaId?: string,
) {
  return this.service.obtenerTramiteActivoFlexible({
    gestion,
    estudianteId: estudianteId ? Number(estudianteId) : undefined,
    usuarioId: usuarioId ? Number(usuarioId) : undefined,
    becaId: becaId ? Number(becaId) : undefined,
  });
}

  // 🧩 Crear postulación directamente (si se usa desde admin)
  @Post()
  create(@Body() dto: CreatePostulacionDto) {
    return this.service.create(dto);
  }

  // 📋 Listar postulaciones generales
  @Get()
  findAll(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('gestion') gestion?: string,
    @Query('estado') estado?: string,
    @Query('estudianteId') estudianteId?: number,
    @Query('becaId') becaId?: number,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      gestion,
      estado,
      estudianteId: estudianteId ? Number(estudianteId) : undefined,
      becaId: becaId ? Number(becaId) : undefined,
      search,
    });
  }

  // 🧾 Listado para administrador (año, beca, búsqueda, paginación)
  @Get('admin')
  adminList(@Query() q: ListAdminDto) {
    return this.service.adminList(q);
  }

  // ✅ Marcar o desmarcar paso
  @Patch(':id/paso')
  marcarPaso(@Param('id') id: string, @Body() dto: MarcarPasoDto) {
    return this.service.marcarPaso(id, dto);
  }
  
  @UseGuards(JwtAuthGuard)
@Get('etapas/encargado')
async etapasEncargado(@Req() req) {
  const roles = req.user.roles || [];
  const rolesNormalizados = roles.map((r: string) =>
    String(r).toLowerCase(),
  );

  if (!rolesNormalizados.includes('encargado')) {
    throw new ForbiddenException(
      'Solo encargados pueden ver etapas asignadas.',
    );
  }

  return this.service.etapasEncargado(req.user.sub);
}

  @UseGuards(JwtAuthGuard)
  @Patch('etapas/resolver')
  async resolverEtapa(
    @Body() dto: ResolverEtapaDto,
    @Req() req,
  ) {
    const roles = req.user.roles || [];

    const rolesNormalizados = roles.map((r: string) => String(r).toLowerCase());

    if (!rolesNormalizados.includes('encargado')) {
      throw new ForbiddenException(
        'Solo encargados pueden resolver etapas.',
      );
    }

    return this.service.resolverEtapa(dto, req.user.sub);
  }
  @UseGuards(JwtAuthGuard)
  @Get('admin/reporte-postulaciones-beca')
  async reportePostulacionesPorBeca(@Query('year') year?: string) {
    return this.service.reportePostulacionesPorBeca(
      year ? Number(year) : undefined,
    );
  }

  @UseGuards(JwtAuthGuard)
@Patch('admin/:id/aprobar-documentacion-etapas')
async aprobarDocumentacionConEtapas(
  @Param('id') id: string,
  @Body()
  dto: {
    fecha?: string;
    descripcion?: string;
    oficinaRutaId?: number;
  },
  @Req() req,
) {
  const roles = req.user.roles || [];

  if (!roles.includes('admin')) {
    throw new ForbiddenException(
      'Solo administradores pueden aprobar documentación.',
    );
  }

  return this.service.aprobarDocumentacionConEtapas(
    id,
    dto,
    req.user.sub,
  );
}

  @Get('seguimiento/:codigo')
  consultarSeguimiento(@Param('codigo') codigo: string) {
    return this.service.consultarSeguimientoPorCodigo(codigo);
  }
@Get('stats/estudiantes-unicos')
async countByYear(@Query('year') year: string) {
  const y = Number(year ?? new Date().getFullYear());
  const count = await this.service.countEstudiantesUnicosPorGestion(y);
  return { ok: true, count };
}
@UseGuards(JwtAuthGuard)
@Patch('admin/cerrar-vencidas')
async cerrarPostulacionesVencidas(@Req() req) {
  const roles = req.user.roles || [];

  if (!roles.includes('admin')) {
    throw new ForbiddenException(
      'Solo administradores pueden cerrar postulaciones vencidas.',
    );
  }

  return this.service.cerrarPostulacionesVencidas();
}
@UseGuards(JwtAuthGuard)
@Patch('admin/:id/estado-administrativo')
async cambiarEstadoAdministrativo(
  @Param('id') id: string,
  @Body()
  dto: {
    estado: 'REMITIDO_A_DISBECT' | 'NO_REMITIDO';
    observacion?: string;
  },
  @Req() req,
) {
  const roles = req.user.roles || [];

  if (!roles.includes('admin')) {
    throw new ForbiddenException(
      'Solo administradores pueden cambiar estados administrativos.',
    );
  }

  return this.service.cambiarEstadoAdministrativo(
    id,
    dto,
    req.user.sub,
  );
}

  @UseGuards(JwtAuthGuard)
  @Get(':id/historial-estados')
  async obtenerHistorialEstadosPostulacion(
    @Param('id') id: string,
    @Req() req,
  ) {
    const roles = (req.user.roles || []).map((r: string) =>
      String(r).toLowerCase(),
    );

    const permitido =
      roles.includes('admin') || roles.includes('estudiante');

    if (!permitido) {
      throw new ForbiddenException(
        'No tiene permisos para ver el historial de estados.',
      );
    }

    return this.service.obtenerHistorialEstadosPostulacion(
      id,
      req.user.sub,
      roles,
    );
  }
  @UseGuards(JwtAuthGuard)
  @Patch('admin/:id')
  async actualizarPostulacionAdmin(
    @Param('id') id: string,
    @Body() dto: UpdatePostulacionAdminDto,
    @Req() req,
  ) {
    const roles = req.user.roles || [];
    if (!roles.includes('admin')) {
      throw new ForbiddenException('Solo administradores pueden editar postulaciones.');
    }
    return this.service.actualizarPostulacionAdmin(id, dto, req.user.sub);
  }
  @UseGuards(JwtAuthGuard)
@Get('abandono/recuperable')
async obtenerAbandonoRecuperable(
  @Req() req,
  @Query('gestion') gestion: string,
) {
  const roles = req.user.roles || [];

  if (!roles.includes('estudiante')) {
    throw new ForbiddenException(
      'Solo estudiantes pueden consultar trámites abandonados recuperables.',
    );
  }

  return this.service.obtenerAbandonoRecuperable({
    gestion,
    usuarioId: req.user.sub,
  });
}
@UseGuards(JwtAuthGuard)
@Get('ultima/global')
async obtenerUltimaPostulacionGlobal(
  @Req() req,
  @Query('gestion') gestion: string,
) {
  const roles = req.user.roles || [];

  if (!roles.includes('estudiante')) {
    throw new ForbiddenException(
      'Solo estudiantes pueden consultar su última postulación.',
    );
  }

  return this.service.obtenerUltimaPostulacionGlobal({
    gestion,
    usuarioId: req.user.sub,
  });
}
@UseGuards(JwtAuthGuard)
@Get('admin/:id/seguimiento')
async consultarSeguimientoAdminPorId(
  @Param('id') id: string,
  @Req() req,
) {
  const roles = (req.user.roles || []).map((r: string) =>
    String(r).toLowerCase(),
  );

  if (!roles.includes('admin')) {
    throw new ForbiddenException(
      'Solo administradores pueden ver el seguimiento de postulaciones.',
    );
  }

  return this.service.consultarSeguimientoAdminPorId(id);
}

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async obtenerDetalle(@Param('id') id: string) {
    return this.service.obtenerDetalle(id);
  }

}
