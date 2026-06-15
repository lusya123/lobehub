import { readFile } from 'node:fs/promises';
import type { IncomingHttpHeaders, ServerResponse } from 'node:http';
import path from 'node:path';

import type { PluginOption, ViteDevServer } from 'vite';

import type { createAuthSpaHtmlResponse } from '../../src/server/authSpaHtml';

interface AuthSpaHtmlModule {
  createAuthSpaHtmlResponse: typeof createAuthSpaHtmlResponse;
}

const LOCALE_COOKIE_NAME = 'LOBE_LOCALE';
const AUTH_SPA_EXACT_ROUTES = new Set([
  '/auth-error',
  '/market-auth-callback',
  '/reset-password',
  '/signin',
  '/signup',
  '/verify-email',
]);
const AUTH_SPA_PREFIX_ROUTES = ['/oauth/callback', '/oauth/consent', '/oauth/device'];

const normalizePathname = (pathname: string) =>
  pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

export const isAuthSpaDevRoute = (pathname: string): boolean => {
  const normalized = normalizePathname(pathname);

  return (
    AUTH_SPA_EXACT_ROUTES.has(normalized) ||
    AUTH_SPA_PREFIX_ROUTES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    )
  );
};

const parseCookieValue = (cookieHeader: string | undefined, name: string) => {
  if (!cookieHeader) return;

  for (const entry of cookieHeader.split(';')) {
    const [rawKey, ...rawValue] = entry.split('=');
    if (rawKey?.trim() !== name) continue;

    try {
      return decodeURIComponent(rawValue.join('=').trim());
    } catch {
      return rawValue.join('=').trim();
    }
  }
};

export const resolveAuthSpaLocale = (headers: IncomingHttpHeaders, url: URL): string =>
  url.searchParams.get('hl') ||
  parseCookieValue(
    typeof headers.cookie === 'string' ? headers.cookie : undefined,
    LOCALE_COOKIE_NAME,
  ) ||
  (typeof headers['accept-language'] === 'string'
    ? headers['accept-language'].split(',')[0]
    : undefined) ||
  'en-US';

const acceptsHtml = (headers: IncomingHttpHeaders) => {
  const acceptHeader = headers.accept;
  const accept = Array.isArray(acceptHeader) ? acceptHeader.join(',') : acceptHeader;

  return !accept || accept.includes('text/html') || accept.includes('*/*');
};

const shouldServeAuthSpaHtml = (
  method: string | undefined,
  headers: IncomingHttpHeaders,
  url: URL,
) =>
  (method === 'GET' || method === 'HEAD') &&
  acceptsHtml(headers) &&
  isAuthSpaDevRoute(url.pathname);

const writeWebResponse = async (
  res: ServerResponse,
  response: Response,
  options: { headOnly: boolean },
) => {
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  res.statusCode = response.status;

  if (options.headOnly) {
    res.end();
    return;
  }

  res.end(Buffer.from(await response.arrayBuffer()));
};

async function renderAuthSpaHtml(server: ViteDevServer, headers: IncomingHttpHeaders, url: URL) {
  const indexPath = path.resolve(server.config.root, 'index.auth.html');
  const rawTemplate = await readFile(indexPath, 'utf8');
  const template = await server.transformIndexHtml(`${url.pathname}${url.search}`, rawTemplate);
  const { createAuthSpaHtmlResponse } = (await server.ssrLoadModule(
    '/src/server/authSpaHtml.ts',
  )) as AuthSpaHtmlModule;

  return createAuthSpaHtmlResponse({
    locale: resolveAuthSpaLocale(headers, url),
    pathname: url.pathname,
    template,
  });
}

export const authSpaDevServer = (): PluginOption => ({
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      try {
        if (!req.url) {
          next();
          return;
        }

        const url = new URL(req.url, 'http://localhost');
        if (!shouldServeAuthSpaHtml(req.method, req.headers, url)) {
          next();
          return;
        }

        const response = await renderAuthSpaHtml(server, req.headers, url);
        await writeWebResponse(res, response, { headOnly: req.method === 'HEAD' });
      } catch (error) {
        server.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
  },
  name: 'lobe-auth-spa-dev-server',
});
