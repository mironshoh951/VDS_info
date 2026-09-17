import { z } from 'zod'

/**
 * Environment validation.
 *
 * Every variable the application depends on is declared here and parsed once
 * at startup. A missing or malformed value fails loudly on boot rather than
 * producing a confusing runtime error later — and no code reads
 * `process.env` directly outside this file.
 */

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) =>
    typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()),
  )

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  PUBLIC_HOST: z.string().min(1),
  ADMIN_HOST: z.string().min(1),
  ADMIN_PATH_FALLBACK: booleanish.default(false),

  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().min(1),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanish.default(true),
  S3_PUBLIC_BASE_URL: z.string().url(),

  // Where uploaded media is written. 'local' keeps files on this machine under
  // MEDIA_LOCAL_DIR and serves them through /media/*; 's3' is the deployed
  // path and reuses the S3_* settings above. The application only ever talks
  // to the storage interface, so switching driver changes no call site.
  MEDIA_DRIVER: z.enum(['local', 's3']).default('local'),
  MEDIA_LOCAL_DIR: z.string().default('storage/media'),
  MEDIA_MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),

  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
  ADMIN_IP_ALLOWLIST: z.string().default(''),
  TRUST_PROXY: booleanish.default(false),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: booleanish.default(false),
  MAIL_FROM: z.string().default('VDS Platform <noreply@example.com>'),
  MAIL_FALLBACK_TO: z.string().optional(),

  // Every key is optional. AI is a feature, not a dependency: a deployment with
  // no keys runs the whole site and simply reports the assistants as
  // unavailable, rather than failing to boot.
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  AI_DEFAULT_CHAT_PROVIDER: z.enum(['anthropic', 'openai', 'groq']).default('groq'),
  // Groq serves no embedding models, so it is deliberately not offered here.
  // With no embedding provider the knowledge index stays empty and retrieval
  // falls back to the existing Postgres search, which is a worse answer than
  // vectors but a much better one than a broken assistant.
  AI_DEFAULT_EMBED_PROVIDER: z.enum(['openai', 'none']).default('none'),
  AI_CHAT_MODEL_ANTHROPIC: z.string().default('claude-sonnet-4-5'),
  AI_CHAT_MODEL_OPENAI: z.string().default('gpt-4.1'),
  // Groq retires models on a few months' notice — `llama-3.3-70b-versatile`
  // was withdrawn in August 2026 — so treat this as a value to check rather
  // than a constant. If a call fails with "model does not exist", the adapter
  // asks the API which models the key can actually use and says so.
  AI_CHAT_MODEL_GROQ: z.string().default('openai/gpt-oss-120b'),
  AI_EMBED_MODEL_OPENAI: z.string().default('text-embedding-3-small'),
  AI_EMBED_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().nonnegative().default(100),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  SENTRY_DSN: z.string().optional(),

  ALLOW_PRODUCTION_SEED: booleanish.default(false),
})

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_ADMIN_URL: z.string().url(),
})

export type ServerEnv = z.infer<typeof serverSchema> & z.infer<typeof clientSchema>

let cached: ServerEnv | null = null

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
}

/**
 * Parses and caches the server environment. Throws with a readable summary of
 * every problem at once rather than one at a time.
 */
export function getEnv(): ServerEnv {
  if (cached) return cached

  const serverResult = serverSchema.safeParse(process.env)
  const clientResult = clientSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_ADMIN_URL: process.env.NEXT_PUBLIC_ADMIN_URL,
  })

  if (!serverResult.success || !clientResult.success) {
    const messages = [
      !serverResult.success ? formatIssues(serverResult.error) : '',
      !clientResult.success ? formatIssues(clientResult.error) : '',
    ]
      .filter(Boolean)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${messages}`)
  }

  cached = { ...serverResult.data, ...clientResult.data }
  return cached
}

export const isProduction = () => getEnv().NODE_ENV === 'production'
export const isDevelopment = () => getEnv().NODE_ENV === 'development'
export const isTest = () => getEnv().NODE_ENV === 'test'

/** Parsed CIDR entries for the optional admin IP allow-list. */
export function adminIpAllowlist(): string[] {
  return getEnv()
    .ADMIN_IP_ALLOWLIST.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
