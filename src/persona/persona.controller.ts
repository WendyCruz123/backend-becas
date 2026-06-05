import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { PersonaService } from './persona.service';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { UpdatePersonaDto } from './dto/update-persona.dto';

@Controller('persona')
export class PersonaController {
  constructor(private readonly personaService: PersonaService) {}

  @Post()
  create(@Body() createPersonaDto: CreatePersonaDto) {
  return this.personaService.create(createPersonaDto);
  }
  
  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.personaService.findAll(paginationDto);
  }

@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.personaService.findOne(id);
}

@Patch(':id')
update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePersonaDto) {
  return this.personaService.update(id, dto);
}

@Delete(':id')
remove(@Param('id', ParseIntPipe) id: number) {
  return this.personaService.remove(id);
}
}
