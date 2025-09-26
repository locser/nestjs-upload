# NestJS với Sentry - Hướng dẫn tích hợp và sử dụng

## Mục lục
1. [Giới thiệu về Sentry](#giới-thiệu-về-sentry)
2. [Cài đặt và cấu hình](#cài-đặt-và-cấu-hình)
3. [Tích hợp Sentry vào NestJS](#tích-hợp-sentry-vào-nestjs)
4. [Error Handling và Exception Filters](#error-handling-và-exception-filters)
5. [Performance Monitoring](#performance-monitoring)
6. [Best Practices](#best-practices)
7. [So sánh với hệ thống hiện tại (Discord Error Logging)](#so-sánh-với-hệ-thống-hiện-tại)

## Giới thiệu về Sentry

Sentry là một platform monitoring và error tracking mạnh mẽ giúp developers:
- **Theo dõi lỗi real-time**: Phát hiện và báo cáo lỗi ngay khi chúng xảy ra
- **Performance monitoring**: Theo dõi hiệu suất ứng dụng
- **Release tracking**: Theo dõi lỗi theo từng version
- **User context**: Hiểu được lỗi ảnh hưởng đến user như thế nào
- **Integration**: Tích hợp với nhiều platform và framework

### Ưu điểm của Sentry so với logging thông thường:
- **Structured error data**: Dữ liệu lỗi được cấu trúc rõ ràng
- **Deduplication**: Tự động gom nhóm các lỗi tương tự
- **Alerting**: Hệ thống cảnh báo thông minh
- **Dashboard**: Giao diện trực quan để phân tích
- **Source maps**: Hỗ trợ debug với source code gốc

## Cài đặt và cấu hình

### 1. Cài đặt packages

```bash
npm install @sentry/node @sentry/profiling-node
# Hoặc
yarn add @sentry/node @sentry/profiling-node
```

### 2. Cấu hình environment variables

```env
# .env
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=development # hoặc production, staging
SENTRY_RELEASE=1.0.0
SENTRY_SAMPLE_RATE=1.0 # 0.0 - 1.0
SENTRY_TRACES_SAMPLE_RATE=0.1 # Performance monitoring
```

### 3. Khởi tạo Sentry trong main.ts

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { AppModule } from './app.module';

// Khởi tạo Sentry trước khi tạo app
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || 'development',
  release: process.env.SENTRY_RELEASE,
  sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '1.0'),
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  integrations: [
    nodeProfilingIntegration(),
  ],
  // Cấu hình beforeSend để filter errors
  beforeSend(event, hint) {
    // Không gửi lỗi 404
    if (event.exception?.values?.[0]?.type === 'NotFoundException') {
      return null;
    }
    return event;
  },
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Cấu hình khác...
  
  await app.listen(3000);
}
bootstrap();
```

## Tích hợp Sentry vào NestJS

### 1. Tạo Sentry Service

```typescript
// src/sentry/sentry.service.ts
import { Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryService {
  /**
   * Gửi error đến Sentry với context
   */
  captureException(error: Error, context?: Record<string, any>): string {
    return Sentry.captureException(error, {
      tags: context?.tags,
      extra: context?.extra,
      user: context?.user,
      level: context?.level || 'error',
    });
  }

  /**
   * Gửi message đến Sentry
   */
  captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): string {
    return Sentry.captureMessage(message, level);
  }

  /**
   * Set user context
   */
  setUser(user: { id?: string; email?: string; username?: string }): void {
    Sentry.setUser(user);
  }

  /**
   * Set tags
   */
  setTag(key: string, value: string): void {
    Sentry.setTag(key, value);
  }

  /**
   * Set extra context
   */
  setExtra(key: string, extra: any): void {
    Sentry.setExtra(key, extra);
  }

  /**
   * Start transaction cho performance monitoring
   */
  startTransaction(name: string, op: string): Sentry.Transaction {
    return Sentry.startTransaction({ name, op });
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    Sentry.addBreadcrumb(breadcrumb);
  }
}
```

### 2. Tạo Sentry Module

```typescript
// src/sentry/sentry.module.ts
import { Global, Module } from '@nestjs/common';
import { SentryService } from './sentry.service';

@Global()
@Module({
  providers: [SentryService],
  exports: [SentryService],
})
export class SentryModule {}
```

### 3. Import vào App Module

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { SentryModule } from './sentry/sentry.module';
// ... other imports

@Module({
  imports: [
    SentryModule,
    // ... other modules
  ],
  // ...
})
export class AppModule {}
```

## Error Handling và Exception Filters

### 1. Cập nhật Exception Filter hiện tại

Dựa trên file `src/configs/all-exceptions.filter.ts` hiện tại, chúng ta có thể tích hợp Sentry:

```typescript
// src/configs/all-exceptions.filter.ts
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Response } from 'express';
import { SentryService } from '../sentry/sentry.service';
import { DiscordErrorService } from '../error-logging/discord-error.service';

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly sentryService: SentryService,
    private readonly discordErrorService: DiscordErrorService,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status: HttpStatus;
    let message: string;
    let data: unknown;

    // Set request context cho Sentry
    this.sentryService.setExtra('request', {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      query: request.query,
      params: request.params,
    });

    if (exception instanceof BadRequestException) {
      status = exception.getStatus();
      message = (exception.getResponse()?.['message'] || []).toString() || 'Error!';
      
      // Không gửi BadRequest lên Sentry (có thể là validation error)
      this.sentryService.addBreadcrumb({
        message: 'Bad Request Exception',
        level: 'warning',
        data: { message, status },
      });
    } else if (exception instanceof HttpException) {
      status = exception.getResponse()?.['status'] || exception.getStatus();
      message = exception.message || 'Error!';
      data = exception.getResponse()?.['data'];

      // Chỉ gửi lỗi 5xx lên Sentry
      if (status >= 500) {
        this.sentryService.captureException(exception as Error, {
          tags: { httpStatus: status.toString() },
          extra: { data },
        });
      }
    } else {
      console.error(exception);
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = (exception as Error)?.message || 'Internal Server Error!';

      // Gửi lỗi 500 lên cả Sentry và Discord
      if (exception instanceof Error) {
        // Gửi lên Sentry
        this.sentryService.captureException(exception, {
          tags: { 
            httpStatus: status.toString(),
            source: 'exception-filter' 
          },
          extra: {
            requestMethod: request.method,
            requestUrl: request.url,
            requestBody: request.body,
          },
        });

        // Vẫn giữ Discord notification cho backward compatibility
        const context = JSON.stringify({
          method: request.method,
          url: request.url,
          body: request.body,
          stack: exception.stack,
          timestamp: new Date().toISOString(),
        });
        
        this.discordErrorService.sendError(exception, context).catch((err) => {
          console.error('Failed to send error to Discord:', err);
        });
      }
    }

    const res = {
      status: status,
      message: message,
      data: data,
    };

    const contextType = host.getType();
    if (contextType === 'http') {
      return response.status(HttpStatus.OK).json(res);
    } else if (contextType === 'rpc') {
      return res;
    }
  }
}
```

### 2. Sentry Interceptor cho Performance Monitoring

```typescript
// src/sentry/sentry.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { SentryService } from './sentry.service';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  constructor(private readonly sentryService: SentryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    
    // Tạo transaction cho performance monitoring
    const transaction = this.sentryService.startTransaction(
      `${method} ${url}`,
      'http.server',
    );

    // Set transaction context
    Sentry.getCurrentHub().configureScope((scope) => {
      scope.setSpan(transaction);
    });

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        // Request thành công
        const duration = Date.now() - startTime;
        transaction.setTag('http.status_code', '200');
        transaction.setData('duration', duration);
        transaction.finish();
      }),
      catchError((error) => {
        // Request lỗi
        const duration = Date.now() - startTime;
        transaction.setTag('http.status_code', error.status || '500');
        transaction.setData('duration', duration);
        transaction.finish();
        throw error;
      }),
    );
  }
}
```

## Performance Monitoring

### 1. Database Query Monitoring

```typescript
// src/sentry/sentry-database.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryDatabaseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const span = Sentry.getCurrentHub().getScope()?.getSpan();
    
    if (span) {
      const childSpan = span.startChild({
        op: 'db.query',
        description: 'Database Query',
      });

      return next.handle().pipe(
        tap(() => {
          childSpan.setStatus('ok');
          childSpan.finish();
        }),
      );
    }

    return next.handle();
  }
}
```

### 2. Custom Performance Tracking

```typescript
// Trong service của bạn
@Injectable()
export class FileUploadService {
  constructor(private readonly sentryService: SentryService) {}

  async uploadLargeFile(file: Express.Multer.File): Promise<any> {
    const transaction = this.sentryService.startTransaction(
      'file-upload',
      'custom',
    );

    try {
      // Bước 1: Validate file
      const validateSpan = transaction.startChild({
        op: 'file.validate',
        description: 'Validate uploaded file',
      });
      
      await this.validateFile(file);
      validateSpan.setStatus('ok');
      validateSpan.finish();

      // Bước 2: Process file
      const processSpan = transaction.startChild({
        op: 'file.process',
        description: 'Process uploaded file',
      });
      
      const result = await this.processFile(file);
      processSpan.setStatus('ok');
      processSpan.finish();

      transaction.setStatus('ok');
      return result;
    } catch (error) {
      transaction.setStatus('internal_error');
      this.sentryService.captureException(error as Error, {
        tags: { operation: 'file-upload' },
        extra: { fileName: file.originalname, fileSize: file.size },
      });
      throw error;
    } finally {
      transaction.finish();
    }
  }
}
```

## Best Practices

### 1. Error Context và User Information

```typescript
// src/common/decorators/sentry-context.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SentryService } from '../sentry/sentry.service';

export const SentryContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const sentryService = new SentryService();
    
    // Set user context nếu có
    if (request.user) {
      sentryService.setUser({
        id: request.user.id,
        email: request.user.email,
        username: request.user.username,
      });
    }

    // Set request context
    sentryService.setExtra('request', {
      ip: request.ip,
      userAgent: request.get('User-Agent'),
      referer: request.get('Referer'),
    });

    return sentryService;
  },
);

// Sử dụng trong controller
@Controller('upload')
export class UploadController {
  @Post('file')
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @SentryContext() sentry: SentryService,
  ) {
    try {
      sentry.addBreadcrumb({
        message: 'File upload started',
        level: 'info',
        data: { fileName: file.originalname, fileSize: file.size },
      });

      const result = await this.fileUploadService.uploadFile(file);
      
      sentry.captureMessage('File uploaded successfully', 'info');
      return result;
    } catch (error) {
      sentry.captureException(error as Error, {
        tags: { operation: 'file-upload' },
        extra: { fileName: file.originalname },
      });
      throw error;
    }
  }
}
```

### 2. Environment-specific Configuration

```typescript
// src/sentry/sentry.config.ts
export const getSentryConfig = () => {
  const environment = process.env.NODE_ENV || 'development';
  
  const baseConfig = {
    dsn: process.env.SENTRY_DSN,
    environment,
    release: process.env.SENTRY_RELEASE,
  };

  switch (environment) {
    case 'production':
      return {
        ...baseConfig,
        sampleRate: 0.1, // Chỉ sample 10% errors trong production
        tracesSampleRate: 0.01, // 1% performance monitoring
        beforeSend(event) {
          // Filter sensitive data trong production
          if (event.request?.data) {
            delete event.request.data.password;
            delete event.request.data.token;
          }
          return event;
        },
      };
    
    case 'staging':
      return {
        ...baseConfig,
        sampleRate: 0.5,
        tracesSampleRate: 0.1,
      };
    
    default: // development
      return {
        ...baseConfig,
        sampleRate: 1.0,
        tracesSampleRate: 1.0,
        debug: true,
      };
  }
};
```

### 3. Custom Error Classes

```typescript
// src/common/exceptions/custom.exceptions.ts
import { HttpException, HttpStatus } from '@nestjs/common';

export class FileUploadException extends HttpException {
  constructor(message: string, originalError?: Error) {
    super(
      {
        message,
        error: 'File Upload Error',
        originalError: originalError?.message,
      },
      HttpStatus.BAD_REQUEST,
    );
    
    // Preserve original stack trace
    if (originalError?.stack) {
      this.stack = originalError.stack;
    }
  }
}

export class DatabaseConnectionException extends HttpException {
  constructor(message: string, originalError?: Error) {
    super(
      {
        message,
        error: 'Database Connection Error',
        originalError: originalError?.message,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    
    if (originalError?.stack) {
      this.stack = originalError.stack;
    }
  }
}
```

## So sánh với hệ thống hiện tại

### Hệ thống Discord Error Logging hiện tại:

**Ưu điểm:**
- Đơn giản, dễ setup
- Realtime notification qua Discord
- Có thể custom message format
- Phù hợp cho team nhỏ

**Nhược điểm:**
- Thiếu structured data
- Không có deduplication
- Khó search và filter
- Không có performance monitoring
- Phụ thuộc vào Discord service

### Sentry Integration:

**Ưu điểm:**
- Professional error tracking platform
- Powerful dashboard và analytics
- Automatic error grouping và deduplication
- Performance monitoring
- Release tracking
- User impact analysis
- Source maps support
- Integrations với nhiều tools khác

**Nhược điểm:**
- Phức tạp hơn để setup
- Có cost cho production usage
- Cần học thêm về Sentry platform

### Recommendation: Hybrid Approach

Có thể kết hợp cả hai:

```typescript
// src/error-logging/hybrid-error.service.ts
@Injectable()
export class HybridErrorService {
  constructor(
    private readonly sentryService: SentryService,
    private readonly discordErrorService: DiscordErrorService,
  ) {}

  async logError(error: Error, context?: any): Promise<void> {
    // Luôn gửi lên Sentry cho tracking và analytics
    const sentryEventId = this.sentryService.captureException(error, context);

    // Chỉ gửi Discord cho critical errors hoặc trong development
    const shouldNotifyDiscord = 
      process.env.NODE_ENV === 'development' || 
      this.isCriticalError(error);

    if (shouldNotifyDiscord) {
      await this.discordErrorService.sendError(error, {
        ...context,
        sentryEventId, // Include Sentry event ID trong Discord message
      });
    }
  }

  private isCriticalError(error: Error): boolean {
    // Define logic cho critical errors
    return error.message.includes('database') || 
           error.message.includes('payment') ||
           error.name === 'DatabaseConnectionException';
  }
}
```

## Kết luận

Sentry cung cấp một giải pháp toàn diện cho error tracking và performance monitoring trong NestJS applications. Việc tích hợp Sentry sẽ giúp:

1. **Improve debugging**: Structured error data với context đầy đủ
2. **Better monitoring**: Real-time error tracking và performance insights
3. **Enhanced user experience**: Phát hiện và fix lỗi nhanh hơn
4. **Professional workflow**: Release tracking và impact analysis

Bạn có thể bắt đầu với việc tích hợp Sentry cơ bản và dần dần thêm các tính năng advanced như performance monitoring và custom instrumentation.