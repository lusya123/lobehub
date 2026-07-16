import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  findLobeUserIdBySub2ApiUserId: vi.fn(),
  refreshSub2ApiConfig: vi.fn(),
}));

vi.mock('next/server', async () => {
  const original = await vi.importActual<Record<string, unknown>>('next/server');

  return { ...original, after: mocks.after };
});

vi.mock('@/libs/auth/sub2api-provision', () => ({
  findLobeUserIdBySub2ApiUserId: mocks.findLobeUserIdBySub2ApiUserId,
  refreshSub2ApiConfig: mocks.refreshSub2ApiConfig,
}));

const createRequest = (authorization = 'Bearer internal-secret') =>
  new Request('http://localhost/api/internal/sync-user', {
    body: JSON.stringify({ user_id: '2412' }),
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

describe('POST /api/internal/sync-user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUB2API_INTERNAL_SECRET = 'internal-secret';
  });

  it('rejects requests without the internal shared secret', async () => {
    const response = await POST(createRequest('Bearer wrong-secret'));

    expect(response.status).toBe(401);
    expect(mocks.findLobeUserIdBySub2ApiUserId).not.toHaveBeenCalled();
  });

  it('uses a deferred refresh when the linked user is already configured', async () => {
    mocks.findLobeUserIdBySub2ApiUserId.mockResolvedValue('lobe-user');
    mocks.refreshSub2ApiConfig.mockResolvedValue('deferred');

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, refresh: 'deferred' });
    expect(mocks.refreshSub2ApiConfig).toHaveBeenCalledWith('lobe-user', '2412', {
      deferWhenConfigured: mocks.after,
    });
  });

  it('keeps unknown users as a successful no-op', async () => {
    mocks.findLobeUserIdBySub2ApiUserId.mockResolvedValue(undefined);

    const response = await POST(createRequest());

    expect(await response.json()).toEqual({ ok: true, skipped: 'user not found' });
    expect(mocks.refreshSub2ApiConfig).not.toHaveBeenCalled();
  });
});
