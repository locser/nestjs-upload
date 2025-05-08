import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FileUploadService } from './file-upload.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, FileUploadService],
})
export class AppModule {}
