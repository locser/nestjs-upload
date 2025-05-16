import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoggerService, LogLevel } from './logger';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(private readonly logger: LoggerService) {}

  onModuleInit() {
    // Thiết lập context cho logger (tùy chọn, logger sẽ tự động phát hiện nếu không được thiết lập)
    this.logger.setContext('AppService');
  }

  getHello(): string {
    // Ghi log ứng dụng - không cần truyền context vì đã được thiết lập hoặc tự động phát hiện
    this.logger.application(LogLevel.INFO, 'Phương thức getHello() được gọi');

    // Thử nghiệm các mức độ log khác nhau
    this.logger.debug('Đây là log debug');
    this.logger.info('Đây là log info');
    this.logger.warn('Đây là log cảnh báo');

    try {
      // Giả lập lỗi
      const testError = new Error('Đây là lỗi thử nghiệm');
      throw testError;
    } catch (error) {
      // Ghi log lỗi
      this.logger.error('Đã xảy ra lỗi trong getHello()', error.stack);
    }

    return 'Hello World!';
  }
}
