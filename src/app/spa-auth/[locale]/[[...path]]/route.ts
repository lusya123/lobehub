import type { Locales } from '@/locales/resources';
import { createAuthSpaHtmlResponse } from '@/server/authSpaHtml';
import { fetchViteDevTemplate } from '@/server/spaHtml';

export function generateStaticParams() {
  const staticLocales: Locales[] = ['en-US', 'zh-CN'];

  return staticLocales.map((locale) => ({ locale }));
}

const isDev = process.env.NODE_ENV === 'development';

async function getTemplate(): Promise<string> {
  if (isDev) return fetchViteDevTemplate('/index.auth.html');

  const { authHtmlTemplate } = await import('../../authHtmlTemplate');

  return authHtmlTemplate;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; path?: string[] }> },
) {
  const { locale: rawLocale, path } = await params;
  const template = await getTemplate();

  return createAuthSpaHtmlResponse({
    locale: rawLocale,
    pathname: `/${(path ?? []).join('/')}`,
    template,
  });
}
