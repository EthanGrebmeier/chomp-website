export type UrlValidationResult =
  | { valid: true; url: URL }
  | { valid: false; reason: string }

/**
 * Validate a URL for basic requirements before fetching.
 *
 * This performs basic URL validation:
 * - URL must be parseable
 * - Scheme must be http or https
 *
 * SSRF protection (blocking private IPs, DNS rebinding, etc.) is handled
 * at the fetch level using `request-filtering-agent`.
 */
export const validateUrl = (urlString: string): UrlValidationResult => {
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    return { valid: false, reason: 'Invalid URL format.' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { valid: false, reason: 'URL must use http or https protocol.' }
  }

  return { valid: true, url }
}
