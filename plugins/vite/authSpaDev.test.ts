import { describe, expect, it } from 'vitest';

import { isAuthSpaDevRoute, resolveAuthSpaLocale } from './authSpaDev';

describe('authSpaDevServer helpers', () => {
  it('routes auth SPA pages to the auth HTML shell', () => {
    expect(isAuthSpaDevRoute('/signin')).toBe(true);
    expect(isAuthSpaDevRoute('/signup')).toBe(true);
    expect(isAuthSpaDevRoute('/oauth/consent/abc123')).toBe(true);
    expect(isAuthSpaDevRoute('/oauth/device/confirm')).toBe(true);
    expect(isAuthSpaDevRoute('/oauth/callback/success')).toBe(true);
  });

  it('keeps backend and main SPA routes outside the auth HTML shell', () => {
    expect(isAuthSpaDevRoute('/oauth/connector/callback')).toBe(false);
    expect(isAuthSpaDevRoute('/api/auth/sign-in/email')).toBe(false);
    expect(isAuthSpaDevRoute('/settings')).toBe(false);
  });

  it('resolves locale from query before cookie and accept-language', () => {
    const url = new URL('http://localhost/signin?hl=zh-CN');

    expect(
      resolveAuthSpaLocale(
        {
          'accept-language': 'ja-JP,ja;q=0.9',
          'cookie': 'LOBE_LOCALE=en-US',
        },
        url,
      ),
    ).toBe('zh-CN');
  });
});
