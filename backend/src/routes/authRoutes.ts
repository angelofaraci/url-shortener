import { Router } from 'express';
import { startGoogleLogin, googleCallback, me, logout } from '../controllers/authController.js';

export const authRoutes = Router();

authRoutes.get('/google', startGoogleLogin);
authRoutes.get('/google/callback', googleCallback);
authRoutes.get('/me', me);
authRoutes.post('/logout', logout);
