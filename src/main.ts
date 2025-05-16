import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'body-parser';
import * as express from 'express';
import { NextFunction, Request, Response } from 'express';
import * as http from 'http';
import { AppModule } from './app.module';
import { LoggerService, LogLevel } from './logger';

async function bootstrap() {
  // Tạo ứng dụng NestJS với logger tùy chỉnh
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Bật buffer logs để tránh mất log trong quá trình khởi động
  });

  // Lấy logger service từ container
  const logger = app.get(LoggerService);

  // Sử dụng logger service cho ứng dụng
  app.useLogger(logger);

  // Ghi log khởi động ứng dụng
  logger.system(LogLevel.INFO, 'Ứng dụng đang khởi động...', 'Bootstrap');

  // Cấu hình kích thước tối đa cho body
  app.use(json({ limit: '500mb' }));
  app.use(urlencoded({ limit: '500mb', extended: true }));

  // Bật CORS
  app.enableCors();

  // Middleware ghi log request
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.application(
        LogLevel.INFO,
        `${req.method} ${req.url} ${res.statusCode} ${duration}ms`,
        'HttpRequest',
      );
    });
    next();
  });

  // Cấu hình thư mục tĩnh
  app.use('/uploads', express.static('uploads'));

  // Lấy server HTTP
  const server = app.getHttpServer();

  // Ghi log thông tin server
  logger.system(
    LogLevel.DEBUG,
    `Server instance: ${server instanceof http.Server}`,
    'Bootstrap',
  );

  // Cấu hình timeout cho server
  server.setTimeout(2 * 60 * 1000);
  server.keepAliveTimeout = 5000;
  server.headersTimeout = 5000;

  // Khởi động server
  const PORT = 3003;
  await app.listen(PORT);

  // Ghi log khi server đã khởi động
  logger.system(
    LogLevel.INFO,
    `Ứng dụng đã khởi động thành công trên cổng ${PORT}`,
    'Bootstrap',
  );
}

bootstrap();
