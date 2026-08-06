import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config/index.js';
import { linkRoutes } from './routes/linkRoutes.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { analyticsRoutes } from './routes/analyticsRoutes.js';
import { redirectRoutes } from './routes/redirectRoutes.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { optionalSession } from './middlewares/optionalSession.js';
import { generalRateLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';

export function createApp(): Express {
  const app = express();

  // Trust exactly one hop: the ingress-nginx reverse proxy in front of this
  // service (see k8s/ingress.yaml), not a blind `true`. This makes req.ip
  // reflect the real client IP from X-Forwarded-For for rate limiting below —
  // without it, all anonymous traffic buckets under the proxy's single IP
  // (locking everyone out together), and a bare `true` would trust an
  // attacker-supplied X-Forwarded-For chain instead of just the proxy's hop.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestLogger);
  app.use(optionalSession);

  // Registered before the global rate limiter (and before every other route)
  // so k8s liveness/readiness probes are exempt by construction — they never
  // pass through generalRateLimiter and never touch Redis for it. Route order
  // is used here instead of a `skip` option since it needs no per-request path
  // check and mirrors how this file already uses ordering for /auth vs the
  // "/:code" catch-all below.
  app.use('/health', healthRoutes);

  app.use(generalRateLimiter);

  app.use('/api/links', linkRoutes);
  // Must be registered before the "/:code" catch-all below, or
  // /api/analytics/dashboard would be shadowed and misinterpreted as a lookup
  // for short code "api" (single-segment route matching stops at the first
  // path separator, so this order also fully protects the two-segment path).
  app.use('/api/analytics', analyticsRoutes);
  // Must be registered before the "/:code" catch-all below, or /auth/me would be
  // shadowed and misinterpreted as a lookup for short code "auth".
  app.use('/auth', authRoutes);

  // Registered last: "/:code" is a single-segment catch-all and would otherwise
  // shadow the /api/*, /health, and /auth routes above it.
  app.use('/', redirectRoutes);

  app.use(errorHandler);

  return app;
}
