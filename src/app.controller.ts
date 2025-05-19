import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { LoggerService, LogLevel } from './logger';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
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
}
