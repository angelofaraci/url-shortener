import { Router } from 'express';
import { createLink, getStats, listMyLinks } from '../controllers/linkController.js';
import { sessionGate } from '../middlewares/sessionGate.js';
import { createLinkRateLimiter } from '../middlewares/rateLimiter.js';

export const linkRoutes = Router();

// Defense in depth on top of the app-wide generalRateLimiter: link creation
// carries real ongoing storage/compute cost, so it gets its own stricter budget.
linkRoutes.post('/', createLinkRateLimiter, createLink);
// Registered before /:code/stats: a bare '/' has zero path segments and can
// never shadow the two-segment '/:code/stats' route below, regardless of order.
linkRoutes.get('/', sessionGate, listMyLinks);
linkRoutes.get('/:code/stats', sessionGate, getStats);
