import { Module } from '@nestjs/common';
import { PanoramasService } from './panoramas.service';
import { PanoramasController } from './panoramas.controller';

@Module({
  controllers: [PanoramasController],
  providers: [PanoramasService],
  exports: [PanoramasService],
})
export class PanoramasModule {}
