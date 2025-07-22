import { Controller, Get, UseFilters } from '@nestjs/common';
import { AllExceptionsFilter } from 'src/configs/all-exceptions.filter';
import { ErrorLoggingModuleService } from './error-logging.service';

@Controller('error-logging-module')
@UseFilters(AllExceptionsFilter) // Sử dụng filter để log lỗi
export class ErrorLoggingModuleController {
  constructor(
    private readonly errorLoggingModuleService: ErrorLoggingModuleService,
  ) {}

  @Get('test-error')
  async testError() {
    throw new Error('This is a test error for Discord logging');
  }

  @Get('test-discord')
  async testDiscord() {
    await this.errorLoggingModuleService.testDiscord();
    return { message: 'Discord test message sent successfully' };
  }

  @Get('test-notification')
  async testNotification() {
    await this.errorLoggingModuleService.sendNotification(
      'This is a test notification from the API',
      '📡 API Notification',
    );
    return { message: 'Notification sent to Discord' };
  }
}
