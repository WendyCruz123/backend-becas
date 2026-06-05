import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePanoramaDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  oficina_id?: number;

  @IsOptional()
  @IsString()
  rutaId?: string;

  @IsString()
  name: string;

  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsString()
  projection?: string;

  @IsOptional()
  @IsBoolean()
  publicado?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  es_portada?: boolean;
}