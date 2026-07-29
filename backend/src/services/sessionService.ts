import { randomBytes } from 'node:crypto';
import { redis } from '../lib/redis.js';
import { config } from '../config/index.js';
import type { SessionUser } from '../domain/user.js';

const SESSION_PREFIX = 'sess:';
const STATE_PREFIX = 'oauth_state:';
export const STATE_TTL_SECONDS = 600;

function sessionKey(id: string): string {
  return `${SESSION_PREFIX}${id}`;
}

function stateKey(state: string): string {
  return `${STATE_PREFIX}${state}`;
}

export const sessionService = {
  // D1: opaque, high-entropy session id — nothing is signed, Redis is the sole
  // authority, so logout/expiry are immediate and centrally controlled.
  async create(user: SessionUser): Promise<string> {
    const id = randomBytes(32).toString('base64url');
    await redis.set(sessionKey(id), JSON.stringify(user), 'EX', config.sessionTtlSeconds);
    return id;
  },

  async get(id: string): Promise<SessionUser | null> {
    const raw = await redis.get(sessionKey(id));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as SessionUser;
  },

  async destroy(id: string): Promise<void> {
    await redis.del(sessionKey(id));
  },

  // D3: single-use CSRF state for the OAuth round-trip. Stored value is the
  // `returnTo` path so the callback can redirect back where the login started.
  async putState(returnTo: string): Promise<string> {
    const state = randomBytes(32).toString('base64url');
    await redis.set(stateKey(state), returnTo, 'EX', STATE_TTL_SECONDS);
    return state;
  },

  // GETDEL atomically reads and deletes in one round trip, guaranteeing a replayed
  // state can never be consumed twice even under concurrent callback requests.
  async consumeState(state: string): Promise<string | null> {
    return redis.getdel(stateKey(state));
  },
};
