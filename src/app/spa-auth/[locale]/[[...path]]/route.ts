import { getServerFeatureFlagsValue } from '@/config/featureFlags';
import { appEnv } from '@/envs/app';
import { authEnv } from '@/envs/auth';
import { type Locales, normalizeLocale } from '@/locales/resources';
import { getServerAuthConfig } from '@/server/globalConfig/getServerAuthConfig';
import { buildAnalyticsConfig, fetchViteDevTemplate, renderSpaHtml } from '@/server/spaHtml';
import { type AuthSPAServerConfig } from '@/types/spaServerConfig';
import { isSafeRedirectPath } from '@/utils/onboardingRedirect';

import { buildSeoMeta } from './seoMeta';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  const staticLocales: Locales[] = ['en-US', 'zh-CN'];

  return staticLocales.map((locale) => ({ locale }));
}

const isDev = process.env.NODE_ENV === 'development';
const GENERIC_OIDC_PROVIDER = 'generic-oidc';
const SUB2API_SOURCE = 'sub2api';

async function getTemplate(): Promise<string> {
  if (isDev) return fetchViteDevTemplate('/index.auth.html');

  const { authHtmlTemplate } = await import('../../authHtmlTemplate');

  return authHtmlTemplate;
}

const appendSetCookieHeaders = (target: Headers, source: Headers) => {
  const cookies = source.getSetCookie();

  for (const cookie of cookies) target.append('set-cookie', cookie);
};

const createNoStoreRedirect = (location: string) =>
  new Response(null, {
    headers: {
      'Cache-Control': 'no-store',
      'Location': location,
    },
    status: 302,
  });

const startSub2ApiSignIn = async (
  request: Request,
  pathname: string,
  serverConfig: AuthSPAServerConfig,
): Promise<Response | undefined> => {
  if (pathname !== '/signin') return;

  const url = new URL(request.url);
  if (url.searchParams.get('source') !== SUB2API_SOURCE) return;

  const providers = serverConfig.config.oAuthSSOProviders ?? [];
  if (
    !serverConfig.config.disableEmailPassword ||
    providers.length !== 1 ||
    providers[0] !== GENERIC_OIDC_PROVIDER
  )
    return;

  const callbackURL = url.searchParams.get('callbackUrl');
  if (!callbackURL || !isSafeRedirectPath(callbackURL)) return;

  const sub2ApiUserId = url.searchParams.get('sub2apiUserId')?.trim();

  try {
    const { auth } = await import('@/auth');

    try {
      const session = await auth.api.getSession({ headers: request.headers });

      if (session?.user?.id && sub2ApiUserId) {
        const { findLobeUserIdBySub2ApiUserId } = await import('@/libs/auth/sub2api-provision');
        const mappedLobeUserId = await findLobeUserIdBySub2ApiUserId(sub2ApiUserId);

        if (mappedLobeUserId === session.user.id) return createNoStoreRedirect(callbackURL);
      }
    } catch {
      // A failed session or identity lookup must not prevent the regular OIDC fallback.
    }

    const result = await auth.api.signInWithOAuth2({
      body: {
        callbackURL,
        newUserCallbackURL: callbackURL,
        providerId: GENERIC_OIDC_PROVIDER,
      },
      headers: request.headers,
      returnHeaders: true,
    });

    if (!result.response.redirect || !result.response.url) return;

    const response = createNoStoreRedirect(result.response.url);
    appendSetCookieHeaders(response.headers, result.headers);

    return response;
  } catch {
    // Keep the regular sign-in page available when the upstream OIDC provider is unavailable.
    return;
  }
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string; path?: string[] }> },
) {
  const { locale: rawLocale, path } = await params;
  const locale = normalizeLocale(rawLocale);

  const authConfig: AuthSPAServerConfig = {
    analyticsConfig: buildAnalyticsConfig(),
    config: getServerAuthConfig(),
    enableOIDC: authEnv.ENABLE_OIDC,
    featureFlags: getServerFeatureFlagsValue(),
    globalCDN: appEnv.CDN_USE_GLOBAL,
  };

  const pathname = `/${(path ?? []).join('/')}`;
  const sub2ApiRedirect = await startSub2ApiSignIn(request, pathname, authConfig);
  if (sub2ApiRedirect) return sub2ApiRedirect;

  const template = await getTemplate();
  const seoMeta = await buildSeoMeta(locale, pathname);

  return renderSpaHtml(template, { seoMeta, serverConfig: authConfig });
}
