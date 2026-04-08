import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  AUTH_SECRET: z.string().min(1),
  AUTH_BASE_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  MICROSOFT_CLIENT_ID: z.string().min(1),
  MICROSOFT_CLIENT_SECRET: z.string().min(1),
  MICROSOFT_TENANT_ID: z.string().min(1).default('common'),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().min(1),
  UPLOAD_DIR: z.string().default('storage/uploads'),
  INVITATION_TOKEN_EXPIRES_HOURS: z.coerce.number().int().positive().default(72),
  PASSWORD_RESET_TOKEN_EXPIRES_HOURS: z.coerce.number().int().positive().default(24),
  SURVEY_RESPONSE_SESSION_EXPIRES_HOURS: z.coerce.number().int().positive().default(8),
  SURVEY_ACCESS_CREDENTIAL_EXPIRES_HOURS: z.coerce.number().int().positive().default(168),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(1000 * 60 * 15),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(600),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(40),
  SURVEY_ACCESS_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
  CSRF_COOKIE_NAME: z.string().trim().min(3).default('cooltura_csrf'),
  DATABASE_CONTRACT_CHECK_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .default('true')
    .transform((value) => value === 'true'),
  WORKER_TICK_RETRY_ATTEMPTS: z.coerce.number().int().positive().max(10).default(3),
  WORKER_TICK_RETRY_DELAY_MS: z.coerce.number().int().positive().default(500),
  SURVEY_INVITATION_EMAIL_CONCURRENCY: z.coerce.number().int().positive().max(50).default(5),
  REMINDER_WORKER_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  REMINDER_WORKER_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
  REMINDER_BATCH_SIZE: z.coerce.number().int().positive().max(100).default(10),
  REMINDER_MAX_RETRIES: z.coerce.number().int().positive().max(20).default(3),
  REMINDER_DISPATCH_MAX_RETRIES: z.coerce.number().int().positive().max(20).default(3),
  REMINDER_RETRY_DELAY_SECONDS: z.coerce.number().int().positive().default(300),
  REMINDER_CREDENTIAL_EXPIRES_HOURS: z.coerce.number().int().positive().default(72),
  DASHBOARD_ANONYMITY_MIN_COUNT: z.coerce.number().int().positive().default(5),
  DASHBOARD_EXPORT_WORKER_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  DASHBOARD_EXPORT_WORKER_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
  DASHBOARD_EXPORT_BATCH_SIZE: z.coerce.number().int().positive().max(50).default(5),
  DASHBOARD_EXPORT_MAX_RETRIES: z.coerce.number().int().positive().max(20).default(3),
  DASHBOARD_EXPORT_RETRY_DELAY_SECONDS: z.coerce.number().int().positive().default(300),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(5)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.flatten().fieldErrors;
  throw new Error(`Invalid environment configuration: ${JSON.stringify(details)}`);
}

export const env = {
  ...parsedEnv.data,
  AUTH_BASE_URL: parsedEnv.data.AUTH_BASE_URL ?? `http://localhost:${parsedEnv.data.PORT}`
};
