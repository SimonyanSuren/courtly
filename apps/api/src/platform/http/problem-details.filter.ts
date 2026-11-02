import { STATUS_CODES } from 'node:http';

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { ApiError, type FieldError } from './api-error';

/**
 * The body of every error response: RFC 9457 Problem Details. `type` stays `about:blank`, so
 * `title` is the HTTP status phrase; `code` and `errors` are extension members.
 */
interface ProblemDetails {
  readonly type: 'about:blank';
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly code: string;
  readonly errors?: readonly FieldError[];
}

/** Errors from Express middleware, such as malformed JSON, carry a status and `expose`. */
interface ExposableHttpError {
  readonly status: number;
  readonly expose: true;
  readonly message: string;
}

function isExposableHttpError(exception: unknown): exception is ExposableHttpError {
  return (
    exception instanceof Error &&
    'status' in exception &&
    typeof exception.status === 'number' &&
    exception.status >= 400 &&
    exception.status < 500 &&
    'expose' in exception &&
    exception.expose === true
  );
}

/** Errors without a code of their own get the status name, e.g. 404 becomes `NOT_FOUND`. */
function codeFor(status: number): string {
  return (HttpStatus as Partial<Record<number, string>>)[status] ?? 'HTTP_ERROR';
}

function problemDetails(
  status: number,
  code: string,
  detail: string,
  errors?: readonly FieldError[],
): ProblemDetails {
  return {
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    detail,
    code,
    ...(errors && { errors }),
  };
}

function toProblemDetails(exception: unknown): ProblemDetails {
  if (exception instanceof ApiError) {
    return problemDetails(exception.status, exception.code, exception.message, exception.errors);
  }

  if (exception instanceof HttpException) {
    return problemDetails(exception.getStatus(), codeFor(exception.getStatus()), exception.message);
  }

  if (isExposableHttpError(exception)) {
    return problemDetails(exception.status, codeFor(exception.status), exception.message);
  }

  return problemDetails(
    HttpStatus.INTERNAL_SERVER_ERROR,
    codeFor(HttpStatus.INTERNAL_SERVER_ERROR),
    'An unexpected error occurred.',
  );
}

/** Catches every error, so no response leaves the API in another shape. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  // The adapter host keeps the filter independent of Express.
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const problem = toProblemDetails(exception);

    if (problem.status >= 500) {
      // Logged in full for us; the client only gets the generic detail.
      this.logger.error(exception);
    }

    const { httpAdapter } = this.adapterHost;
    const response: unknown = host.switchToHttp().getResponse();
    httpAdapter.setHeader(response, 'Content-Type', 'application/problem+json');
    httpAdapter.reply(response, problem, problem.status);
  }
}
