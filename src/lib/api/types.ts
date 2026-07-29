export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    path: string;
    requestId: string;
  };
};

export type ApiErrorBody = {
  success: false;
  error: {
    statusCode: number;
    code: string;
    message: string;
    details?: string[] | Record<string, unknown>;
  };
  meta: {
    timestamp: string;
    path: string;
    requestId: string;
  };
};

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: string[] | Record<string, unknown>;
  readonly requestId?: string;

  constructor(body: ApiErrorBody['error'], requestId?: string) {
    super(body.message);
    this.name = 'ApiError';
    this.statusCode = body.statusCode;
    this.code = body.code;
    this.details = body.details;
    this.requestId = requestId;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Prefer backend message; fall back for unknown failures. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong') {
  if (isApiError(error)) {
    if (
      error.message === 'Validation failed' &&
      Array.isArray(error.details) &&
      error.details.length > 0
    ) {
      return error.details.join('\n');
    }
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
