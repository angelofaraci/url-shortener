import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.nodeEnv === 'test' ? 'silent' : 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});
