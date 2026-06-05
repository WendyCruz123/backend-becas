import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ArrayNotEmpty,
  IsInt,
} from 'class-validator';

export enum TipoNotificacionPostulacion {
  OBSERVACION = 'OBSERVACION',
  ESTADO = 'ESTADO',
  PERSONALIZADO = 'PERSONALIZADO',
}

export enum SubTipoEstado {
  APROBADO = 'APROBADO',
  REPROBADO = 'REPROBADO',
}

export class NotificarLoteDto {
  @IsNumber()
  @Type(() => Number)
  becaId: number;

  @IsString()
  @IsNotEmpty()
  gestion: string;

  @IsEnum(TipoNotificacionPostulacion)
  tipo: TipoNotificacionPostulacion;

  @IsOptional()
  @IsEnum(SubTipoEstado)
  subTipo?: SubTipoEstado;

  @IsArray()
  @ArrayNotEmpty()
  @Transform(({ value }) => value.map((v: any) => String(v)))
  idsSeleccionados: string[];

  @IsOptional()
  @IsString()
  mensajePersonalizado?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  oficinaIdObservacion?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  nota?: number;

  @IsOptional()
  @IsString()
  descripcion?: string;
}