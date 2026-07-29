import { Router } from 'express';
import { startGoogleLogin, googleCallback, me, logout } from '../controllers/authController.js';
import { authRateLimiter } from '../middlewares/rateLimiter.js';

export const authRoutes = Router();

// These two hops trigger outbound calls to Google's token/userinfo endpoints,
// so they get their own stricter budget on top of the app-wide generalRateLimiter.
authRoutes.get('/google', authRateLimiter, startGoogleLogin);
authRoutes.get('/google/callback', authRateLimiter, googleCallback);
authRoutes.get('/me', me);
authRoutes.post('/logout', logout);
