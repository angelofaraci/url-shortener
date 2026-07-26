import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

const BATCH_SIZE = 500;

// D6: delete the Postgres rows FIRST, then purge the Redis redirect cache.
// Cache-first would let a concurrent redirect re-populate the still-live row from
// Postgres, stranding a stale cache entry for its full TTL; DB-first makes that
// re-population impossible once the row is gone.
export async function cleanupAnonymousLinks(now: Date = new Date()): Promise<{ scanned: number; deleted: number }> {
  const cutoff = new Date(now.getTime() - config.anonLinkTtlHours * 3_600_000);
  let scanned = 0;
  let deleted = 0;

  for (;;) {
    // `userId: null` is mandatory here — owned links must survive regardless of age.
    const doomed = await prisma.link.findMany({
      where: { userId: null, createdAt: { lt: cutoff } },
      select: { id: true, code: true },
      take: BATCH_SIZE,
    });

    if (doomed.length === 0) {
      break;
    }

    scanned += doomed.length;

    // Click rows cascade via the FK's onDelete: Cascade.
    const result = await prisma.link.deleteMany({ where: { id: { in: doomed.map((d) => d.id) } } });
    // D8: redirectCacheService keys are bare codes, unnamespaced — purge the same shape.
    await redis.del(...doomed.map((d) => d.code));

    deleted += result.count;

    if (doomed.length < BATCH_SIZE) {
      break;
    }
  }

  logger.info({ cutoff, scanned, deleted }, 'anonymous link cleanup complete');
  return { scanned, deleted };
}
