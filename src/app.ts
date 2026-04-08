import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { env } from './config/env';
import { auditTrailMiddleware } from './middlewares/audit-trail.middleware';
import { csrfProtectionMiddleware } from './middlewares/csrf.middleware';
import { apiRouter } from './routes';
import { notFoundHandler } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';
import { createRateLimiter } from './middlewares/rate-limit.middleware';
import { requestContextMiddleware } from './middlewares/request-context.middleware';
import { requestTelemetryMiddleware } from './middlewares/request-telemetry.middleware';

export const app = express();

const globalRateLimiter = createRateLimiter({
  name: 'api_global',
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_MAX_REQUESTS
});

const authRateLimiter = createRateLimiter({
  name: 'auth',
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.AUTH_RATE_LIMIT_MAX_REQUESTS
});

const surveyAccessRateLimiter = createRateLimiter({
  name: 'survey_access',
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.SURVEY_ACCESS_RATE_LIMIT_MAX_REQUESTS
});

const uploadDirAbsolute = path.resolve(env.UPLOAD_DIR);
const companyLogoDirAbsolute = path.resolve(uploadDirAbsolute, 'company-logos');
fs.mkdirSync(companyLogoDirAbsolute, { recursive: true });

app.use(requestContextMiddleware);
app.use(requestTelemetryMiddleware);
app.use(auditTrailMiddleware);
app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    credentials: true
  })
);
app.use(express.json({ limit: `${env.MAX_UPLOAD_SIZE_MB * 2}mb` }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads/company-logos', express.static(companyLogoDirAbsolute));
app.use('/api', globalRateLimiter);
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/social', authRateLimiter);
app.use('/api/survey-access/validate', surveyAccessRateLimiter);
app.use('/api/survey-response/start', surveyAccessRateLimiter);
app.use('/api/survey-response/autosave', surveyAccessRateLimiter);
app.use('/api/survey-response/submit', surveyAccessRateLimiter);
app.use('/api', csrfProtectionMiddleware);

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
