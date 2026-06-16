'use client';

import { memo, useEffect } from 'react';

import { SUB2API_EMBED_BODY_CLASS } from './constants';
import './embed.css';
import { useIsEmbed } from './useIsEmbed';

/**
 * Toggles the global `.sub2api-embed` body class so `embed.css` activates.
 * Mounted near the root of the main layout — see `(main)/_layout/index.tsx`.
 *
 * Renders nothing. All visual changes are driven by CSS to keep the surface
 * area against upstream LobeChat code as small as possible (one class on
 * <body>).
 */
const EmbedStyleInjector = memo(() => {
  const isEmbed = useIsEmbed();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isEmbed) {
      document.body.classList.add(SUB2API_EMBED_BODY_CLASS);
    } else {
      document.body.classList.remove(SUB2API_EMBED_BODY_CLASS);
    }
    return () => {
      // On unmount, leave the class as-is. Removing on every layout unmount
      // produces a visible flash during route transitions inside the SPA.
    };
  }, [isEmbed]);

  return null;
});

EmbedStyleInjector.displayName = 'Sub2ApiEmbedStyleInjector';

export default EmbedStyleInjector;
