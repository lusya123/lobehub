import { describe, expect, it } from 'vitest';

import { defineConfig } from './define-config';

describe('defineConfig', () => {
  it('serves content-hashed SPA assets with immutable browser and CDN caching', async () => {
    const config = defineConfig({});
    const headers = await config.headers?.();
    const spaAssets = headers?.find(({ source }) => source === '/_spa/assets/:path*');

    expect(spaAssets?.headers).toEqual([
      {
        key: 'Cache-Control',
        value: 'public, max-age=31536000, immutable',
      },
      {
        key: 'CDN-Cache-Control',
        value: 'public, max-age=31536000, immutable',
      },
    ]);
  });
});
