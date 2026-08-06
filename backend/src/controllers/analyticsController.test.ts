import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../services/analyticsService.js', () => ({
  analyticsService: {
    getDashboard: vi.fn(),
  },
}));

const { analyticsService } = await import('../services/analyticsService.js');
const { getDashboard } = await import('./analyticsController.js');

function buildRes(): Response {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

describe('analyticsController.getDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next with a 401 HttpError when there is no authenticated owner scope', async () => {
    const req = { ownerScope: undefined } as unknown as Request;
    const res = buildRes();
    const next = vi.fn() as NextFunction;

    await getDashboard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = vi.mocked(next).mock.calls[0]?.[0] as { statusCode?: number };
    expect(error?.statusCode).toBe(401);
    expect(analyticsService.getDashboard).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('returns 200 with the dashboard payload for an authenticated owner', async () => {
    const payload = {
      totalClicks30d: 10,
      series: [{ date: '2026-08-06', clicks: 10 }],
      topLinks: [{ linkId: 'link-1', shortCode: 'aaa', totalClicks: 10 }],
    };
    vi.mocked(analyticsService.getDashboard).mockResolvedValueOnce(payload);

    const req = { ownerScope: { authenticated: true, userId: 'user-1' } } as unknown as Request;
    const res = buildRes();
    const next = vi.fn() as NextFunction;

    await getDashboard(req, res, next);

    expect(analyticsService.getDashboard).toHaveBeenCalledWith('user-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(payload);
    expect(next).not.toHaveBeenCalled();
  });
});
