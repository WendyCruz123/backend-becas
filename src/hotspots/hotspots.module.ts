import { Module } from '@nestjs/common';
import { HotspotsService } from './hotspots.service';
import { HotspotsController } from './hotspots.controller';

@Module({
  controllers: [HotspotsController],
  providers: [HotspotsService],
})
export class HotspotsModule {}
