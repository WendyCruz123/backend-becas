import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class ListAdminDto {
  @IsOptional() @IsInt() @Min(0) @Type(() => Number)
  offset?: number = 0;

  @IsOptional() @IsInt() @IsPositive() @Type(() => Number)
  limit?: number = 10;

  @IsOptional() @IsInt() @Type(() => Number)
  year?: number;

  @IsOptional() @IsInt() @Type(() => Number)
  becaId?: number;

  @IsOptional() @IsString()
  search?: string;

  // 🔥 AGREGA ESTO
  @IsOptional() @IsString()
  searchEstudiante?: string;

  @IsOptional() @IsString()
  searchBeca?: string;

  @IsOptional() @IsBoolean() @Type(() => Boolean)
  excludeApproved?: boolean = true;

  @IsOptional()
  @IsString()
  estado?: string;
  
  @IsOptional()
  @IsIn(['CON_ETAPAS', 'SIN_ETAPAS'])
  tipoBeca?: 'CON_ETAPAS' | 'SIN_ETAPAS';
  
  @IsOptional()
@IsIn(['ACTUAL', 'HISTORICO'])
modoEstado?: 'ACTUAL' | 'HISTORICO' = 'ACTUAL';
}
