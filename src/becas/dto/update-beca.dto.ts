import { PartialType } from '@nestjs/mapped-types';
import { CreateBecaDto } from './create-beca.dto';

export class UpdateBecaDto extends PartialType(CreateBecaDto) {}
