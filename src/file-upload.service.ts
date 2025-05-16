import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { LoggerService, LogLevel } from './logger';
import { URL_LOCALE } from './oss';

@Injectable()
export class FileUploadService implements OnModuleInit {
  constructor(private readonly logger: LoggerService) {}
  
  onModuleInit() {
    // Thiết lập context cho logger (tùy chọn, logger sẽ tự động phát hiện nếu không được thiết lập)
    this.logger.setContext('FileUploadService');
  }
  
  /**
   * Lưu một phần của tệp lớn vào thư mục tạm thời
   * @param file - Thông tin về phần tệp đang được tải lên
   * @param body - Thông tin bổ sung về phần tệp, bao gồm:
   *               - name_file: Tên tệp
   *               - chunk_index: Chỉ số của phần tệp
   *               - total_chunks: Tổng số phần tệp
   *               - upload_id: ID duy nhất do client tạo (timestamp + tên tệp)
   * @returns Thông tin về phần tệp đã được lưu
   */
  async saveFileChunk(file: Express.Multer.File, body: any): Promise<any> {
    this.logger.application(
      LogLevel.INFO,
      `Bắt đầu lưu phần tệp: ${file.originalname}`
    );
    
    try {
      const { name_file, chunk_index, total_chunks, upload_id } = body;

      // Ghi log thông tin phần tệp
      this.logger.application(
        LogLevel.DEBUG,
        `Thông tin phần tệp: name=${name_file}, chunk=${chunk_index}/${total_chunks}, uploadId=${upload_id}`,
        null,
        { fileSize: file.size }
      );

      // Kiểm tra xem upload_id có được cung cấp không
      if (!upload_id) {
        this.logger.application(
          LogLevel.ERROR,
          'upload_id không được cung cấp cho tải lên phần tệp'
        );
        throw new BadRequestException(
          'upload_id is required for chunked uploads',
        );
      }

      // Sử dụng chính xác upload_id từ client
      // Tạo thư mục cho tệp này với định danh duy nhất để tránh trùng lặp
      const chunkDir = path.join(URL_LOCALE, upload_id);

      if (!fs.existsSync(chunkDir)) {
        this.logger.application(
          LogLevel.DEBUG,
          `Tạo thư mục mới cho uploadId: ${upload_id}`
        );
        fs.mkdirSync(chunkDir, { recursive: true });
      }

      // Di chuyển phần tệp từ vị trí tạm thời đến thư mục đích
      const chunkPath = path.join(chunkDir, `chunk_${chunk_index}`);
      fs.renameSync(file.path, chunkPath);

      this.logger.application(
        LogLevel.INFO,
        `Đã lưu phần ${parseInt(chunk_index) + 1}/${total_chunks} của tệp ${name_file}`
      );

      return {
        success: true,
        message: `Đã lưu phần ${parseInt(chunk_index) + 1}/${total_chunks} của tệp ${name_file}`,
        chunk_index,
        total_chunks,
        name_file,
        upload_id, // Trả về upload_id từ client
      };
    } catch (error) {
      this.logger.application(
        LogLevel.ERROR,
        `Lỗi khi lưu phần tệp: ${error.message}`,
        null,
        { error: error.stack }
      );
      throw new BadRequestException(`Không thể lưu phần tệp: ${error.message}`);
    }
  }

  /**
   * Hợp nhất các phần tệp thành một tệp hoàn chỉnh
   * @param fileName - Tên tệp cần hợp nhất
   * @param uploadId - ID duy nhất của quá trình tải lên để tránh trùng lặp
   * @returns Thông tin về tệp đã được hợp nhất
   */
  async mergeChunks(uploadId: string): Promise<any> {
    this.logger.application(
      LogLevel.INFO,
      `Bắt đầu hợp nhất các phần tệp với uploadId: ${uploadId}`
    );
    
    try {
      const chunkDir = path.join(URL_LOCALE, uploadId);

      // Kiểm tra xem thư mục chứa các phần tệp có tồn tại không
      if (!fs.existsSync(chunkDir)) {
        this.logger.application(
          LogLevel.ERROR,
          `Không tìm thấy thư mục chứa các phần của tệp ${uploadId}`
        );
        throw new BadRequestException(
          `Không tìm thấy thư mục chứa các phần của tệp ${uploadId}`,
        );
      }

      // Lấy và sắp xếp các phần tệp theo thứ tự
      const files = fs
        .readdirSync(chunkDir)
        .sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));

      this.logger.application(
        LogLevel.DEBUG,
        `Tìm thấy ${files.length} phần tệp để hợp nhất`
      );

      if (files.length === 0) {
        this.logger.application(
          LogLevel.ERROR,
          `Không tìm thấy các phần của tệp ${uploadId}`
        );
        throw new BadRequestException(
          `Không tìm thấy các phần của tệp ${uploadId}`,
        );
      }

      // Đặt tên tệp đích (tránh trùng với tên thư mục)
      const outputFileName = `merged_${uploadId}`;
      const outputPath = path.join(URL_LOCALE, outputFileName);
      const outputStream: fs.WriteStream = fs.createWriteStream(outputPath);

      this.logger.application(
        LogLevel.DEBUG,
        `Tạo tệp đích: ${outputPath}`
      );

      // Hợp nhất các phần tệp
      for (const fileName of files) {
        const chunkPath = path.join(chunkDir, fileName);
        this.logger.application(
          LogLevel.DEBUG,
          `Đang xử lý phần tệp: ${chunkPath}`
        );
        outputStream.write(fs.readFileSync(chunkPath));
      }

      outputStream.end();

      // Đợi cho đến khi tệp được ghi hoàn tất
      await new Promise<void>((resolve, reject) => {
        outputStream.on('finish', () => {
          this.logger.application(
            LogLevel.INFO,
            `Hợp nhất tệp thành công: ${outputPath}`
          );
          resolve();
        });

        outputStream.on('error', (error) => {
          this.logger.application(
            LogLevel.ERROR,
            `Lỗi khi ghi tệp: ${error.message}`,
            null,
            { error: error.stack }
          );
          reject(error);
        });
      });

      // Xóa thư mục chứa các phần tệp
      this.removeChunkFolder(chunkDir);

      return {
        success: true,
        message: `Đã hợp nhất thành công tệp ${uploadId}`,
        filePath: outputPath,
      };
    } catch (error) {
      this.logger.application(
        LogLevel.ERROR,
        `Lỗi khi hợp nhất các phần tệp: ${error.message}`,
        null,
        { error: error.stack }
      );
      throw new BadRequestException(
        `Không thể hợp nhất các phần tệp: ${error.message}`,
      );
    }
  }

  /**
   * Xóa thư mục chứa các phần tệp sau khi đã hợp nhất
   * @param folderPath - Đường dẫn đến thư mục cần xóa
   */
  private removeChunkFolder(folderPath: string): void {
    this.logger.application(
      LogLevel.INFO,
      `Bắt đầu xóa thư mục: ${folderPath}`
    );
    
    try {
      // Xóa tất cả các tệp trong thư mục
      const files = fs.readdirSync(folderPath);
      
      this.logger.application(
        LogLevel.DEBUG,
        `Tìm thấy ${files.length} tệp trong thư mục ${folderPath}`
      );
      
      for (const file of files) {
        const filePath = path.join(folderPath, file);
        fs.unlinkSync(filePath);
        
        this.logger.application(
          LogLevel.DEBUG,
          `Đã xóa tệp: ${filePath}`
        );
      }

      // Xóa thư mục
      fs.rmdirSync(folderPath);

      this.logger.application(
        LogLevel.INFO,
        `Đã xóa thư mục ${folderPath} thành công`
      );
    } catch (error) {
      this.logger.application(
        LogLevel.ERROR,
        `Lỗi khi xóa thư mục ${folderPath}: ${error.message}`,
        null,
        { error: error.stack }
      );
    }
  }
}
