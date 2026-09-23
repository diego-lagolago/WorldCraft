/** A `host:port` prefix is not a scheme. */
const SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;
const HTTP = /^https?:\/\/\S+$/i;
const WHITESPACE_OR_CONTROL = /[\s\u0000-\u001f\u007f]/;

/**
 * ADR-004: external links only with http/https. A scheme-less address becomes
 * https. Anything else (javascript:, data:, mailto:, …) is rejected.
 */
export function normalizeLinkHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const href = raw.trim();
  if (!href || href.length > 2000 || WHITESPACE_OR_CONTROL.test(href)) return null;
  if (HTTP.test(href)) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (SCHEME.test(href)) return null;
  if (href.startsWith("/") || href.startsWith("#") || href.startsWith("?")) return null;
  return `https://${href}`;
}

export function isAllowedLinkHref(raw: unknown): boolean {
  return normalizeLinkHref(raw) !== null;
}
