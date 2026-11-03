const NETWORK_ERROR = 'Could not reach Courtly. Check your connection and try again.';
const SERVER_ERROR = 'Something went wrong on our side. Please try again in a moment.';

/** A failed API call. Its message is always fit to show the user as it is. */
export class ApiError extends Error {
  constructor(
    /** The HTTP status, or 0 when no response arrived. */
    readonly status: number,
    message: string,
    /** The API's stable name for the error, such as "COURT_NAME_TAKEN", when it sent one. */
    readonly code?: string,
    /** The first message for each invalid body field, by field name. */
    readonly fieldErrors: Readonly<Partial<Record<string, string>>> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The message to show for any error: the API's own words, or a generic one. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : SERVER_ERROR;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function bodyFieldErrors(errors: unknown): Partial<Record<string, string>> {
  const byField: Partial<Record<string, string>> = {};

  if (Array.isArray(errors)) {
    for (const error of errors) {
      if (
        isRecord(error) &&
        error.in === 'body' &&
        typeof error.path === 'string' &&
        typeof error.message === 'string'
      ) {
        byField[error.path] ??= error.message;
      }
    }
  }

  return byField;
}

/** Errors arrive as Problem Details; anything else, such as a proxy's error page, is not shown. */
async function toApiError(response: Response): Promise<ApiError> {
  const isProblem = response.headers.get('Content-Type')?.startsWith('application/problem+json');
  const problem: unknown = isProblem ? await response.json() : undefined;

  // A 5xx detail describes our failure, which the user cannot act on.
  if (response.status >= 500 || !isRecord(problem) || typeof problem.detail !== 'string') {
    return new ApiError(response.status, SERVER_ERROR);
  }

  const code = typeof problem.code === 'string' ? problem.code : undefined;

  return new ApiError(response.status, problem.detail, code, bodyFieldErrors(problem.errors));
}

/**
 * Calls the API on the app's own origin and returns the parsed JSON body, or undefined for an
 * empty one. fetch's default credentials mode, same-origin, sends the session cookie.
 */
export async function apiRequest(
  path: string,
  { method = 'GET', body }: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown } = {},
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(`/api${path}`, {
      method,
      ...(body !== undefined && {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    });
  } catch {
    // fetch rejects only when no response arrived: offline, DNS failure, server down.
    throw new ApiError(0, NETWORK_ERROR);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  return response.status === 204 ? undefined : response.json();
}
