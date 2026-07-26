import { cleanupAnonymousLinks } from './cleanupAnonymousLinks.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

// CLI entry point for both the k8s CronJob and any manual invocation. Takes no
// argv, reads config only. Extracted as `main()` (returning an exit code rather
// than calling `process.exit` itself) so tests can assert the exit-code contract
// without spawning/killing a real process.
export async function main(): Promise<number> {
  try {
    const { scanned, deleted } = await cleanupAnonymousLinks();
    logger.info({ scanned, deleted }, 'anonymous link cleanup job finished');
    return 0;
  } catch (error) {
    // Non-zero exit lets the k8s Job's backoffLimit retry the run.
    logger.error({ err: error }, 'anonymous link cleanup job failed');
    return 1;
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
  }
}

// Only auto-run (and exit the process) when this file is the direct entry point,
// e.g. `node dist/jobs/cleanup.js` — never as a side effect of being imported
// (this guard is what keeps the vitest import above side-effect free).
const isDirectRun = process.argv[1]?.endsWith('cleanup.js') || process.argv[1]?.endsWith('cleanup.ts');
if (isDirectRun) {
  void main().then((code) => {
    process.exit(code);
  });
}
