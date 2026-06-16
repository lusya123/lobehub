// Sub2API embed integration — local constants only.
//
// This module is a self-contained patch that adapts LobeChat for being
// embedded inside the sub2api admin shell. Everything that powers the
// embed mode lives under `src/features/Sub2ApiEmbed/` so future upstream
// merges have a near-zero conflict surface.

export const SUB2API_EMBED_PARAM = 'embed';
export const SUB2API_EMBED_VALUE = 'sub2api';
export const SUB2API_EMBED_BODY_CLASS = 'sub2api-embed';

/**
 * Local storage key used to "stick" embed mode across in-app navigations.
 * Once the iframe lands with ?embed=sub2api once, every subsequent route
 * change inside lobehub keeps the embed shell — without it, clicking the
 * inbox or settings would drop the param and bring back the chrome.
 *
 * Cleared on explicit non-embed navigations (we don't try to outsmart the
 * user — a fresh tab on http://127.0.0.1:3210/ will look normal again).
 */
export const SUB2API_EMBED_STORAGE_KEY = 'sub2api:embed-mode';
