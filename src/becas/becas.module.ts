import { Module } from '@nestjs/common';
import { BecasService } from './becas.service';
import { BecasController } from './becas.controller';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ScheduleModule.forRoot()], // 👈 activa el scheduler
  controllers: [BecasController],
  providers: [BecasService],
  exports: [BecasService],
})
export class BecasModule {}
