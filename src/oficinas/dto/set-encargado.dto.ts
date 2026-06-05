import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class SetEncargadoDto {
  @IsString()
  nombre: string;

  @IsString()
  apellido_paterno: string;

  @IsOptional()
  @IsString()
  apellido_materno?: string;

  @IsOptional()
  @IsEmail()
  correo_electronico?: string;

  @IsOptional()
  @IsString()
  celular?: string;

  @IsOptional()
  @IsString()
  turno_atencion?: string;

  @IsOptional()
  @IsBoolean()
  estado?: boolean; // por defecto true
}
