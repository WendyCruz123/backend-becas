import { IsBoolean, IsOptional, IsDateString, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

export class UpdateCargoDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;

  // ✅ permite '', null o ISO
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((o) => o.fecha_fin !== null && o.fecha_fin !== undefined)
  @IsDateString()
  fecha_fin?: string | null;

  @IsOptional()
  @IsBoolean()
  estado_cargo?: boolean;
}
