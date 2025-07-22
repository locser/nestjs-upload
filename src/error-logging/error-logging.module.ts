import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IntentsBitField } from 'discord.js';
import { NecordModule } from 'necord';
import { DiscordErrorService } from './discord-error.service';
import { ErrorLoggingModuleController } from './error-logging.controller';
import { ErrorLoggingModuleService } from './error-logging.service';
console.log('DISCORD_TOKEN', process.env.DISCORD_TOKEN);
console.log(
  'DISCORD_DEVELOPMENT_GUILD_ID',
  process.env.DISCORD_DEVELOPMENT_GUILD_ID,
);
@Module({
  controllers: [ErrorLoggingModuleController],
  providers: [ErrorLoggingModuleService, DiscordErrorService],
  exports: [DiscordErrorService],
  imports: [
    ConfigModule.forRoot(),
    NecordModule.forRoot({
      token: process.env.DISCORD_TOKEN,
      intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMembers,
      ],
      // development: [process.env.DISCORD_DEVELOPMENT_GUILD_ID],
    }),
  ],
})
export class ErrorLoggingModuleModule {}
