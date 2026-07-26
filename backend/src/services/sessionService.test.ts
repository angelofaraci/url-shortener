import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '../domain/user.js';

const redisMock = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  // ioredis exposes GETDEL as `getdel` on its promise-based API.
  getdel: vi.fn(),
};

vi.mock('../lib/redis.js', () => ({ redis: redisMock }));

const { sessionService } = await import('./sessionService.js');

const user: SessionUser = {
  id: 'user-1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  avatarUrl: null,
};

describe('sessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create/get/destroy', () => {
    it('creates a session and stores the user JSON under sess:{id} with a 7d TTL', async () => {
      const id = await sessionService.create(user);

      expect(id).toEqual(expect.any(String));
      expect(redisMock.set).toHaveBeenCalledWith(
        `sess:${id}`,
        JSON.stringify(user),
        'EX',
        604800,
      );
    });

    it('returns the stored user for a valid session id', async () => {
      redisMock.get.mockResolvedValueOnce(JSON.stringify(user));

      const result = await sessionService.get('abc');

      expect(redisMock.get).toHaveBeenCalledWith('sess:abc');
      expect(result).toEqual(user);
    });

    it('returns null when the session id is unknown or expired', async () => {
      redisMock.get.mockResolvedValueOnce(null);

      const result = await sessionService.get('missing');

      expect(result).toBeNull();
    });

    it('destroys a session by deleting its Redis key', async () => {
      await sessionService.destroy('abc');

      expect(redisMock.del).toHaveBeenCalledWith('sess:abc');
    });
  });

  describe('OAuth state single-use store', () => {
    it('stores the returnTo path under oauth_state:{state} with a 600s TTL', async () => {
      const state = await sessionService.putState('/dashboard');

      expect(state).toEqual(expect.any(String));
      expect(redisMock.set).toHaveBeenCalledWith(`oauth_state:${state}`, '/dashboard', 'EX', 600);
    });

    it('consumes a valid state exactly once via GETDEL, returning the stored returnTo', async () => {
      redisMock.getdel.mockResolvedValueOnce('/dashboard');

      const returnTo = await sessionService.consumeState('valid-state');

      expect(redisMock.getdel).toHaveBeenCalledWith('oauth_state:valid-state');
      expect(returnTo).toBe('/dashboard');
    });

    it('returns null for a missing, unknown, or already-consumed state', async () => {
      redisMock.getdel.mockResolvedValueOnce(null);

      const returnTo = await sessionService.consumeState('replayed-state');

      expect(returnTo).toBeNull();
    });
  });
});
