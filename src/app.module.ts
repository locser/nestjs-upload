import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ErrorLoggingModuleModule } from './error-logging/error-logging.module';
import { FileUploadModule } from './file-upload/file-upload.module';
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
    // TypeOrmModule.forRootAsync({ useClass: TypeOrmConfigService }),
    // ExcelsModule,
    FileUploadModule,
    ErrorLoggingModuleModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // {
    //   provide: APP_FILTER,
    //   useClass: AllExceptionsFilter,
    // },
  ],
})
export class AppModule {}
