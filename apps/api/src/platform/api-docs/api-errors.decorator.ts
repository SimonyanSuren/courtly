import { applyDecorators, type HttpException } from '@nestjs/common';
import { ApiResponse, getSchemaPath } from '@nestjs/swagger';

import { type ApiError } from '../http/api-error';
import { type ProblemDetails, toProblemDetails } from '../http/problem-details.filter';

/** The name under which the reference lists the Problem Details schema. */
export const PROBLEM_DETAILS = 'ProblemDetails';

/**
 * One error response in the reference: each problem's code with its sentence, after the intro if
 * there is one, and each body as an example of the Problem Details schema.
 */
export function ApiProblemResponse(
  status: number | 'default',
  problems: readonly ProblemDetails[],
  intro?: string,
): MethodDecorator & ClassDecorator {
  const sentences = problems.map(({ code, detail }) => `\`${code}\`: ${detail}`);

  return ApiResponse({
    status,
    // Markdown paragraphs, one for each code.
    description: (intro === undefined ? sentences : [intro, ...sentences]).join('\n\n'),
    content: {
      // The content type the filter sends; Nest would list every response as application/json.
      'application/problem+json': {
        schema: { $ref: getSchemaPath(PROBLEM_DETAILS) },
        examples: Object.fromEntries(problems.map((problem) => [problem.code, { value: problem }])),
      },
    },
  });
}

/**
 * Documents the errors a route answers with: one response per status, listing each code with its
 * sentence, and the body of each as an example, e.g. `ApiErrors(CourtError.notFound())`. The
 * errors are the ones the code throws, turned into bodies by the exception filter's own function,
 * so the reference cannot show a status, code or sentence the API does not send.
 */
export function ApiErrors(
  ...errors: ReadonlyArray<ApiError | HttpException>
): MethodDecorator & ClassDecorator {
  const byStatus = Map.groupBy(errors.map(toProblemDetails), (problem) => problem.status);

  return applyDecorators(
    ...[...byStatus].map(([status, problems]) => ApiProblemResponse(status, problems)),
  );
}
