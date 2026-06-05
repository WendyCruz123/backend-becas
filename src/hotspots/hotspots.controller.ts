import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { HotspotsService } from './hotspots.service';
import { CreateHotspotDto } from './dto/create-hotspot.dto';
import { UpdateHotspotDto } from './dto/update-hotspot.dto';

@Controller('hotspots')
export class HotspotsController {
  constructor(private readonly service: HotspotsService) {}

  @Post()
  create(@Body() dto: CreateHotspotDto) {
    return this.service.create(dto);
  }

  @Get()
  findByPanorama(@Query('panoramaId') panoramaId?: string) {
    return this.service.findByPanorama(panoramaId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHotspotDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
