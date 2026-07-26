import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';
import { cleanupAnonymousLinks } from './jobs/cleanupAnonymousLinks.js';

const app = createApp();

app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'server started');
});

// D7: opt-in in-process runtime for docker-compose/single-process deployments.
// Disabled by default (ANON_CLEANUP_ENABLED=false) so no interval is scheduled
// unless explicitly turned on; k8s deployments should prefer the CronJob instead
// and leave this flag off to avoid running cleanup twice.
if (config.anonCleanupEnabled) {
  const intervalMs = config.anonCleanupIntervalMinutes * 60_000;
  logger.info({ intervalMinutes: config.anonCleanupIntervalMinutes }, 'anonymous link cleanup interval enabled');
  setInterval(() => {
    cleanupAnonymousLinks().catch((error: unknown) => {
      logger.error({ err: error }, 'in-process anonymous link cleanup failed');
    });
  }, intervalMs);
}
