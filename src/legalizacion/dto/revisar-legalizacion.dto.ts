import { IsOptional, IsString } from 'class-validator';

export class RevisarLegalizacionDto {
  @IsOptional()
  @IsString()
  observacion?: string;
}