import { Router } from 'express';
import { createLink, getStats, listMyLinks } from '../controllers/linkController.js';
import { sessionGate } from '../middlewares/sessionGate.js';

export const linkRoutes = Router();

linkRoutes.post('/', createLink);
// Registered before /:code/stats: a bare '/' has zero path segments and can
// never shadow the two-segment '/:code/stats' route below, regardless of order.
linkRoutes.get('/', sessionGate, listMyLinks);
linkRoutes.get('/:code/stats', getStats);
