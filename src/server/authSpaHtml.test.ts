// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { createAuthSpaHtmlResponse } from './authSpaHtml';

vi.mock('@/config/featureFlags', () => ({
  getServerFeatureFlagsValue: () => ({ enableAuthSpaTestFlag: true }),
}));

vi.mock('@/envs/app', () => ({
  appEnv: { CDN_USE_GLOBAL: true },
}));

vi.mock('@/envs/auth', () => ({
  authEnv: { ENABLE_OIDC: true },
}));

vi.mock('~server/globalConfig/getServerAuthConfig', () => ({
  getServerAuthConfig: () => ({
    aiProvider: {},
    enableMagicLink: true,
    telemetry: {},
  }),
}));

vi.mock('../app/spa-auth/[locale]/[[...path]]/seoMeta', () => ({
  buildSeoMeta: async (locale: string, pathname: string) => `<title>${locale}:${pathname}</title>`,
}));

describe('createAuthSpaHtmlResponse', () => {
  it('renders auth SPA HTML with server config and SEO metadata', async () => {
    const template = [
      '<html><head>',
      '<!--SEO_META-->',
      '<script>window.__SERVER_CONFIG__ = undefined; /* SERVER_CONFIG */</script>',
      '</head><body><!--ANALYTICS_SCRIPTS--></body></html>',
    ].join('\n');

    const response = await createAuthSpaHtmlResponse({
      locale: 'zh-CN',
      pathname: 'signin',
      template,
    });
    const html = await response.text();

    expect(html).toContain('<title>zh-CN:/signin</title>');
    expect(html).toContain('"enableOIDC":true');
    expect(html).toContain('"enableMagicLink":true');
    expect(html).toContain('"globalCDN":true');
    expect(html).not.toContain('/* SERVER_CONFIG */');
    expect(html).not.toContain('ANALYTICS_SCRIPTS');
  });
});
