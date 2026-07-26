import { config } from '../config/index.js';
import { googleOAuthService } from './googleOAuthService.js';
import { userRepository } from '../repositories/userRepository.js';
import { sessionService } from './sessionService.js';
import { toSessionUser, type SessionUser } from '../domain/user.js';

export const authService = {
  // D4: Google credentials are optional. Every entry point must check this before
  // touching googleOAuthService so a deploy without OAuth credentials stays healthy.
  isConfigured(): boolean {
    return Boolean(config.googleClientId && config.googleClientSecret && config.googleRedirectUri);
  },

  async completeLogin(code: string): Promise<{ sessionId: string; user: SessionUser }> {
    const idToken = await googleOAuthService.exchangeCode(code);
    const profile = await googleOAuthService.verifyIdToken(idToken);
    const user = await userRepository.upsertByGoogleId(profile);
    const sessionUser = toSessionUser(user);
    const sessionId = await sessionService.create(sessionUser);
    return { sessionId, user: sessionUser };
  },
};
