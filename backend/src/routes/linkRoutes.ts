import { Router } from 'express';
import { createLink, getStats } from '../controllers/linkController.js';

export const linkRoutes = Router();

linkRoutes.post('/', createLink);
linkRoutes.get('/:code/stats', getStats);
