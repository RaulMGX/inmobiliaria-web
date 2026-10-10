import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{ method?: string; url?: string }>();
    const method = request?.method ?? 'UNKNOWN';
    const url = request?.url ?? 'UNKNOWN';

    let httpStatus: number;
    let responseBody: {
      statusCode: number;
      message: string;
      error?: string;
      stack?: string;
      path?: string;
      timestamp?: string;
    };

    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const exceptionResp = exception.getResponse();
      if (typeof exceptionResp === 'object' && exceptionResp !== null) {
        responseBody = {
          statusCode: httpStatus,
          message:
            (exceptionResp as { message?: string | string[] }).message instanceof
            Array
              ? (exceptionResp as { message: string[] }).message.join('; ')
              : (exceptionResp as { message?: string }).message ??
                exception.message,
          timestamp,
          path: url,
        };
        if ((exceptionResp as { error?: string }).error) {
          responseBody.error = (exceptionResp as { error: string }).error;
        }
      } else {
        responseBody = {
          statusCode: httpStatus,
          message: String(exceptionResp ?? exception.message),
          timestamp,
          path: url,
        };
      }
      if (httpStatus >= 500) {
        this.logger.error(
          `[HTTP ${httpStatus}] ${method} ${url} -> ${exception.message}`,
          exception.stack,
        );
      } else {
        this.logger.warn(
          `[HTTP ${httpStatus}] ${method} ${url} -> ${exception.message}`,
        );
      }
    } else {
      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
      const err =
        exception instanceof Error
          ? exception
          : new Error(String(exception ?? 'Unknown error'));
      const message = err.message;
      this.logger.error(
        `[INTERNAL 500] ${method} ${url} -> ${message}`,
        err.stack,
      );
      responseBody = {
        statusCode: httpStatus,
        message,
        error: 'Internal Server Error (detailed)',
        stack: err.stack ?? undefined,
        timestamp,
        path: url,
      };
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
