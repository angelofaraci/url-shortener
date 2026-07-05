import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { linkRoutes } from './routes/linkRoutes.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { redirectRoutes } from './routes/redirectRoutes.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { errorHandler } from './middlewares/errorHandler.js';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());
  app.use(requestLogger);

  app.use('/api/links', linkRoutes);
  app.use('/health', healthRoutes);

  // Registered last: "/:code" is a single-segment catch-all and would otherwise
  // shadow the /api/* and /health routes above it.
  app.use('/', redirectRoutes);

  app.use(errorHandler);

  return app;
}
