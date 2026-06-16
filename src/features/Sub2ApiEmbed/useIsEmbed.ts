'use client';

import { useEffect, useState } from 'react';

import {
  SUB2API_EMBED_PARAM,
  SUB2API_EMBED_STORAGE_KEY,
  SUB2API_EMBED_VALUE,
} from './constants';

const readFromSearch = (): boolean | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const value = params.get(SUB2API_EMBED_PARAM);
  if (value === SUB2API_EMBED_VALUE) return true;
  if (value === 'off' || value === '0') return false;
  return null;
};

const readFromStorage = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(SUB2API_EMBED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const persist = (value: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.sessionStorage.setItem(SUB2API_EMBED_STORAGE_KEY, '1');
    else window.sessionStorage.removeItem(SUB2API_EMBED_STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

const resolve = (): boolean => {
  const fromUrl = readFromSearch();
  if (fromUrl !== null) {
    persist(fromUrl);
    return fromUrl;
  }
  return readFromStorage();
};

/**
 * Returns whether the current document is being rendered inside the sub2api
 * embed shell. The detection is sticky across in-app navigations (see
 * SUB2API_EMBED_STORAGE_KEY).
 *
 * SSR returns `false` to keep server-rendered markup neutral; the hook
 * re-evaluates on the client during the first effect so the embed class is
 * applied before paint in practice.
 */
export const useIsEmbed = (): boolean => {
  const [embed, setEmbed] = useState<boolean>(() => (typeof window === 'undefined' ? false : resolve()));

  useEffect(() => {
    setEmbed(resolve());

    // Re-check on history changes inside the SPA so the value stays correct
    // when the user navigates to a route that explicitly turns it off.
    const handler = () => setEmbed(resolve());
    window.addEventListener('popstate', handler);
    window.addEventListener('sub2api-embed-changed', handler as EventListener);
    return () => {
      window.removeEventListener('popstate', handler);
      window.removeEventListener('sub2api-embed-changed', handler as EventListener);
    };
  }, []);

  return embed;
};
