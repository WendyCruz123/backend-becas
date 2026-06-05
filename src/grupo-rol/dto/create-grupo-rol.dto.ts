import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGrupoRolDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;
}
