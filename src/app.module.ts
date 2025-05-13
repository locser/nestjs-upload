import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmConfigService } from './database/typeorm.config';
import { ExcelsModule } from './excels/excels.module';
import { FileUploadService } from './file-upload.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useClass: TypeOrmConfigService }),
    ExcelsModule,
  ],
  controllers: [AppController],
  providers: [AppService, FileUploadService],
})
export class AppModule {}
