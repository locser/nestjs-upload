import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { AppService } from './app.service';
import { FileUploadService } from './file-upload.service';
import { LoggerService, LogLevel } from './logger';
import { storage, URL_LOCALE } from './oss';

/**
 * Tùy chọn cấu hình cho Multer để xử lý tải lên tệp
 */
const localOptions: MulterOptions = {
  dest: URL_LOCALE,
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 1000, // 1000MB
    files: 100, // 100 files
  },
  fileFilter(req, file, callback) {
    console.log('name file', file.originalname);
    // if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
    //   return callback(
    //     new BadRequestException('Only image files are allowed!'),
    //     false,
    //   );
    // }
    callback(null, true);
  },
};

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly fileUploadService: FileUploadService,
    private readonly logger: LoggerService,
  ) {
    // Thiết lập context cho logger (tùy chọn, logger sẽ tự động phát hiện nếu không được thiết lập)
    this.logger.setContext('AppController');
  }

  @Get()
  getHello(): string {
    this.logger.application(LogLevel.INFO, 'Endpoint getHello() được gọi');
    return this.appService.getHello();
  }

  /**
   * API để tải lên một tệp đơn lẻ
   * Giới hạn kích thước tệp là 1MB và chỉ chấp nhận hình ảnh
   */
  @Post('/upload/file')
  @UseInterceptors(
    FileInterceptor('file', {
      ...localOptions,
      limits: {
        fileSize: 1024 * 1024 * 20, // 20MB
        files: 1, // 1 file
      },
      fileFilter(req, file, callback) {
        console.log('name file', file.originalname);
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
          return callback(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    this.logger.application(
      LogLevel.INFO,
      `Tải lên tệp đơn lẻ: ${file ? file.originalname : 'Không có tệp'}`,
      null,
      { fileSize: file?.size, body },
    );

    return {
      success: true,
      message: 'File uploaded successfully',
      file: file
        ? {
            originalname: file.originalname,
            filename: file.filename,
            path: file.path,
            size: file.size,
          }
        : null,
    };
  }

  /**
   * API để tải lên một phần của tệp lớn
   * Lưu trữ các phần trong một thư mục riêng biệt
   */
  @Post('/upload/large-files')
  @UseInterceptors(FileInterceptor('file', localOptions))
  async uploadLargeFiles(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    this.logger.application(
      LogLevel.INFO,
      `Nhận phần tệp: ${file ? file.originalname : 'Không có tệp'}`,
      null,
      {
        fileSize: file?.size,
        chunkIndex: body.chunk_index,
        totalChunks: body.total_chunks,
        uploadId: body.upload_id,
      },
    );

    if (!file) {
      this.logger.application(LogLevel.ERROR, 'Không có tệp được tải lên');
      throw new BadRequestException('No file uploaded');
    }

    // Lưu phần tệp vào thư mục tạm thời
    const result = await this.fileUploadService.saveFileChunk(file, body);

    return result;
  }

  /**
   * API để hợp nhất các phần của tệp lớn thành một tệp hoàn chỉnh
   * Sau khi hợp nhất, xóa thư mục chứa các phần tệp
   */
  @Post('/upload/large-files/merge')
  async mergeLargeFile(@Body() body: { upload_id: string }) {
    this.logger.application(
      LogLevel.INFO,
      `Bắt đầu hợp nhất tệp với upload ID: ${body.upload_id}`,
    );

    if (!body.upload_id) {
      this.logger.application(
        LogLevel.ERROR,
        'Không có upload ID được cung cấp',
      );
      throw new BadRequestException('Upload ID is required');
    }

    // Hợp nhất các phần tệp
    const result = await this.fileUploadService.mergeChunks(body.upload_id);

    this.logger.application(
      LogLevel.INFO,
      `Hợp nhất tệp thành công với upload ID: ${body.upload_id}`,
      null,
      { filePath: result.filePath },
    );

    return result;
  }
}
