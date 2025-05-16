import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmConfigService } from './database/typeorm.config';
import { ExcelsModule } from './excels/excels.module';
import { FileUploadService } from './file-upload.service';
import { LoggerModule } from './logger';
import { LogLevel } from './logger/logger.constants';

@Module({
  imports: [
    LoggerModule.forRoot({
      level: LogLevel.DEBUG,
      console: true, // Bật log ra console
      file: false, // Tắt log ra file
      folder: 'logs',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    TypeOrmModule.forRootAsync({ useClass: TypeOrmConfigService }),
    ExcelsModule,
  ],
  controllers: [AppController],
  providers: [AppService, FileUploadService],
})
export class AppModule {}
