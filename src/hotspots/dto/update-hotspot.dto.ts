import { PartialType } from '@nestjs/mapped-types';
import { CreateHotspotDto } from './create-hotspot.dto';

export class UpdateHotspotDto extends PartialType(CreateHotspotDto) {}
