import { z } from 'zod';

// Allowed domain patterns for asset fetching
const ALLOWED_DOMAINS = [
  /^.*\.googleapis\.com$/,
  /^.*\.googleusercontent\.com$/,
  /^.*\.gstatic\.com$/,
  /^fonts\.googleapis\.com$/,
  /^cdnjs\.cloudflare\.com$/,
  /^.*\.cloudflare\.com$/,
  /^unpkg\.com$/,
  /^cdn\.jsdelivr\.net$/,
  /^.*\.ggpht\.com$/,
];

// ERROR
export const UrlValidationErrorCode = z.enum([
  'INVALID_URL',
  'PROTOCOL_NOT_ALLOWED',
  'DOMAIN_NOT_ALLOWED',
  'INTERNAL_ADDRESS',
]);
export type UrlValidationErrorCode = z.infer<typeof UrlValidationErrorCode>;

// RESULT
export type UrlValidationResult =
  | { valid: true; url: URL }
  | { valid: false; code: UrlValidationErrorCode; message: string };

/**
 * Validates a URL against the allowlist to prevent SSRF attacks.
 * Only HTTPS URLs to approved domains are allowed.
 */
export function validateAssetUrl(rawUrl: string): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, code: 'INVALID_URL', message: `Malformed URL: ${rawUrl}` };
  }

  // HTTPS only
  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      code: 'PROTOCOL_NOT_ALLOWED',
      message: `Only HTTPS URLs are allowed, got: ${parsed.protocol}`,
    };
  }

  // Block internal/private IPs
  const hostname = parsed.hostname;
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('169.254.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local')
  ) {
    return {
      valid: false,
      code: 'INTERNAL_ADDRESS',
      message: `Internal/private addresses are not allowed: ${hostname}`,
    };
  }

  // Check domain allowlist
  const isAllowed = ALLOWED_DOMAINS.some((pattern) => pattern.test(hostname));
  if (!isAllowed) {
    return {
      valid: false,
      code: 'DOMAIN_NOT_ALLOWED',
      message: `Domain not in allowlist: ${hostname}`,
    };
  }

  return { valid: true, url: parsed };
}
