import { Type, Transform } from 'class-transformer';
import { ValidateNested, IsArray, ArrayNotEmpty, ValidateIf } from 'class-validator';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class AssignRoleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  grupoRolId: number;

  @IsDateString()
  fecha_inicio: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value)) // permite '' -> null
  @ValidateIf((o) => o.fecha_fin !== null && o.fecha_fin !== undefined) // valida ISO solo si no es null
  @IsDateString()
  fecha_fin?: string | null; // null o ISO; si no viene, lo trataremos como null al guardar
}

export class AssignRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AssignRoleDto)
  roles: AssignRoleDto[];
}
