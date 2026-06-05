import { IsArray, IsBoolean, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePasoBecaDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  estado?: boolean;
}

export class ReordenarPasosBecaDto {
  @IsArray()
  items: {
    pasoBecaId: number;
    orden: number;
  }[];
}