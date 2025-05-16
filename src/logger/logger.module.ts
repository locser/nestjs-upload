import { DynamicModule, Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { LoggerConfig } from './logger.interfaces';

/**
 * Module logger
 * @description Module quản lý các service logger
 */
@Global()
@Module({})
export class LoggerModule {
  /**
   * Đăng ký module với cấu hình mặc định
   * @returns Module đã đăng ký
   */
  static register(): DynamicModule {
    return {
      module: LoggerModule,
      providers: [
        {
          provide: LoggerService,
          useFactory: () => {
            return new LoggerService();
          },
        },
      ],
      exports: [LoggerService],
    };
  }

  /**
   * Đăng ký module với cấu hình tùy chỉnh
   * @param config Cấu hình logger
   * @returns Module đã đăng ký
   */
  static forRoot(config: Partial<LoggerConfig>): DynamicModule {
    return {
      module: LoggerModule,
      providers: [
        {
          provide: LoggerService,
          useFactory: () => {
            return new LoggerService(config);
          },
        },
      ],
      exports: [LoggerService],
    };
  }
}
