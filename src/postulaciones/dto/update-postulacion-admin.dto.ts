import { IsInt, IsOptional, IsString, IsIn } from 'class-validator';

export class UpdatePostulacionAdminDto {
  @IsOptional()
  @IsInt()
  becaId?: number;

  @IsOptional()
  @IsString()
  gestion?: string;

  @IsOptional()
  @IsIn([
  'EN_PROCESO',
  'PENDIENTE',
  'HABILITADO',
  'REMITIDO_A_DISBECT',
  'NO_REMITIDO',
  'APROBADO',
  'REPROBADO',
  'ABANDONADO',
  'ARCHIVADO',
])
estado?: string;

  @IsOptional()
  @IsString()
  estado_observacion?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}