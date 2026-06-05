import { PartialType } from '@nestjs/mapped-types';
import { CreateGrupoRolDto } from './create-grupo-rol.dto';

export class UpdateGrupoRolDto extends PartialType(CreateGrupoRolDto) {}
