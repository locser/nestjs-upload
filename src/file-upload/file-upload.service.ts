import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { URL_LOCALE } from 'src/oss';
import { LogLevel, LoggerService } from '../logger';

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
      `Bắt đầu lưu phần tệp: ${file.originalname}`,
    );

    try {
      const { name_file, chunk_index, total_chunks, upload_id } = body;

      // Ghi log thông tin phần tệp
      this.logger.application(
        LogLevel.DEBUG,
        `Thông tin phần tệp: name=${name_file}, chunk=${chunk_index}/${total_chunks}, uploadId=${upload_id}`,
        null,
        { fileSize: file.size },
      );

      // Kiểm tra xem upload_id có được cung cấp không
      if (!upload_id) {
        this.logger.application(
          LogLevel.ERROR,
          'upload_id không được cung cấp cho tải lên phần tệp',
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
          `Tạo thư mục mới cho uploadId: ${upload_id}`,
        );
        fs.mkdirSync(chunkDir, { recursive: true });
      }

      // Di chuyển phần tệp từ vị trí tạm thời đến thư mục đích
      const chunkPath = path.join(chunkDir, `chunk_${chunk_index}`);
      fs.renameSync(file.path, chunkPath);

      this.logger.application(
        LogLevel.INFO,
        `Đã lưu phần ${parseInt(chunk_index) + 1}/${total_chunks} của tệp ${name_file}`,
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
        { error: error.stack },
      );
      throw new BadRequestException(`Không thể lưu phần tệp: ${error.message}`);
    }
  }

  /**
   * Lưu nhiều chunk của một phần tệp lớn vào thư mục tạm thời
   * @description Phương pháp upload cải tiến: xử lý nhiều chunk được gửi trong một request
   * @param files - Mảng các chunk file được tải lên
   * @param body - Thông tin bổ sung về phần tệp, bao gồm:
   *               - name_file: Tên tệp
   *               - part_index: Chỉ số của phần lớn
   *               - total_parts: Tổng số phần lớn
   *               - upload_id: ID duy nhất do client tạo
   *               - chunk_start_index: Chỉ số bắt đầu của các chunk trong phần này (tùy chọn)
   * @returns Thông tin về các chunk đã được lưu
   */
  async saveMultipleChunks(
    files: Express.Multer.File[],
    body: any,
  ): Promise<any> {
    const { name_file, total_parts, upload_id } = body;

    const part_index = +body.part_index;
    const chunk_start_index = +body.chunk_start_index || 0;

    this.logger.application(
      LogLevel.INFO,
      `Bắt đầu lưu ${files.length} chunk của phần ${part_index + 1}/${total_parts} cho tệp: ${name_file}`,
    );

    try {
      // Kiểm tra xem upload_id có được cung cấp không
      if (!upload_id) {
        this.logger.application(
          LogLevel.ERROR,
          'upload_id không được cung cấp cho tải lên nhiều chunk',
        );
        throw new BadRequestException(
          'upload_id is required for multi-chunk uploads',
        );
      }

      // Tạo cấu trúc thư mục cho việc lưu trữ các chunk
      // Format: uploads/[upload_id]/chunks/
      this.logger.info(
        `Tạo thư mục chunks cho uploadId ${upload_id} ${URL_LOCALE}`,
      );
      const chunksDir = path.join(URL_LOCALE, upload_id);

      if (!fs.existsSync(chunksDir)) {
        this.logger.application(
          LogLevel.DEBUG,
          `Tạo thư mục chunks cho uploadId ${upload_id}`,
        );
        fs.mkdirSync(chunksDir, { recursive: true });
      }

      // Lưu từng chunk vào thư mục tương ứng
      const savedChunks = [];
      // const chunk_start_index = (total_parts + 1) * files.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const chunkIndex = chunk_start_index + i;

        // Tạo đường dẫn đến file chunk với format "chunks_X"
        const chunkPath = path.join(chunksDir, `chunks_${chunkIndex}`);

        // Di chuyển file từ vị trí tạm thời đến thư mục đích
        fs.renameSync(file.path, chunkPath);

        this.logger.application(
          LogLevel.DEBUG,
          `Đã lưu chunk ${chunkIndex} của phần ${part_index + 1}/${total_parts}`,
          null,
          { fileSize: file.size },
        );

        savedChunks.push({
          chunkIndex,
          size: file.size,
          path: chunkPath,
        });
      }

      this.logger.application(
        LogLevel.INFO,
        `Đã lưu thành công ${files.length} chunk của phần ${part_index + 1}/${total_parts} cho tệp ${upload_id}`,
      );

      return {
        success: true,
        message: `Đã lưu thành công ${files.length} chunk của phần ${part_index + 1}/${total_parts} cho tệp ${upload_id}`,
        part_index,
        total_parts,
        name_file,
        upload_id,
        chunks: savedChunks,
        total_chunks_saved: savedChunks.length,
      };
    } catch (error) {
      this.logger.application(
        LogLevel.ERROR,
        `Lỗi khi lưu nhiều chunk: ${error.message}`,
        null,
        { error: error.stack },
      );
      throw new BadRequestException(
        `Không thể lưu các chunk: ${error.message}`,
      );
    }
  }

  /**
   * Phương thức cũ - giữ lại để tương thích ngược
   * @deprecated Sử dụng saveMultipleChunks thay thế
   */
  async saveFileChunk2(file: Express.Multer.File, body: any): Promise<any> {
    this.logger.application(
      LogLevel.INFO,
      `Bắt đầu lưu phần tệp: ${file.originalname}`,
    );

    try {
      const { name_file, chunk_index, total_chunks, upload_id } = body;

      // Ghi log thông tin phần tệp
      this.logger.application(
        LogLevel.DEBUG,
        `Thông tin phần tệp: name=${name_file}, chunk=${chunk_index}/${total_chunks}, uploadId=${upload_id}`,
        null,
        { fileSize: file.size },
      );

      // Kiểm tra xem upload_id có được cung cấp không
      if (!upload_id) {
        this.logger.application(
          LogLevel.ERROR,
          'upload_id không được cung cấp cho tải lên phần tệp',
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
          `Tạo thư mục mới cho uploadId: ${upload_id}`,
        );
        fs.mkdirSync(chunkDir, { recursive: true });
      }

      // Di chuyển phần tệp từ vị trí tạm thời đến thư mục đích
      const chunkPath = path.join(chunkDir, `chunk_${chunk_index}`);
      fs.renameSync(file.path, chunkPath);

      this.logger.application(
        LogLevel.INFO,
        `Đã lưu phần ${parseInt(chunk_index) + 1}/${total_chunks} của tệp ${name_file}`,
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
        { error: error.stack },
      );
      throw new BadRequestException(`Không thể lưu phần tệp: ${error.message}`);
    }
  }

  /**
   * Hợp nhất các phần tệp thành một tệp hoàn chỉnh
   * @description Hỗ trợ cả cấu trúc thư mục cũ và mới (với các phần lớn)
   * @param uploadId - ID duy nhất của quá trình tải lên để tránh trùng lặp
   * @returns Thông tin về tệp đã được hợp nhất
   */
  async mergeChunks(uploadId: string): Promise<any> {
    this.logger.application(
      LogLevel.INFO,
      `Bắt đầu hợp nhất các phần tệp với uploadId: ${uploadId}`,
    );

    try {
      const uploadDir = path.join(URL_LOCALE, uploadId);

      // Kiểm tra xem thư mục chứa các phần tệp có tồn tại không
      if (!fs.existsSync(uploadDir)) {
        this.logger.application(
          LogLevel.ERROR,
          `Không tìm thấy thư mục chứa các phần của tệp ${uploadId}`,
        );
        throw new BadRequestException(
          `Không tìm thấy thư mục chứa các phần của tệp ${uploadId}`,
        );
      }

      // Đặt tên tệp đích (tránh trùng với tên thư mục)
      const outputFileName = `merged_${uploadId}`;
      const outputPath = path.join(URL_LOCALE, outputFileName);
      const outputStream: fs.WriteStream = fs.createWriteStream(outputPath);

      this.logger.application(LogLevel.DEBUG, `Tạo tệp đích: ${outputPath}`);

      // Kiểm tra cấu trúc thư mục để xác định phương pháp hợp nhất
      const dirEntries = fs.readdirSync(uploadDir, { withFileTypes: true });

      // Kiểm tra xem có thư mục 'chunks' không
      const hasChunksDir = dirEntries.some(
        (entry) => entry.isDirectory() && entry.name === 'chunks',
      );

      // Kiểm tra xem có các thư mục part_X không (phương pháp cũ)
      const hasParts = dirEntries.some(
        (entry) => entry.isDirectory() && entry.name.startsWith('part_'),
      );

      if (hasChunksDir) {
        // Phương pháp mới nhất: có thư mục chunks
        this.logger.application(
          LogLevel.INFO,
          `Phát hiện cấu trúc thư mục mới với thư mục chunks`,
        );

        const chunksDir = path.join(uploadDir, 'chunks');

        // Lấy và sắp xếp các chunks theo thứ tự
        const chunkFiles = fs
          .readdirSync(chunksDir)
          .filter((file) => file.startsWith('chunks_'))
          .sort((a, b) => {
            const chunkA = parseInt(a.split('_')[1]);
            const chunkB = parseInt(b.split('_')[1]);
            return chunkA - chunkB;
          });

        this.logger.application(
          LogLevel.DEBUG,
          `Tìm thấy ${chunkFiles.length} chunks để hợp nhất`,
        );

        if (chunkFiles.length === 0) {
          this.logger.application(
            LogLevel.ERROR,
            `Không tìm thấy chunks trong thư mục ${chunksDir}`,
          );
          throw new BadRequestException(
            `Không tìm thấy chunks trong thư mục ${chunksDir}`,
          );
        }

        // Hợp nhất các chunks
        for (const chunkFile of chunkFiles) {
          const chunkPath = path.join(chunksDir, chunkFile);
          this.logger.application(
            LogLevel.DEBUG,
            `Đang xử lý chunk: ${chunkPath}`,
          );
          outputStream.write(fs.readFileSync(chunkPath));
        }
      } else if (hasParts) {
        // Phương pháp cũ: có các thư mục part_X
        this.logger.application(
          LogLevel.INFO,
          `Phát hiện cấu trúc thư mục cũ với các phần lớn`,
        );

        // Lấy danh sách các thư mục part_X và sắp xếp theo thứ tự
        const partDirs = dirEntries
          .filter(
            (entry) => entry.isDirectory() && entry.name.startsWith('part_'),
          )
          .map((entry) => entry.name)
          .sort((a, b) => {
            const partA = parseInt(a.split('_')[1]);
            const partB = parseInt(b.split('_')[1]);
            return partA - partB;
          });

        this.logger.application(
          LogLevel.DEBUG,
          `Tìm thấy ${partDirs.length} phần lớn để hợp nhất`,
        );

        if (partDirs.length === 0) {
          this.logger.application(
            LogLevel.ERROR,
            `Không tìm thấy các phần lớn của tệp ${uploadId}`,
          );
          throw new BadRequestException(
            `Không tìm thấy các phần lớn của tệp ${uploadId}`,
          );
        }

        // Xử lý từng phần lớn
        for (const partDir of partDirs) {
          const fullPartDir = path.join(uploadDir, partDir);

          // Lấy và sắp xếp các chunk trong phần lớn này
          const chunkFiles = fs
            .readdirSync(fullPartDir)
            .filter((file) => file.startsWith('chunk_'))
            .sort((a, b) => {
              const chunkA = parseInt(a.split('_')[1]);
              const chunkB = parseInt(b.split('_')[1]);
              return chunkA - chunkB;
            });

          this.logger.application(
            LogLevel.DEBUG,
            `Đang xử lý ${chunkFiles.length} chunk trong phần ${partDir}`,
          );

          // Hợp nhất các chunk trong phần lớn này
          for (const chunkFile of chunkFiles) {
            const chunkPath = path.join(fullPartDir, chunkFile);
            outputStream.write(fs.readFileSync(chunkPath));
          }
        }
      } else {
        // Phương pháp cũ nhất: các chunk nằm trực tiếp trong thư mục uploadId
        this.logger.application(
          LogLevel.INFO,
          `Phát hiện cấu trúc thư mục cũ với các chunk trực tiếp`,
        );

        // Lấy và sắp xếp các phần tệp theo thứ tự
        const files = fs
          .readdirSync(uploadDir)
          .filter((file) => file.startsWith('chunks_'))
          .sort(
            (a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]),
          );

        this.logger.application(
          LogLevel.DEBUG,
          `Tìm thấy ${files.length} phần tệp để hợp nhất`,
        );

        if (files.length === 0) {
          this.logger.application(
            LogLevel.ERROR,
            `Không tìm thấy các phần của tệp ${uploadId}`,
          );
          throw new BadRequestException(
            `Không tìm thấy các phần của tệp ${uploadId}`,
          );
        }

        // Hợp nhất các phần tệp
        for (const fileName of files) {
          const chunkPath = path.join(uploadDir, fileName);
          this.logger.application(
            LogLevel.DEBUG,
            `Đang xử lý phần tệp: ${chunkPath}`,
          );
          outputStream.write(fs.readFileSync(chunkPath));
        }
      }

      outputStream.end();

      // Đợi cho đến khi tệp được ghi hoàn tất
      await new Promise<void>((resolve, reject) => {
        outputStream.on('finish', () => {
          this.logger.application(
            LogLevel.INFO,
            `Hợp nhất tệp thành công: ${outputPath}`,
          );
          resolve();
        });

        outputStream.on('error', (error) => {
          this.logger.application(
            LogLevel.ERROR,
            `Lỗi khi ghi tệp: ${error.message}`,
            null,
            { error: error.stack },
          );
          reject(error);
        });
      });

      // Xóa thư mục chứa các phần tệp
      this.removeChunkFolder(uploadDir);

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
        { error: error.stack },
      );
      throw new BadRequestException(
        `Không thể hợp nhất các phần tệp: ${error.message}`,
      );
    }
  }

  /**
   * Xóa thư mục chứa các phần tệp sau khi đã hợp nhất
   * @description Hỗ trợ xóa cả cấu trúc thư mục phức tạp với các thư mục con
   * @param folderPath - Đường dẫn đến thư mục cần xóa
   */
  private removeChunkFolder(folderPath: string): void {
    this.logger.application(
      LogLevel.INFO,
      `Bắt đầu xóa thư mục: ${folderPath}`,
    );

    try {
      // Hàm đệ quy để xóa thư mục và tất cả nội dung bên trong
      const deleteFolderRecursive = (currentPath: string) => {
        if (fs.existsSync(currentPath)) {
          const entries = fs.readdirSync(currentPath, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);

            if (entry.isDirectory()) {
              // Nếu là thư mục, gọi đệ quy để xóa nội dung bên trong trước
              deleteFolderRecursive(fullPath);
            } else {
              // Nếu là file, xóa trực tiếp
              fs.unlinkSync(fullPath);
              this.logger.application(
                LogLevel.DEBUG,
                `Đã xóa tệp: ${fullPath}`,
              );
            }
          }

          // Sau khi đã xóa hết nội dung, xóa thư mục
          fs.rmdirSync(currentPath);
          this.logger.application(
            LogLevel.DEBUG,
            `Đã xóa thư mục: ${currentPath}`,
          );
        }
      };

      // Bắt đầu xóa từ thư mục gốc
      deleteFolderRecursive(folderPath);

      this.logger.application(
        LogLevel.INFO,
        `Đã xóa thư mục ${folderPath} và tất cả nội dung bên trong thành công`,
      );
    } catch (error) {
      this.logger.application(
        LogLevel.ERROR,
        `Lỗi khi xóa thư mục ${folderPath}: ${error.message}`,
        null,
        { error: error.stack },
      );
    }
  }
}
