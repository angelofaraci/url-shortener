import { Router } from 'express';
import { redirect } from '../controllers/redirectController.js';

export const redirectRoutes = Router();

redirectRoutes.get('/:code', redirect);
