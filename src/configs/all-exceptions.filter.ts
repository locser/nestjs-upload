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
import { DiscordErrorService } from 'src/error-logging/discord-error.service';

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly discordErrorService: DiscordErrorService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    console.log('LOG LOG LOG');
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status: HttpStatus;
    let message: string;
    let data: unknown;

    if (exception instanceof BadRequestException) {
      status = exception.getStatus();
      message =
        (exception.getResponse()?.['message'] || []).toString() || 'Error!';
    } else if (exception instanceof HttpException) {
      status = exception.getResponse()?.['status'] || exception.getStatus();
      message = exception.message || 'Error!';
      data = exception.getResponse()?.['data'];
    } else {
      console.error(exception);

      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = (exception as Error)?.message || 'Internal Server Error!';

      // Send error to Discord only for 500 errors (unexpected errors)
      if (exception instanceof Error) {
        const context = JSON.stringify({
          method: request.method,
          url: request.url,
          body: request.body,
          stack: (exception as Error)?.stack,
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
    if (contextType == 'http') {
      return response.status(HttpStatus.OK).json(res);
    } else if (contextType == 'rpc') {
      return res;
    }
  }
}
