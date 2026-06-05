import { IsBoolean, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class AttachRequisitoDto {
  @IsInt()
  @Type(() => Number)
  requisitoId: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  estado?: boolean;
}