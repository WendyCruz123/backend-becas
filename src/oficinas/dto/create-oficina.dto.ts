import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateOficinaDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsString()
  horario_atencion: string;

  @IsOptional()
  @IsBoolean()
  estado_oficina?: boolean; // default true

  // ⬇️ NUEVO
  @IsOptional()
  @IsString()
  panorama_route_slug?: string;
}
