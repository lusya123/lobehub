// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const mocks = vi.hoisted(() => ({
  authConfig: {
    disableEmailPassword: true,
    oAuthSSOProviders: ['generic-oidc'],
  },
  signInWithOAuth2: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: { api: { signInWithOAuth2: mocks.signInWithOAuth2 } },
}));

vi.mock('@/config/featureFlags', () => ({ getServerFeatureFlagsValue: vi.fn(() => ({})) }));
vi.mock('@/envs/app', () => ({ appEnv: { CDN_USE_GLOBAL: false } }));
vi.mock('@/envs/auth', () => ({ authEnv: { ENABLE_OIDC: false } }));
vi.mock('@/server/globalConfig/getServerAuthConfig', () => ({
  getServerAuthConfig: vi.fn(() => mocks.authConfig),
}));
vi.mock('@/server/spaHtml', () => ({
  buildAnalyticsConfig: vi.fn(() => ({})),
  fetchViteDevTemplate: vi.fn(),
  renderSpaHtml: vi.fn(() => new Response('auth-shell', { status: 200 })),
}));
vi.mock('../../authHtmlTemplate', () => ({ authHtmlTemplate: '<html></html>' }));
vi.mock('./seoMeta', () => ({ buildSeoMeta: vi.fn(async () => '<title>Sign in</title>') }));

const params = Promise.resolve({ locale: 'en-US', path: ['signin'] });

const createRequest = (search = '') =>
  new Request(`https://lobe.example.com/spa-auth/en-US/signin${search}`, {
    headers: { 'user-agent': 'vitest' },
  });

describe('Sub2API server-side sign in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authConfig.disableEmailPassword = true;
    mocks.authConfig.oAuthSSOProviders = ['generic-oidc'];
    mocks.signInWithOAuth2.mockResolvedValue({
      headers: new Headers({
        'set-cookie': 'better-auth.state=state-token; Path=/; HttpOnly; SameSite=Lax',
      }),
      response: {
        redirect: true,
        url: 'https://sub2api.example.com/api/v1/oidc/authorize?state=state-token',
      },
    });
  });

  it('redirects before rendering the sign-in shell and preserves the OAuth state cookie', async () => {
    const callbackURL = '/agent/inbox?provider=sub2api-group-7&modelId=gpt-5.4-mini';
    const request = createRequest(`?source=sub2api&callbackUrl=${encodeURIComponent(callbackURL)}`);

    const response = await GET(request, { params });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://sub2api.example.com/api/v1/oidc/authorize?state=state-token',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toContain('better-auth.state=state-token');
    expect(mocks.signInWithOAuth2).toHaveBeenCalledWith({
      body: {
        callbackURL,
        newUserCallbackURL: callbackURL,
        providerId: 'generic-oidc',
      },
      headers: request.headers,
      returnHeaders: true,
    });
    await expect(response.text()).resolves.toBe('');
  });

  it('renders the normal sign-in page without the Sub2API source marker', async () => {
    const response = await GET(createRequest('?callbackUrl=%2Fagent%2Finbox'), { params });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('auth-shell');
    expect(mocks.signInWithOAuth2).not.toHaveBeenCalled();
  });

  it.each(['https://evil.example/chat', '//evil.example/chat', '/\\evil.example/chat'])(
    'does not auto-redirect an unsafe callback URL: %s',
    async (callbackURL) => {
      const response = await GET(
        createRequest(`?source=sub2api&callbackUrl=${encodeURIComponent(callbackURL)}`),
        { params },
      );

      expect(response.status).toBe(200);
      expect(mocks.signInWithOAuth2).not.toHaveBeenCalled();
    },
  );

  it('renders the normal sign-in page when Generic OIDC is not the only provider', async () => {
    mocks.authConfig.oAuthSSOProviders = ['generic-oidc', 'github'];

    const response = await GET(createRequest('?source=sub2api&callbackUrl=%2Fagent%2Finbox'), {
      params,
    });

    expect(response.status).toBe(200);
    expect(mocks.signInWithOAuth2).not.toHaveBeenCalled();
  });

  it('falls back to the normal sign-in page if OIDC initialization fails', async () => {
    mocks.signInWithOAuth2.mockRejectedValue(new Error('provider unavailable'));

    const response = await GET(createRequest('?source=sub2api&callbackUrl=%2Fagent%2Finbox'), {
      params,
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('auth-shell');
  });
});
