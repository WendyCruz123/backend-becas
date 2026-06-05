// src/postulaciones/dto/update-estado.dto.ts
import { IsIn, IsString } from 'class-validator';

export class UpdateEstadoDto {
  @IsString()
  @IsIn([
    'EN_PROCESO',
    'PENDIENTE',
    'HABILITADO',
    'REMITIDO_A_DISBECT',
    'NO_REMITIDO',
    'APROBADO',
    'REPROBADO',
    'ABANDONADO',
  ])
  estado: string;
}