import { describe, it, expect, vi, beforeEach } from 'vitest';

const cleanupMock = vi.fn();
const prismaMock = { $disconnect: vi.fn() };
const redisMock = { disconnect: vi.fn() };

vi.mock('./cleanupAnonymousLinks.js', () => ({ cleanupAnonymousLinks: cleanupMock }));
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../lib/redis.js', () => ({ redis: redisMock }));

// Importing this module must never call `process.exit` as a side effect — only
// the direct-run guard at the bottom of cleanup.ts does that, and it is gated on
// `process.argv[1]`, which is vitest's own script path in this test run.
const { main } = await import('./cleanup.js');

describe('cleanup CLI entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns exit code 0 and disconnects prisma+redis when cleanup succeeds', async () => {
    cleanupMock.mockResolvedValueOnce({ scanned: 3, deleted: 2 });

    const code = await main();

    expect(code).toBe(0);
    expect(prismaMock.$disconnect).toHaveBeenCalled();
    expect(redisMock.disconnect).toHaveBeenCalled();
  });

  it('returns exit code 1 when the cleanup function throws, so k8s retries the Job', async () => {
    cleanupMock.mockRejectedValueOnce(new Error('db unreachable'));

    const code = await main();

    expect(code).toBe(1);
    expect(prismaMock.$disconnect).toHaveBeenCalled();
    expect(redisMock.disconnect).toHaveBeenCalled();
  });
});
