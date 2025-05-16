import {
  Injectable,
  LoggerService as NestLoggerService,
  Scope,
} from '@nestjs/common';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as winston from 'winston';
import {
  APPLICATION_LOG_FILENAME,
  ERROR_LOG_FILENAME,
  LOG_DATE_FORMAT,
  LOG_FOLDER,
  LogLevel,
  LogSource,
  SYSTEM_LOG_FILENAME,
} from './logger.constants';
import { LogInfo, LoggerConfig } from './logger.interfaces';

/**
 * Hàm trợ giúp để lấy tên class từ stack trace
 */
function getCallerInfo(): { className: string; methodName: string } {
  const stackLines = new Error().stack.split('\n');

  // Bỏ qua 3 dòng đầu tiên (Error, getCallerInfo, và phương thức logger)
  for (let i = 3; i < stackLines.length; i++) {
    const line = stackLines[i].trim();

    // Tìm kiếm tên class và phương thức
    const match = line.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/);
    if (match) {
      const parts = match[1].split('.');
      if (parts.length >= 2) {
        return {
          className: parts[0],
          methodName: parts[1],
        };
      }
    }

    // Kiểm tra định dạng khác
    const matchAlt = line.match(/at\s+(.*)\s+\[(.*):(\d+):(\d+)\]/);
    if (matchAlt) {
      const parts = matchAlt[1].split('.');
      if (parts.length >= 2) {
        return {
          className: parts[0],
          methodName: parts[1],
        };
      }
    }
  }

  return { className: 'Unknown', methodName: 'unknown' };
}

/**
 * Service logger tùy chỉnh
 * @description Triển khai logger tùy chỉnh sử dụng winston
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private readonly systemLogger: winston.Logger;
  private readonly applicationLogger: winston.Logger;
  private readonly config: LoggerConfig;
  private context?: string;

  /**
   * Constructor
   * @param config Cấu hình logger
   */
  constructor(config?: Partial<LoggerConfig>) {
    // Cấu hình mặc định
    this.config = {
      level: LogLevel.INFO,
      console: true,
      file: false,
      folder: LOG_FOLDER,
      dateFormat: LOG_DATE_FORMAT,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      ...config,
    };

    // Tạo thư mục logs nếu chưa tồn tại
    if (this.config.file && this.config.folder) {
      if (!fs.existsSync(this.config.folder)) {
        fs.mkdirSync(this.config.folder, { recursive: true });
      }
    }

    // Khởi tạo logger cho hệ thống
    this.systemLogger = this.createLogger(LogSource.SYSTEM);

    // Khởi tạo logger cho ứng dụng
    this.applicationLogger = this.createLogger(LogSource.APPLICATION);
  }

  /**
   * Thiết lập context cho logger
   * @param context Tên context
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Lấy context hiện tại hoặc tự động phát hiện từ stack trace
   */
  private getContext(providedContext?: string): string {
    if (providedContext) {
      return providedContext;
    }

    if (this.context) {
      return this.context;
    }

    return getCallerInfo().className;
  }

  /**
   * Tạo logger với cấu hình cho từng nguồn log
   * @param source Nguồn log (hệ thống hoặc ứng dụng)
   * @returns Winston logger
   */
  private createLogger(source: LogSource): winston.Logger {
    const { combine, timestamp, printf } = winston.format;

    // Định dạng log với màu sắc cho các level
    const logFormat = printf(
      ({ level, message, timestamp, context, ...meta }) => {
        const contextStr = context ? `[${context}]` : '';
        const metaStr =
          Object.keys(meta).length && !('error' in meta)
            ? ` ${JSON.stringify(meta)}`
            : '';

        let errorStr = '';
        if (meta.error) {
          const error = meta.error as any;
          errorStr = `\n${error.stack || error.message || JSON.stringify(error)}`;
        }

        // Định dạng nguồn log với màu sắc nổi bật
        const sourceStr = source === LogSource.SYSTEM ? 'SYSTEM' : 'APP';

        // Sử dụng chalk để tạo màu cho nguồn log - sử dụng try-catch để tránh lỗi
        let formattedSource = '';
        try {
          if (source === LogSource.SYSTEM) {
            formattedSource = `[${chalk.bgBlue.white.bold(sourceStr)}]`;
          } else {
            formattedSource = `[${chalk.bgGreen.black.bold(sourceStr)}]`;
          }
        } catch (error) {
          formattedSource = `[${sourceStr}]`;
        }

        // Định dạng dấu gạch ngang
        let separator = '';
        try {
          separator = chalk.gray(' - ');
        } catch (error) {
          separator = ' - ';
        }

        // Định dạng thời gian với màu xám nhạt
        let formattedTime = '';
        try {
          formattedTime = chalk.gray(`[${timestamp}]`);
        } catch (error) {
          formattedTime = `[${timestamp}]`;
        }

        // Định dạng level với màu sắc và biểu tượng
        let levelStr = '';
        let levelIcon = '';

        switch (level.toLowerCase()) {
          case 'debug':
            levelIcon = '🔍';
            try {
              levelStr = `[${chalk.blue.bold('DEBUG')}]`;
            } catch (error) {
              levelStr = `[DEBUG]`;
            }
            break;
          case 'info':
            levelIcon = '✅';
            try {
              levelStr = `[${chalk.green.bold('INFO')}]`;
            } catch (error) {
              levelStr = `[INFO]`;
            }
            break;
          case 'warn':
            levelIcon = '⚠️';
            try {
              levelStr = `[${chalk.yellow.bold('WARN')}]`;
            } catch (error) {
              levelStr = `[WARN]`;
            }
            break;
          case 'error':
            levelIcon = '❌';
            try {
              levelStr = `[${chalk.red.bold('ERROR')}]`;
            } catch (error) {
              levelStr = `[ERROR]`;
            }
            break;
          default:
            try {
              levelStr = `[${chalk.white.bold(level.toUpperCase())}]`;
            } catch (error) {
              levelStr = `[${level.toUpperCase()}]`;
            }
        }

        // Định dạng context với màu xanh dương nhạt
        let formattedContext = '';
        try {
          formattedContext = contextStr ? chalk.cyan(contextStr) : '';
        } catch (error) {
          formattedContext = contextStr;
        }

        // Định dạng message với màu phù hợp theo level
        let formattedMessage = '';
        try {
          switch (level.toLowerCase()) {
            case 'debug':
              formattedMessage = chalk.magenta(String(message));
              break;
            case 'info':
              formattedMessage = chalk.white(String(message));
              break;
            case 'warn':
              formattedMessage = chalk.yellow(String(message));
              break;
            case 'error':
              formattedMessage = chalk.red(String(message));
              break;
            default:
              formattedMessage = chalk.white(String(message));
          }
        } catch (error) {
          formattedMessage = String(message);
        }

        // Định dạng metadata với màu xám
        let formattedMeta = '';
        try {
          formattedMeta = metaStr ? chalk.gray(metaStr) : '';
        } catch (error) {
          formattedMeta = metaStr;
        }

        // Định dạng lỗi với màu đỏ đậm
        let formattedError = '';
        try {
          formattedError = errorStr ? chalk.red(errorStr) : '';
        } catch (error) {
          formattedError = errorStr;
        }

        // Định dạng theo yêu cầu: [Log hệ thống hay người dùng tự log] - [time DD/MM/YYYY HH:mm:ss] [level log] [where log / context] message
        return `${formattedSource}${separator}${formattedTime} ${levelIcon} ${levelStr} ${formattedContext} ${formattedMessage}${formattedMeta}${formattedError}`;
      },
    );

    // Định dạng log cho file (không có màu sắc)
    const fileLogFormat = printf(
      ({ level, message, timestamp, context, ...meta }) => {
        const contextStr = context ? `[${context}]` : '';
        const metaStr =
          Object.keys(meta).length && !('error' in meta)
            ? ` ${JSON.stringify(meta)}`
            : '';

        let errorStr = '';
        if (meta.error) {
          const error = meta.error as any;
          errorStr = `\n${error.stack || error.message || JSON.stringify(error)}`;
        }

        // Định dạng nguồn log
        const sourceStr = source === LogSource.SYSTEM ? 'SYSTEM' : 'APP';

        // Định dạng theo yêu cầu: [Log hệ thống hay người dùng tự log] - [time DD/MM/YYYY HH:mm:ss] [level log] [where log / context] message
        return `[${sourceStr}] - [${timestamp}] [${level.toUpperCase()}] ${contextStr} ${message}${metaStr}${errorStr}`;
      },
    );

    // Danh sách transports
    const transports: winston.transport[] = [];

    // Thêm console transport nếu được cấu hình
    if (this.config.console) {
      transports.push(
        new winston.transports.Console({
          format: combine(
            timestamp({ format: this.config.dateFormat }),
            logFormat,
          ),
        }),
      );
    }

    // Thêm file transport nếu được cấu hình
    if (this.config.file && this.config.folder) {
      // File log chung cho nguồn log
      const filename =
        source === LogSource.SYSTEM
          ? SYSTEM_LOG_FILENAME
          : APPLICATION_LOG_FILENAME;

      // Tạo file transport với các tùy chọn hợp lệ
      const fileTransport = new winston.transports.File({
        filename: path.join(this.config.folder, filename),
        format: combine(
          timestamp({ format: this.config.dateFormat }),
          fileLogFormat,
        ),
        maxFiles: this.config.maxFiles,
      });

      // Thiết lập kích thước tối đa cho file nếu được cấu hình
      if (this.config.maxFileSize) {
        (fileTransport as any).maxsize = this.config.maxFileSize;
      }

      transports.push(fileTransport);

      // File log riêng cho lỗi
      const errorFileTransport = new winston.transports.File({
        filename: path.join(this.config.folder, ERROR_LOG_FILENAME),
        level: LogLevel.ERROR,
        format: combine(
          timestamp({ format: this.config.dateFormat }),
          fileLogFormat,
        ),
        maxFiles: this.config.maxFiles,
      });

      // Thiết lập kích thước tối đa cho file lỗi nếu được cấu hình
      if (this.config.maxFileSize) {
        (errorFileTransport as any).maxsize = this.config.maxFileSize;
      }

      transports.push(errorFileTransport);
    }

    // Tạo và trả về logger
    return winston.createLogger({
      level: this.config.level,
      format: combine(
        timestamp({
          format: this.config.dateFormat,
        }),
      ),
      transports,
    });
  }
  /**
   * Ghi log với thông tin chi tiết
   * @param logInfo Thông tin log
   */
  log(logInfo: LogInfo): void;
  log(message: any, context?: string): void;
  log(messageOrLogInfo: any, context?: string): void {
    if (typeof messageOrLogInfo === 'object' && 'message' in messageOrLogInfo) {
      const logInfo = messageOrLogInfo as LogInfo;
      const logger =
        logInfo.source === LogSource.SYSTEM
          ? this.systemLogger
          : this.applicationLogger;

      const { message, level, context, data, error } = logInfo;
      const meta = { context: this.getContext(context), ...(data || {}) };

      if (error) {
        meta['error'] = {
          message: error.message,
          stack: error.stack,
        };
      }

      logger.log(level, message, meta);
    } else {
      this.applicationLogger.info(messageOrLogInfo, {
        context: this.getContext(context),
      });
    }
  }

  /**
   * Ghi log debug
   * @param message Thông điệp log
   * @param context Context của log
   */
  debug(message: any, context?: string): void {
    // Thêm biểu tượng vào message nếu là string
    let formattedMessage = message;
    if (typeof message === 'string') {
      formattedMessage = `🔍 ${message}`;
    }

    this.applicationLogger.debug(formattedMessage, {
      context: this.getContext(context),
    });
  }

  /**
   * Ghi log thông tin
   * @param message Thông điệp log
   * @param context Context của log
   */
  info(message: any, context?: string): void {
    // Thêm biểu tượng vào message nếu là string
    let formattedMessage = message;
    if (typeof message === 'string') {
      formattedMessage = `✅ ${message}`;
    }

    this.applicationLogger.info(formattedMessage, {
      context: this.getContext(context),
    });
  }

  /**
   * Ghi log cảnh báo
   * @param message Thông điệp log
   * @param context Context của log
   */
  warn(message: any, context?: string): void {
    // Thêm biểu tượng vào message nếu là string
    let formattedMessage = message;
    if (typeof message === 'string') {
      formattedMessage = `⚠️ ${message}`;
    }

    this.applicationLogger.warn(formattedMessage, {
      context: this.getContext(context),
    });
  }

  /**
   * Ghi log lỗi
   * @param message Thông điệp log
   * @param trace Stack trace của lỗi
   * @param context Context của log
   */
  error(message: any, trace?: string, context?: string): void {
    // Thêm biểu tượng vào message nếu là string
    let formattedMessage = message;
    if (typeof message === 'string') {
      formattedMessage = `❌ ${message}`;
    }

    const meta: any = { context: this.getContext(context) };
    if (trace) {
      meta.error = { stack: trace };
    }
    this.applicationLogger.error(formattedMessage, meta);
  }

  /**
   * Ghi log hệ thống
   * @param level Mức độ log
   * @param message Thông điệp log
   * @param context Context của log
   * @param data Dữ liệu bổ sung
   */
  system(level: LogLevel, message: string, context?: string, data?: any): void {
    // Thêm biểu tượng tương ứng với level
    let formattedMessage = message;
    let icon = '';

    try {
      switch (level) {
        case LogLevel.DEBUG:
          icon = '🔍';
          break;
        case LogLevel.INFO:
          icon = '✅';
          break;
        case LogLevel.WARN:
          icon = '⚠️';
          break;
        case LogLevel.ERROR:
          icon = '❌';
          break;
      }

      if (icon) {
        formattedMessage = `${icon} ${message}`;
      }
    } catch (error) {
      // Nếu có lỗi khi thêm biểu tượng, sử dụng message gốc
    }

    this.systemLogger.log(level, formattedMessage, {
      context: this.getContext(context),
      ...(data || {}),
    });
  }

  /**
   * Ghi log ứng dụng
   * @param level Mức độ log
   * @param message Thông điệp log
   * @param context Context của log
   * @param data Dữ liệu bổ sung
   */
  application(
    level: LogLevel,
    message: string,
    context?: string,
    data?: any,
  ): void {
    // Thêm biểu tượng tương ứng với level
    let formattedMessage = message;
    let icon = '';

    try {
      switch (level) {
        case LogLevel.DEBUG:
          icon = '🔍';
          break;
        case LogLevel.INFO:
          icon = '✅';
          break;
        case LogLevel.WARN:
          icon = '⚠️';
          break;
        case LogLevel.ERROR:
          icon = '❌';
          break;
      }

      if (icon) {
        formattedMessage = `${icon} ${message}`;
      }
    } catch (error) {
      // Nếu có lỗi khi thêm biểu tượng, sử dụng message gốc
    }

    this.applicationLogger.log(level, formattedMessage, {
      context: this.getContext(context),
      ...(data || {}),
    });
  }
}
