import { Router } from 'express';
import { getDashboard } from '../controllers/analyticsController.js';
import { sessionGate } from '../middlewares/sessionGate.js';

export const analyticsRoutes = Router();

analyticsRoutes.get('/dashboard', sessionGate, getDashboard);
