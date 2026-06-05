import { IsOptional, IsDateString, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateRolePeriodDto {
  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;

  // Permite '', null o una fecha ISO.
  // Si es null -> reabrir. Si es string -> debe ser ISO.
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((o) => o.fecha_fin !== null && o.fecha_fin !== undefined)
  @IsDateString()
  fecha_fin?: string | null;
}
