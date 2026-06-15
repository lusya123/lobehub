import { getServerFeatureFlagsValue } from '@/config/featureFlags';
import { appEnv } from '@/envs/app';
import { authEnv } from '@/envs/auth';
import { normalizeLocale } from '@/locales/resources';
import { buildAnalyticsConfig, renderSpaHtml } from '@/server/spaHtml';
import type { AuthSPAServerConfig } from '@/types/spaServerConfig';
import { getServerAuthConfig } from '~server/globalConfig/getServerAuthConfig';

import { buildSeoMeta } from '../app/spa-auth/[locale]/[[...path]]/seoMeta';

interface AuthSpaHtmlOptions {
  locale: string;
  pathname: string;
  template: string;
}

export async function createAuthSpaHtmlResponse({
  locale: rawLocale,
  pathname,
  template,
}: AuthSpaHtmlOptions): Promise<Response> {
  const locale = normalizeLocale(rawLocale);
  const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const authConfig: AuthSPAServerConfig = {
    analyticsConfig: buildAnalyticsConfig(),
    config: getServerAuthConfig(),
    enableOIDC: authEnv.ENABLE_OIDC,
    featureFlags: getServerFeatureFlagsValue(),
    globalCDN: appEnv.CDN_USE_GLOBAL,
  };
  const seoMeta = await buildSeoMeta(locale, normalizedPathname);

  return renderSpaHtml(template, { seoMeta, serverConfig: authConfig });
}
