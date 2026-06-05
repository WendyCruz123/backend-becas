// src/postulaciones/dto/create-postulacion.dto.ts
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePostulacionDto {
  @IsInt() @Type(() => Number)
  estudianteId: number;

  @IsInt() @Type(() => Number)
  becaId: number;

  @IsString() @IsNotEmpty()
  gestion: string; // p.ej. "2025-1"
}
