import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const result = { postgres: 'ok', redis: 'ok' };

  const [postgresResult, redisResult] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis.ping(),
  ]);

  if (postgresResult.status === 'rejected') {
    result.postgres = 'unreachable';
  }
  if (redisResult.status === 'rejected') {
    result.redis = 'unreachable';
  }

  const healthy = result.postgres === 'ok' && result.redis === 'ok';

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'error',
    ...result,
  });
}
