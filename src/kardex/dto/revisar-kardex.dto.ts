import { IsIn, IsOptional, IsString } from 'class-validator';

export class RevisarKardexDto {
  @IsIn(['LEGALIZADO', 'RECHAZADO'])
  estado: 'LEGALIZADO' | 'RECHAZADO';

  @IsOptional()
  @IsString()
  observacion?: string;
}