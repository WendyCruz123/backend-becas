import { PartialType } from '@nestjs/mapped-types';
import { CreatePanoramaDto } from './create-panorama.dto';

export class UpdatePanoramaDto extends PartialType(CreatePanoramaDto) {}
