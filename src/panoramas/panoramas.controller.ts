import { Body, Controller, Delete, Get, Param, Patch, Post, Query} from '@nestjs/common';
import { PanoramasService } from './panoramas.service';
import { CreatePanoramaDto } from './dto/create-panorama.dto';
import { UpdatePanoramaDto } from './dto/update-panorama.dto';

@Controller('panoramas')
export class PanoramasController {
  constructor(private readonly service: PanoramasService) {}

  @Post()
  create(@Body() dto: CreatePanoramaDto) {
    return this.service.create(dto);
  }

  @Get()
    findAll(@Query('rutaId') rutaId?: string) {
      return this.service.findAll(rutaId);
    }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePanoramaDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
