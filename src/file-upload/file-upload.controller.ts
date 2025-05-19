import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { LogLevel, LoggerService } from 'src/logger';
import { URL_LOCALE, storage } from 'src/oss';
import { FileUploadService } from './file-upload.service';

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
  fileFilter(_req, file, callback) {
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

@Controller('file-upload')
export class FileUploadController {
  constructor(
    private readonly fileUploadService: FileUploadService,
    private readonly logger: LoggerService,
  ) {
    // Thiết lập context cho logger (tùy chọn, logger sẽ tự động phát hiện nếu không được thiết lập)
    this.logger.setContext('FileUploadController');
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
      fileFilter(_req, file, callback) {
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

  /**
   * API để tải lên nhiều chunk của một phần tệp lớn trong một request
   * @description Phương pháp upload cải tiến: chia file thành nhiều phần lớn,
   * mỗi phần lại chia thành nhiều chunk nhỏ và gửi nhiều chunk trong một request
   */
  @Post('/upload/large-files/2')
  @UseInterceptors(FilesInterceptor('chunks', 100, localOptions))
  async uploadLargeFiles2(
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    // Kiểm tra thông tin cần thiết
    const { part_index, total_parts, upload_id, name_file } = body;

    this.logger.application(
      LogLevel.INFO,
      `Nhận nhiều chunk của phần ${part_index + 1}/${total_parts} cho tệp: ${name_file}`,
      null,
      {
        uploadId: upload_id,
        partIndex: part_index,
        totalParts: total_parts,
        numberOfChunks: files?.length || 0,
        chunk_start_index: body.chunk_start_index,
      },
    );

    // Kiểm tra xem có file nào được tải lên không
    if (!files || files.length === 0) {
      this.logger.application(LogLevel.ERROR, 'Không có tệp nào được tải lên');
      throw new BadRequestException('No files uploaded');
    }

    // Kiểm tra các thông tin bắt buộc
    if (
      !upload_id ||
      part_index === undefined ||
      total_parts === undefined ||
      !name_file
    ) {
      this.logger.application(
        LogLevel.ERROR,
        'Thiếu thông tin bắt buộc cho tải lên nhiều chunk',
        null,
        { body },
      );
      throw new BadRequestException(
        'Missing required information: upload_id, part_index, total_parts, and name_file are required',
      );
    }

    try {
      // Lưu các chunk vào thư mục tạm thời
      const result = await this.fileUploadService.saveMultipleChunks(
        files,
        body,
      );
      return result;
    } catch (error) {
      this.logger.application(
        LogLevel.ERROR,
        `Lỗi khi xử lý nhiều chunk: ${error.message}`,
        null,
        { error: error.stack },
      );
      throw new BadRequestException(
        `Không thể xử lý các chunk: ${error.message}`,
      );
    }
  }
}
