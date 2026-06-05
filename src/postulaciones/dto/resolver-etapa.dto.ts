import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class ResolverEtapaDto {
  @IsNumber()
  pasoEstudianteId!: number;

  @IsIn(['APROBADO', 'REPROBADO', 'ABANDONADO'])
  resultado!: 'APROBADO' | 'REPROBADO' | 'ABANDONADO';

  @IsOptional()
  @IsNumber()
  nota?: number;

  @IsOptional()
  @IsString()
  fecha?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  textoExtra?: string;

  @IsOptional()
  @IsNumber()
  oficinaRutaId?: number;
}