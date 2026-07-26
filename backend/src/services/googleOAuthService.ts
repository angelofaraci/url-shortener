import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/index.js';
import type { GoogleProfile } from '../repositories/userRepository.js';

export class GoogleProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleProfileError';
  }
}

function client(): OAuth2Client {
  return new OAuth2Client(config.googleClientId, config.googleClientSecret, config.googleRedirectUri);
}

export const googleOAuthService = {
  buildAuthUrl(state: string): string {
    return client().generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state,
      redirect_uri: config.googleRedirectUri,
    });
  },

  async exchangeCode(code: string): Promise<string> {
    const { tokens } = await client().getToken(code);
    if (!tokens.id_token) {
      throw new GoogleProfileError('Google token response did not include an id_token');
    }
    return tokens.id_token;
  },

  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    const ticket = await client().verifyIdToken({
      idToken,
      audience: config.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      throw new GoogleProfileError('Google id_token payload is missing required claims');
    }
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
      avatarUrl: payload.picture ?? null,
    };
  },
};
