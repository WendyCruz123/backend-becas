import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class LegalizacionFlujoDto {
  @IsInt()
  @Type(() => Number)
  usuarioId: number;

  @IsInt()
  @Type(() => Number)
  orden: number;
}

export class CreateRequisitoDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  oficinaId?: number;

  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  archivo_ejemplo_url?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  url_externa?: string;

  @IsOptional()
  @IsBoolean()
  requiere_legalizacion?: boolean;
  
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  dias_estimados_legalizacion?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  entrega_final_usuarioId?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LegalizacionFlujoDto)
  legalizacionFlujo?: LegalizacionFlujoDto[];

  @IsOptional()
  @IsIn(['DOCUMENTO', 'ETAPA'])
  tipo_requisito?: 'DOCUMENTO' | 'ETAPA';

  @IsOptional()
  @IsBoolean()
  requiere_nota?: boolean;

  @IsOptional()
  @IsBoolean()
  requiere_fecha_descripcion?: boolean;

  @IsOptional()
  @IsBoolean()
  requiere_ruta_360?: boolean;

  @IsOptional()
  @IsBoolean()
  requiere_otro?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  encargadoIds?: number[];
}