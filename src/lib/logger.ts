import pino from 'pino'

/**
 * Structured logging. Every log line is JSON with a `requestId` where one
 * exists, so an error surfaced to a user as an opaque id can be found in the
 * logs in one query.
 *
 * The redaction list is the safety net that keeps credentials and personal
 * data out of log storage even when a caller passes a whole object by mistake.
 */
const redactPaths = [
  'password',
  '*.password',
  'passwordHash',
  '*.passwordHash',
  'token',
  '*.token',
  'tokenHash',
  '*.tokenHash',
  'secret',
  '*.secret',
  'secretEnc',
  '*.secretEnc',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.cookie',
  'apiKey',
  '*.apiKey',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'DATABASE_URL',
  'email',
  '*.email',
  'phone',
  '*.phone',
]

const isProd = process.env.NODE_ENV === 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  redact: { paths: redactPaths, censor: '[redacted]' },
  base: { service: 'vds-platform' },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
})

export type Logger = typeof logger

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings) as Logger
}
