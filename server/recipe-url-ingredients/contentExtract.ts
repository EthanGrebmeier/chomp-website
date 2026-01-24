import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

export type ContentExtractSuccess = {
  ok: true
  title: string | null
  content: string
  byline: string | null
}

export type ContentExtractErrorCode = 'parse_failed' | 'no_content'

export type ContentExtractError = {
  ok: false
  code: ContentExtractErrorCode
  message: string
}

export type ContentExtractResult = ContentExtractSuccess | ContentExtractError

/**
 * Extract main content from HTML using Mozilla Readability.
 *
 * Parses HTML, removes scripts/styles/ads, and extracts the main article content.
 * Falls back to cleaned body text if Readability fails.
 */
export const extractContent = (html: string, url: string): ContentExtractResult => {
  try {
    const { document } = parseHTML(html)

    // Remove unwanted elements before extraction
    removeUnwantedElements(document)

    // Clone document for Readability (it mutates the DOM)
    const docClone = document.cloneNode(true) as typeof document

    // Try Readability extraction
    const reader = new Readability(docClone, { url })
    const article = reader.parse()

    if (article && article.textContent && article.textContent.trim().length > 0) {
      return {
        ok: true,
        title: article.title || null,
        content: article.textContent.trim(),
        byline: article.byline || null,
      }
    }

    // Fallback: extract cleaned body text
    const bodyText = extractBodyText(document)
    if (bodyText && bodyText.trim().length > 0) {
      return {
        ok: true,
        title: extractTitle(document),
        content: bodyText.trim(),
        byline: null,
      }
    }

    return {
      ok: false,
      code: 'no_content',
      message: 'No extractable content found in page',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      ok: false,
      code: 'parse_failed',
      message: `Failed to parse HTML: ${message}`,
    }
  }
}

/**
 * Remove scripts, styles, and other non-content elements.
 */
const removeUnwantedElements = (document: Document): void => {
  const selectorsToRemove = [
    'script',
    'style',
    'noscript',
    'iframe',
    'svg',
    'canvas',
    'video',
    'audio',
    'object',
    'embed',
    'form',
    'nav',
    'header',
    'footer',
    'aside',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '.advertisement',
    '.ad',
    '.ads',
    '.social-share',
    '.comments',
    '.related-posts',
  ]

  for (const selector of selectorsToRemove) {
    try {
      const elements = document.querySelectorAll(selector)
      elements.forEach((el) => el.remove())
    } catch {
      // Ignore selector errors (linkedom may not support all selectors)
    }
  }
}

/**
 * Extract text content from body as fallback.
 */
const extractBodyText = (document: Document): string | null => {
  const body = document.body
  if (!body) return null

  // Get text content, normalize whitespace
  const text = body.textContent || ''
  return normalizeWhitespace(text)
}

/**
 * Extract page title from document.
 */
const extractTitle = (document: Document): string | null => {
  // Try <title> first
  const titleEl = document.querySelector('title')
  if (titleEl?.textContent) {
    return titleEl.textContent.trim()
  }

  // Try <h1>
  const h1 = document.querySelector('h1')
  if (h1?.textContent) {
    return h1.textContent.trim()
  }

  // Try og:title
  const ogTitle = document.querySelector('meta[property="og:title"]')
  if (ogTitle) {
    const content = ogTitle.getAttribute('content')
    if (content) return content.trim()
  }

  return null
}

/**
 * Normalize whitespace: collapse multiple spaces/newlines into single spaces.
 */
const normalizeWhitespace = (text: string): string => {
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
}
