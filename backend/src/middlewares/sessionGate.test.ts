import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { sessionGate } from './sessionGate.js';

function fakeRes(): Response {
  return {
    status: vi.fn(),
    json: vi.fn(),
    redirect: vi.fn(),
  } as unknown as Response;
}

describe('sessionGate', () => {
  it('sets ownerScope for an authenticated request and calls next() once', () => {
    const req = { user: { id: 'user-1', email: 'a@b.com', name: 'A', avatarUrl: null } } as unknown as Request;
    const res = fakeRes();
    const next = vi.fn();

    sessionGate(req, res, next);

    expect(req.ownerScope).toEqual({ authenticated: true, userId: 'user-1' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('sets an anonymous ownerScope and calls next() once when there is no req.user', () => {
    const req = {} as unknown as Request;
    const res = fakeRes();
    const next = vi.fn();

    sessionGate(req, res, next);

    expect(req.ownerScope).toEqual({ authenticated: false, userId: null });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
