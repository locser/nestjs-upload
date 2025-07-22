import { Injectable } from '@nestjs/common';
import { DiscordErrorService } from './discord-error.service';

@Injectable()
export class ErrorLoggingModuleService {
  constructor(private readonly discordErrorService: DiscordErrorService) {}

  async testDiscord() {
    await this.discordErrorService.sendCustomMessage(
      'Discord integration test successful! 🎉',
      '✅ Test Message',
    );
  }

  async logError(error: Error, context?: string): Promise<void> {
    console.error('Error logged:', error);
    await this.discordErrorService.sendError(error, context);
  }

  async sendNotification(message: string, title?: string): Promise<void> {
    await this.discordErrorService.sendCustomMessage(message, title);
  }
}
