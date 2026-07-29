import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { rateLimitKeyGenerator } from './rateLimiter.js';

describe('rateLimitKeyGenerator', () => {
  it('returns a user-scoped key for an authenticated request, regardless of IP', () => {
    const req = {
      user: { id: 'user-1', email: 'a@b.com', name: 'A', avatarUrl: null },
      ip: '203.0.113.7',
    } as unknown as Request;

    expect(rateLimitKeyGenerator(req)).toBe('user:user-1');
  });

  it('falls back to an IP-based key for an anonymous request', () => {
    const req = { ip: '203.0.113.7' } as unknown as Request;

    expect(rateLimitKeyGenerator(req)).toBe(ipKeyGenerator('203.0.113.7'));
  });

  it('normalizes an anonymous IPv6 address the same way the library-provided ipKeyGenerator does', () => {
    const req = { ip: '2001:db8::1' } as unknown as Request;

    expect(rateLimitKeyGenerator(req)).toBe(ipKeyGenerator('2001:db8::1'));
  });
});
