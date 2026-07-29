import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required'),
  DEFAULT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  SHORT_CODE_LENGTH: z.coerce.number().int().positive().default(6),
  // Google OAuth is an optional capability: all three are absent in most deployments
  // and every consumer must degrade gracefully (see authService.isConfigured()).
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().min(1).optional(),
  APP_BASE_URL: z.string().min(1).default('http://localhost:5173'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  SESSION_COOKIE_NAME: z.string().min(1).default('sid'),
  ANON_LINK_TTL_HOURS: z.coerce.number().int().positive().default(24),
  ANON_CLEANUP_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  ANON_CLEANUP_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  // Redis-backed rate limiting (express-rate-limit + rate-limit-redis), applied
  // globally plus stricter per-endpoint overrides — see src/middlewares/rateLimiter.ts.
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_CREATE_LINK_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

const env = parsed.data;

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,
  corsOrigin: env.CORS_ORIGIN,
  defaultCacheTtlSeconds: env.DEFAULT_CACHE_TTL_SECONDS,
  shortCodeLength: env.SHORT_CODE_LENGTH,
  googleClientId: env.GOOGLE_CLIENT_ID,
  googleClientSecret: env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: env.GOOGLE_REDIRECT_URI,
  appBaseUrl: env.APP_BASE_URL,
  sessionTtlSeconds: env.SESSION_TTL_SECONDS,
  sessionCookieName: env.SESSION_COOKIE_NAME,
  anonLinkTtlHours: env.ANON_LINK_TTL_HOURS,
  anonCleanupEnabled: env.ANON_CLEANUP_ENABLED,
  anonCleanupIntervalMinutes: env.ANON_CLEANUP_INTERVAL_MINUTES,
  rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: env.RATE_LIMIT_MAX,
  rateLimitCreateLinkMax: env.RATE_LIMIT_CREATE_LINK_MAX,
  rateLimitAuthMax: env.RATE_LIMIT_AUTH_MAX,
} as const;

export type Config = typeof config;
