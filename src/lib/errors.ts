/**
 * Application error taxonomy.
 *
 * Errors carry a stable machine code and a message that is always safe to show
 * a user. Internal detail lives in `internal` and is logged, never serialised
 * to a response (§87 — never expose sensitive server errors).
 */

export type AppErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'STEP_UP_REQUIRED'
  | 'MFA_REQUIRED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PRECONDITION_FAILED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'BUDGET_EXCEEDED'
  | 'MAINTENANCE'
  | 'INTERNAL'

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  STEP_UP_REQUIRED: 428,
  MFA_REQUIRED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PRECONDITION_FAILED: 412,
  DEPENDENCY_UNAVAILABLE: 503,
  BUDGET_EXCEEDED: 429,
  MAINTENANCE: 503,
  INTERNAL: 500,
}

export interface FieldIssue {
  field: string
  code: string
  message?: string
}

export interface AppErrorOptions {
  /** Structured field-level problems, for form rendering. */
  details?: FieldIssue[]
  /** Arbitrary safe metadata included in the response (e.g. retryAfter). */
  meta?: Record<string, unknown>
  /** Internal context. Logged, never serialised. */
  internal?: unknown
  cause?: unknown
}

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly status: number
  readonly details?: FieldIssue[]
  readonly meta?: Record<string, unknown>
  readonly internal?: unknown

  constructor(code: AppErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'AppError'
    this.code = code
    this.status = STATUS_BY_CODE[code]
    this.details = options.details
    this.meta = options.meta
    this.internal = options.internal
  }

  /** The only shape ever sent to a client. */
  toResponseBody(requestId: string) {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
        ...(this.meta ? { meta: this.meta } : {}),
        requestId,
      },
    }
  }
}

export const unauthenticated = (message = 'Authentication required.') =>
  new AppError('UNAUTHENTICATED', message)

export const forbidden = (message = 'You do not have permission to do that.') =>
  new AppError('FORBIDDEN', message)

export const notFound = (message = 'Not found.') => new AppError('NOT_FOUND', message)

export const conflict = (message: string, details?: FieldIssue[]) =>
  new AppError('CONFLICT', message, details ? { details } : {})

export const validationFailed = (details: FieldIssue[], message = 'Validation failed.') =>
  new AppError('VALIDATION_FAILED', message, { details })

export const rateLimited = (retryAfterSeconds: number) =>
  new AppError('RATE_LIMITED', 'Too many requests. Please try again shortly.', {
    meta: { retryAfterSeconds },
  })

export const stepUpRequired = (scope: string, mfaRequired: boolean) =>
  new AppError('STEP_UP_REQUIRED', 'Confirm your password to continue.', {
    meta: { scope, mfaRequired },
  })

/** An outside service the request needed is not configured or not answering. */
export const dependencyUnavailable = (message: string) =>
  new AppError('DEPENDENCY_UNAVAILABLE', message)

/** The spend cap for the period is reached; the work was not attempted. */
export const budgetExceeded = (message: string) =>
  new AppError('BUDGET_EXCEEDED', message)

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError
}
