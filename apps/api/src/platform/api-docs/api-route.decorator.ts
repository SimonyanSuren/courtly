import { applyDecorators, type HttpException, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { type z } from 'zod';

import { type ApiError } from '../http/api-error';
import { toProblemDetails } from '../http/problem-details.filter';
import { ApiErrors, ApiProblemResponse } from './api-errors.decorator';
import { ApiSession } from './api-session.decorator';

/**
 * The success response. Its status must be the one the route answers with: Nest's 201 for a
 * @Post() and 200 otherwise, unless @HttpCode() says another. Only a 204 has no body.
 */
type ApiRouteSuccess =
  | { status?: HttpStatus.OK | HttpStatus.CREATED; response: z.ZodType }
  | { status: HttpStatus.NO_CONTENT; response?: undefined };

type ApiRouteOptions = ApiRouteSuccess & {
  /** One line in the list of routes, ending with who may call it: 'Book a court (user)'. */
  summary: string;
  /** What the success response holds. */
  description: string;
  /** Every error the route answers with on purpose, as the code throws it. */
  errors?: ReadonlyArray<ApiError | HttpException>;
  /** For a route marked @Public(): no session cookie and no 401. */
  isPublic?: boolean;
};

/** What the exception filter answers for any error not raised on purpose, such as a bug. */
const unexpectedError = toProblemDetails(new Error('Not raised on purpose.'));

/**
 * Everything the API reference says about a route: its summary, its success response, the errors
 * it answers with, whether it needs the session, and the catch-all for any other error. It only
 * describes: @Public(), @HttpCode() and @Roles() still decide what the route does, and
 * test/api-docs.spec.ts checks that the two agree on the session.
 */
export function ApiRoute({
  summary,
  status = HttpStatus.OK,
  response,
  description,
  errors = [],
  isPublic = false,
}: ApiRouteOptions): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiResponse({ status, description, ...(response && { standardSchema: response }) }),
    ApiErrors(...errors),
    // Every route needs the session unless it is @Public(), as the authentication guard decides.
    ...(isPublic ? [] : [ApiSession()]),
    // OpenAPI's `default` covers every status a route does not list: a 500, or a 400 for a body
    // that is not JSON. Each comes in the same shape.
    ApiProblemResponse('default', [unexpectedError], 'Any other error. A fault of the API:'),
  );
}
