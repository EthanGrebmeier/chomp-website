import got, { HTTPError, TimeoutError } from 'got'
import {
  RequestFilteringHttpAgent,
  RequestFilteringHttpsAgent,
} from 'request-filtering-agent'

export type HtmlFetchSuccess = {
  ok: true
  html: string
  contentType: string
  finalUrl: string
}

export type HtmlFetchErrorCode =
  | 'fetch_timeout'
  | 'content_too_large'
  | 'ssrf_blocked'
  | 'too_many_redirects'
  | 'fetch_failed'
  | 'invalid_content_type'

export type HtmlFetchError = {
  ok: false
  code: HtmlFetchErrorCode
  message: string
}

export type HtmlFetchResult = HtmlFetchSuccess | HtmlFetchError

export type HtmlFetchOptions = {
  timeoutMs?: number
  maxSizeBytes?: number
  maxRedirects?: number
}

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
const DEFAULT_MAX_REDIRECTS = 5

const USER_AGENT =
  'Mozilla/5.0 (compatible; ChompRecipeParser/1.0; +https://chompgrocery.com)'

// Create SSRF-protected agents
const httpAgent = new RequestFilteringHttpAgent()
const httpsAgent = new RequestFilteringHttpsAgent()

/**
 * Fetch HTML from a URL with security protections and limits.
 *
 * Uses `got` for HTTP with built-in timeout, redirect, and size limits.
 * SSRF protection via request-filtering-agent.
 */
export const fetchHtml = async (
  url: URL,
  options: HtmlFetchOptions = {}
): Promise<HtmlFetchResult> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS

  try {
    const response = await got(url.href, {
      agent: { http: httpAgent, https: httpsAgent },
      timeout: { request: timeoutMs },
      maxRedirects,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      responseType: 'text',
      // got doesn't have a direct downloadLimit, so we use a hook to check size
      hooks: {
        beforeRequest: [
          (opts) => {
            // Attach download limit check via response handler
            opts.context = { ...opts.context, maxSizeBytes }
          },
        ],
        afterResponse: [
          (response) => {
            const contentLength = response.headers['content-length']
            if (contentLength) {
              const length = parseInt(contentLength, 10)
              const limit = (response.request.options.context as { maxSizeBytes: number })
                .maxSizeBytes
              if (!isNaN(length) && length > limit) {
                const error = new Error(`Content size ${length} exceeds limit of ${limit} bytes`)
                ;(error as NodeJS.ErrnoException).code = 'ERR_CONTENT_TOO_LARGE'
                throw error
              }
            }
            return response
          },
        ],
      },
    })

    // Check actual body size (in case Content-Length was missing/wrong)
    if (response.body.length > maxSizeBytes) {
      return {
        ok: false,
        code: 'content_too_large',
        message: `Response body exceeds limit of ${maxSizeBytes} bytes`,
      }
    }

    const contentType = response.headers['content-type'] ?? ''
    if (!isHtmlContentType(contentType)) {
      return {
        ok: false,
        code: 'invalid_content_type',
        message: `Expected HTML content-type, got: ${contentType}`,
      }
    }

    return {
      ok: true,
      html: response.body,
      contentType,
      finalUrl: response.url,
    }
  } catch (error) {
    return handleFetchError(error)
  }
}

const isHtmlContentType = (contentType: string): boolean => {
  const lower = contentType.toLowerCase()
  return lower.includes('text/html') || lower.includes('application/xhtml+xml')
}

const handleFetchError = (error: unknown): HtmlFetchError => {
  if (error instanceof TimeoutError) {
    return { ok: false, code: 'fetch_timeout', message: 'Request timed out' }
  }

  if (error instanceof HTTPError) {
    return {
      ok: false,
      code: 'fetch_failed',
      message: `HTTP ${error.response.statusCode}: ${error.response.statusMessage}`,
    }
  }

  if (error instanceof Error) {
    const e = error as NodeJS.ErrnoException

    if (e.code === 'ERR_CONTENT_TOO_LARGE') {
      return { ok: false, code: 'content_too_large', message: e.message }
    }

    if (e.code === 'ERR_TOO_MANY_REDIRECTS') {
      return { ok: false, code: 'too_many_redirects', message: 'Too many redirects' }
    }

    // SSRF blocked by request-filtering-agent
    if (e.message?.includes('SSRF') || e.message?.includes('private') || e.message?.includes('blocked')) {
      return { ok: false, code: 'ssrf_blocked', message: 'Request blocked: target address not allowed' }
    }

    return { ok: false, code: 'fetch_failed', message: e.message }
  }

  return { ok: false, code: 'fetch_failed', message: 'Unknown fetch error' }
}
