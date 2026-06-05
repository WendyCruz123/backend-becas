import { Body, Controller, Delete, Get, Param, Post, Patch } from '@nestjs/common';
import { GrupoUsuarioService } from './grupo-usuario.service';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { UpdateRolePeriodDto } from './dto/update-role-period.dto';

@Controller('usuario')
export class GrupoUsuarioController {
  constructor(private readonly service: GrupoUsuarioService) {}

  @Get(':id/roles')
  list(@Param('id') id: string) {
    return this.service.listRolesForUser(+id);
  }

  @Post(':id/roles')
  assign(@Param('id') id: string, @Body() body: AssignRolesDto) {
    return this.service.assignMany(+id, body.roles);
  }
@Patch(':id/roles/:rolId')
updatePeriod(
  @Param('id') id: string,
  @Param('rolId') rolId: string,
  @Body() body: UpdateRolePeriodDto
) {
  return this.service.updateRolePeriod(+id, +rolId, body);
}
  @Delete(':id/roles/:rolId')
  remove(@Param('id') id: string, @Param('rolId') rolId: string) {
    return this.service.remove(+id, +rolId);
  }
}
