import { PeriodoBloqueo } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateBecaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  detalle?: string;

  @IsOptional()
  @IsString()
  imagen?: string;

  @IsString()
  tipo: string;
  
  @IsOptional()
  @IsInt()
  @Min(0)
  cupos?: number;

  @IsOptional()
  @IsBoolean()
  estado?: boolean;

  @IsDateString()
  fecha_inicio: string;

  @IsOptional()
  @IsDateString()
  fecha_fin?: string;

  @IsOptional()
  @IsEnum(PeriodoBloqueo)
  periodo_bloqueo?: PeriodoBloqueo;
}