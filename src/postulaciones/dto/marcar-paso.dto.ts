// src/postulaciones/dto/marcar-paso.dto.ts
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class MarcarPasoDto {
  @IsInt() @Type(() => Number)
  pasoBecaId: number;

  @IsBoolean()
  completado: boolean;

  @IsOptional() @IsString()
  notas?: string;
}
