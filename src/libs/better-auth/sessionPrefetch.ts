const SESSION_PATH = '/api/auth/get-session';

const isSessionRequest = (input: RequestInfo | URL, init?: RequestInit) => {
  const requestMethod =
    init?.method ||
    (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET');

  if (requestMethod.toUpperCase() !== 'GET') return false;

  const requestUrl = typeof input === 'string' ? input : 'url' in input ? input.url : input.href;

  const baseUrl = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;

  return new URL(requestUrl, baseUrl).pathname === SESSION_PATH;
};

export const fetchWithSessionPrefetch: typeof fetch = async (input, init) => {
  if (typeof window !== 'undefined' && isSessionRequest(input, init)) {
    const prefetchedSession = window.__LOBE_AUTH_SESSION_PREFETCH__;
    window.__LOBE_AUTH_SESSION_PREFETCH__ = undefined;

    if (prefetchedSession) {
      const response = await prefetchedSession;
      if (response) return response;
    }
  }

  return fetch(input, init);
};

export const __testing = { isSessionRequest };
