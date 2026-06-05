import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { HotspotType, IconType } from '@prisma/client';

export class CreateHotspotDto {
  @IsString() panoramaId: string;
  @IsEnum(HotspotType) type: HotspotType;

  @Type(() => Number) @IsNumber() x: number;
  @Type(() => Number) @IsNumber() y: number;
  @Type(() => Number) @IsNumber() z: number;

  @IsOptional() @IsEnum(IconType) icon?: IconType;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @Type(() => Number) @IsNumber() orderIndex?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @ValidateIf(o => o.type === 'LINK') @IsString()
  targetPanoramaId?: string;

  @ValidateIf(o => o.type === 'LINK') @IsOptional() @IsString()
  transition?: string;
}
