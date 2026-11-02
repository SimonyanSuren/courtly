import {
  type ArgumentMetadata,
  HttpStatus,
  StandardSchemaValidationPipe,
  type StandardSchemaValidationPipeOptions,
} from '@nestjs/common';

import { ApiError, type FieldError } from './api-error';

type SchemaIssue = Parameters<
  NonNullable<StandardSchemaValidationPipeOptions['exceptionFactory']>
>[0][number];

/** Carries the issues from exceptionFactory to transform(), which knows the failing argument. */
class SchemaIssues extends Error {
  constructor(readonly issues: readonly SchemaIssue[]) {
    super('Schema validation failed');
    this.name = 'SchemaIssues';
  }
}

function toFieldError(issue: SchemaIssue, metadata: ArgumentMetadata): FieldError {
  const issuePath = (issue.path ?? []).map((segment) =>
    String(typeof segment === 'object' ? segment.key : segment),
  );

  return {
    in: metadata.type,
    // metadata.data is the argument's name when bound to one, as in @Param('id', { schema }).
    path: [metadata.data, ...issuePath].filter(Boolean).join('.'),
    message: issue.message,
  };
}

/**
 * Nest's schema pipe, which validates every argument declared with a schema, e.g.
 * `@Body({ schema: createCourtSchema })`, and passes the parsed value on. Its error factory sees
 * only the issues, so this subclass adds where each invalid value came from and reports the
 * failure as a VALIDATION_FAILED ApiError.
 */
export class SchemaValidationPipe extends StandardSchemaValidationPipe {
  constructor() {
    super({ exceptionFactory: (issues) => new SchemaIssues(issues) });
  }

  override async transform<T>(value: T, metadata: ArgumentMetadata): Promise<T> {
    try {
      return await super.transform(value, metadata);
    } catch (error) {
      if (!(error instanceof SchemaIssues)) {
        throw error;
      }

      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'The request has invalid values.',
        error.issues.map((issue) => toFieldError(issue, metadata)),
      );
    }
  }
}
