import { Injectable } from '@nestjs/common';
import { Client, TextChannel } from 'discord.js';

@Injectable()
export class DiscordErrorService {
  constructor(private readonly client: Client) {}

  private truncateText(text: string, maxLength: number = 1020): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private async getChannel(): Promise<TextChannel | null> {
    try {
      const channelId = process.env.ERROR_CHANNEL_ID;
      if (!channelId) {
        console.warn('ERROR_CHANNEL_ID not configured');
        return null;
      }

      const channel = await this.client.channels.fetch(channelId);
      if (!channel?.isTextBased()) {
        console.warn('Discord channel not found or not text-based');
        return null;
      }

      return channel as TextChannel;
    } catch (error) {
      console.error('Failed to fetch Discord channel:', error);
      return null;
    }
  }
  async sendError(error: Error, context?: string): Promise<void> {
    try {
      const channel = await this.getChannel();
      if (!channel) return;

      const errorMessage = this.truncateText(error.message, 1000);
      const stackTrace = this.truncateText(
        error.stack || 'No stack trace',
        1000,
      );

      const embed = {
        title: '🚨 Error Alert',
        color: 0xff0000,
        fields: [
          {
            name: 'Error Message',
            value: `\`\`\`${errorMessage}\`\`\``,
            inline: false,
          },
          {
            name: 'Stack Trace',
            value: `\`\`\`${stackTrace}\`\`\``,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
      };

      if (context) {
        embed.fields.unshift({
          name: 'Context',
          value: this.truncateText(context, 1000),
          inline: false,
        });
      }

      await channel.send({ embeds: [embed] });
    } catch (discordError) {
      console.error('Failed to send error to Discord:', discordError);
    }
  }

  async sendCustomMessage(message: string, title?: string): Promise<void> {
    try {
      const channel = await this.getChannel();
      if (!channel) return;

      const embed = {
        title: this.truncateText(title || '📢 Notification', 256), // Title limit is 256
        description: this.truncateText(message, 4096), // Description limit is 4096
        color: 0x00ff00,
        timestamp: new Date().toISOString(),
      };

      await channel.send({ embeds: [embed] });
    } catch (discordError) {
      console.error('Failed to send message to Discord:', discordError);
    }
  }
}
