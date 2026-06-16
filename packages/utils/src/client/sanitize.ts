import DOMPurify from 'dompurify';

const EVENT_HANDLER_ATTR_PATTERN = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

const FORBID_EVENT_HANDLERS = [
  'onblur',
  'onchange',
  'onclick',
  'onerror',
  'onfocus',
  'onkeydown',
  'onkeypress',
  'onkeyup',
  'onload',
  'onmousedown',
  'onmouseout',
  'onmouseover',
  'onmouseup',
  'onreset',
  'onselect',
  'onsubmit',
  'onunload',
];

/**
 * Sanitizes SVG content to prevent XSS attacks while preserving safe SVG elements and attributes
 * @param content - The SVG content to sanitize
 * @returns Sanitized SVG content safe for rendering
 */
export const sanitizeSVGContent = (content: string): string => {
  const sanitized = DOMPurify.sanitize(content, {
    FORBID_ATTR: FORBID_EVENT_HANDLERS,
    FORBID_TAGS: ['embed', 'link', 'object', 'script', 'style'],
    KEEP_CONTENT: false,
    USE_PROFILES: { svg: true, svgFilters: true },
  });

  return sanitized.replace(EVENT_HANDLER_ATTR_PATTERN, '');
};
