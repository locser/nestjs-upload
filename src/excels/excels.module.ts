import { Module } from '@nestjs/common';
import { ExcelsService } from './excels.service';
import { ExcelsController } from './excels.controller';

@Module({
  controllers: [ExcelsController],
  providers: [ExcelsService],
})
export class ExcelsModule {}
