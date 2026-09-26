import { Defuddle } from 'defuddle/node'
import { JSDOM } from 'jsdom'
import { parseHTML } from 'linkedom'
import {
  extractHtmlListRecipe,
  extractStructuredRecipe,
  formatStructuredRecipeAsContent,
  type StructuredRecipe,
} from './structuredRecipe.js'

export type ContentExtractSuccess = {
  ok: true
  title: string | null
  content: string
  byline: string | null
  /**
   * Machine-readable recipe data (JSON-LD, WPRM, microdata) when the page has
   * it. Enables the deterministic, LLM-free parse path.
   */
  recipe: StructuredRecipe | null
}

export type ContentExtractErrorCode = 'parse_failed' | 'no_content'

export type ContentExtractError = {
  ok: false
  code: ContentExtractErrorCode
  message: string
}

export type ContentExtractResult = ContentExtractSuccess | ContentExtractError

/**
 * Opening tag of a reader-comment / discussion container. Recipe content always
 * precedes comments, so everything from here on is dead weight for extraction.
 */
const DISCUSSION_MARKER =
  /<(?:div|section|ol|ul|aside)\b[^>]*\b(?:id|class)\s*=\s*["'][^"']*\b(?:comments|comment-list|commentlist|comments-area|comment-respond)\b/i

/**
 * Truncate HTML at the first comment/discussion container.
 *
 * The expensive part of extraction is building the DOM, and its cost scales
 * with document size. A recipe blog post can be 1.5MB where <5% is the article
 * and the rest is thousands of reader comments. Cutting the tail before we ever
 * parse takes DOM construction from hundreds of ms to single digits (and ~6s to
 * <1s on the production box) with byte-identical article output. JSON-LD lives
 * in <head>, so it is always preserved. If no marker is found the HTML is
 * returned unchanged.
 */
const trimAfterDiscussion = (html: string): string => {
  const index = html.search(DISCUSSION_MARKER)
  if (index === -1) return html
  return `${html.slice(0, index)}</body></html>`
}

/**
 * Extract main content from HTML, prioritizing JSON-LD Recipe data.
 *
 * First attempts to extract structured Recipe data from JSON-LD scripts.
 * Falls back to Defuddle for general content extraction.
 *
 * Trims the comment thread before parsing for performance; if that trim yields
 * nothing extractable (an unexpectedly early marker match) we retry on the full
 * HTML so a heuristic can never cost us a recipe.
 */
export const extractContent = async (
  html: string,
  url: string
): Promise<ContentExtractResult> => {
  const trimmed = trimAfterDiscussion(html)
  const result = await extractFromHtml(trimmed, url)
  if (!result.ok && result.code === 'no_content' && trimmed.length < html.length) {
    return extractFromHtml(html, url)
  }
  return result
}

const extractFromHtml = async (
  html: string,
  url: string
): Promise<ContentExtractResult> => {
  try {
    const { document } = parseHTML(html)

    // Try structured recipe data first (JSON-LD before removing scripts, then
    // WPRM / microdata markup). This also skips the expensive JSDOM parse.
    const recipe = extractStructuredRecipe(document)
    if (recipe) {
      return {
        ok: true,
        title: recipe.name,
        content: formatStructuredRecipeAsContent(recipe),
        byline: null,
        recipe,
      }
    }

    // Try Defuddle extraction. The bulk of the comment thread is already gone
    // (trimAfterDiscussion), but removeDiscussionSections mops up any container
    // variant the string trim did not match before Defuddle scores the nodes.
    const dom = new JSDOM(html, { url })
    removeDiscussionSections(dom.window.document)
    const article = await Defuddle(dom, url, {
      markdown: true,
      removeImages: true,
    })

    // No recipe markup: look for a plain HTML ingredient list. The article
    // content is kept so the LLM fallback still sees the whole post.
    const listRecipe = extractHtmlListRecipe(document)

    if (article.content) {
      return {
        ok: true,
        title: article.title?.trim() || null,
        content: article.content,
        byline: article.author?.trim() || null,
        recipe: listRecipe,
      }
    }

    // Fallback: extract cleaned body text
    removeUnwantedElements(document)
    const bodyText = extractBodyText(document)
    if (bodyText && bodyText.trim().length > 0) {
      return {
        ok: true,
        title: extractTitle(document),
        content: bodyText.trim(),
        byline: null,
        recipe: null,
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
 * Comment/discussion containers that never hold recipe content but can dwarf
 * the article in node count. Kept to container-level selectors so we never
 * strip the recipe itself.
 */
const DISCUSSION_SELECTORS = [
  '#comments',
  '#respond',
  '.comments-area',
  '.comment-list',
  '.commentlist',
  '.comment-respond',
]

/**
 * Remove reader-comment / discussion sections before content extraction.
 * See the note in extractContent for why this matters for performance.
 */
const removeDiscussionSections = (document: Document): void => {
  for (const selector of DISCUSSION_SELECTORS) {
    try {
      document.querySelectorAll(selector).forEach((el) => el.remove())
    } catch {
      // Ignore selector errors from non-standard markup.
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
