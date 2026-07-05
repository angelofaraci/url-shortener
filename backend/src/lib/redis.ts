import { Redis } from 'ioredis';
import { config } from '../config/index.js';

// ioredis chosen over the official `redis` package for its simpler promise-based API,
// automatic reconnection/retry strategy out of the box, and mature TypeScript types.
// Named import (rather than default) avoids a known interop mismatch between
// ioredis's CJS typings and TS's NodeNext module resolution.
export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});
