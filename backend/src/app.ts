import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config/index.js';
import { linkRoutes } from './routes/linkRoutes.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { redirectRoutes } from './routes/redirectRoutes.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { optionalSession } from './middlewares/optionalSession.js';
import { errorHandler } from './middlewares/errorHandler.js';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestLogger);
  app.use(optionalSession);

  app.use('/api/links', linkRoutes);
  app.use('/health', healthRoutes);
  // Must be registered before the "/:code" catch-all below, or /auth/me would be
  // shadowed and misinterpreted as a lookup for short code "auth".
  app.use('/auth', authRoutes);

  // Registered last: "/:code" is a single-segment catch-all and would otherwise
  // shadow the /api/*, /health, and /auth routes above it.
  app.use('/', redirectRoutes);

  app.use(errorHandler);

  return app;
}
