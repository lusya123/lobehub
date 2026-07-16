import { afterEach, describe, expect, it, vi } from 'vitest';

import { __testing, fetchWithSessionPrefetch } from './sessionPrefetch';

afterEach(() => {
  window.__LOBE_AUTH_SESSION_PREFETCH__ = undefined;
  vi.unstubAllGlobals();
});

describe('sessionPrefetch', () => {
  it('matches only GET requests for the Better Auth session endpoint', () => {
    expect(__testing.isSessionRequest('/api/auth/get-session')).toBe(true);
    expect(
      __testing.isSessionRequest(
        'https://example.com/api/auth/get-session?disableCookieCache=true',
      ),
    ).toBe(true);
    expect(__testing.isSessionRequest('/api/auth/get-session', { method: 'POST' })).toBe(false);
    expect(__testing.isSessionRequest('/api/auth/sign-in')).toBe(false);
  });

  it('uses the HTML-prefetched session response once without another request', async () => {
    const prefetchedResponse = new Response('{"user":{"id":"user-1"}}');
    const networkFetch = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', networkFetch);
    window.__LOBE_AUTH_SESSION_PREFETCH__ = Promise.resolve(prefetchedResponse);

    const response = await fetchWithSessionPrefetch('/api/auth/get-session');

    expect(response).toBe(prefetchedResponse);
    expect(networkFetch).not.toHaveBeenCalled();
    expect(window.__LOBE_AUTH_SESSION_PREFETCH__).toBeUndefined();
  });

  it('falls back to the network without consuming the prefetch for other endpoints', async () => {
    const prefetchedSession = Promise.resolve(new Response('{}'));
    const networkResponse = new Response('{}');
    const networkFetch = vi.fn<typeof fetch>().mockResolvedValue(networkResponse);
    vi.stubGlobal('fetch', networkFetch);
    window.__LOBE_AUTH_SESSION_PREFETCH__ = prefetchedSession;

    const response = await fetchWithSessionPrefetch('/api/auth/sign-out', { method: 'POST' });

    expect(response).toBe(networkResponse);
    expect(networkFetch).toHaveBeenCalledOnce();
    expect(window.__LOBE_AUTH_SESSION_PREFETCH__).toBe(prefetchedSession);
  });

  it('falls back to the network when the early prefetch could not complete', async () => {
    const networkResponse = new Response('null');
    const networkFetch = vi.fn<typeof fetch>().mockResolvedValue(networkResponse);
    vi.stubGlobal('fetch', networkFetch);
    window.__LOBE_AUTH_SESSION_PREFETCH__ = Promise.resolve(null);

    const response = await fetchWithSessionPrefetch('/api/auth/get-session');

    expect(response).toBe(networkResponse);
    expect(networkFetch).toHaveBeenCalledOnce();
  });
});
