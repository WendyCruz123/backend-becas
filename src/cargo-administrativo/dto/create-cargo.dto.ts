import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateCargoDto {
  @IsString() @IsNotEmpty()
  nombre: string;

  @IsString() @IsOptional()
  descripcion?: string;

  @IsDateString()
  fecha_inicio: string;

  @IsOptional() @IsDateString()
  fecha_fin?: string;

  @IsOptional() @IsBoolean()
  estado_cargo?: boolean;

  @IsInt() @Min(1)
  usuarioId: number;
}
