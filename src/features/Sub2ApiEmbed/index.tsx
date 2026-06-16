/**
 * Sub2API embed integration — public API.
 *
 * Why no AutoSignIn component? LobeChat's signin page (`useSignIn.ts`)
 * already auto-redirects when there is a single configured SSO provider
 * (`generic-oidc`) and email/password is disabled — both true in our
 * sub2api setup. The user sees nothing more than a brief loader before the
 * OIDC handshake completes silently against the sub2api cookie.
 *
 * Everything in this folder is local to the sub2api fork. The only place
 * outside this folder that imports from here is
 * `src/routes/(main)/_layout/index.tsx` — see the marked sub2api-embed
 * sections there.
 */

export { default as EmbedStyleInjector } from './EmbedStyleInjector';
export { useIsEmbed } from './useIsEmbed';
export {
  SUB2API_EMBED_BODY_CLASS,
  SUB2API_EMBED_PARAM,
  SUB2API_EMBED_STORAGE_KEY,
  SUB2API_EMBED_VALUE,
} from './constants';
