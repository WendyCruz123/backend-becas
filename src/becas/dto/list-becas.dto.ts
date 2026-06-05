import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsPositive, Min } from 'class-validator';

export class ListBecasDto {
  @IsOptional() @IsPositive() @Type(() => Number)
  limit?: number;

  @IsOptional() @Min(0) @Type(() => Number)
  offset?: number;

  @IsOptional() @Type(() => String)
  search?: string; // por nombre o tipo

  // include = none | relaciones  (para traer pasos/postulaciones cuando lo pidas)
  @IsOptional() @IsIn(['none', 'relaciones'])
  include?: 'none' | 'relaciones';
}
