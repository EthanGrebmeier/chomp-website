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
 * Schema.org Recipe data extracted from JSON-LD.
 */
type JsonLdRecipe = {
  name: string | null
  recipeYield: string | null
  recipeIngredient: string[]
}

/**
 * Extract Schema.org Recipe data from JSON-LD scripts in the document.
 * Handles both top-level Recipe objects and nested @graph arrays.
 *
 * @param document - The parsed HTML document
 * @returns Recipe data if found, null otherwise
 */
const extractJsonLdRecipe = (document: Document): JsonLdRecipe | null => {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]')

  for (const script of scripts) {
    const content = script.textContent
    if (!content) continue

    try {
      const data = JSON.parse(content)
      const recipe = findRecipeInJsonLd(data)
      if (recipe) return recipe
    } catch {
      // Invalid JSON, skip this script
      continue
    }
  }

  return null
}

/**
 * Recursively search for a Recipe object in JSON-LD data.
 * Handles @graph arrays and nested structures.
 */
const findRecipeInJsonLd = (data: unknown): JsonLdRecipe | null => {
  if (!data || typeof data !== 'object') return null

  // Handle arrays (including @graph)
  if (Array.isArray(data)) {
    for (const item of data) {
      const recipe = findRecipeInJsonLd(item)
      if (recipe) return recipe
    }
    return null
  }

  const obj = data as Record<string, unknown>

  // Check if this object is a Recipe
  const type = obj['@type']
  const isRecipe =
    type === 'Recipe' ||
    (Array.isArray(type) && type.includes('Recipe'))

  if (isRecipe) {
    return parseRecipeObject(obj)
  }

  // Check @graph array
  if (obj['@graph'] && Array.isArray(obj['@graph'])) {
    return findRecipeInJsonLd(obj['@graph'])
  }

  return null
}

/**
 * Parse a Recipe object and extract relevant fields.
 */
const parseRecipeObject = (obj: Record<string, unknown>): JsonLdRecipe | null => {
  // Extract recipeIngredient - required for a valid recipe
  const ingredients = obj['recipeIngredient']
  if (!ingredients || !Array.isArray(ingredients)) {
    return null
  }

  // Filter and normalize ingredients to strings
  const recipeIngredient = ingredients
    .filter((item): item is string => typeof item === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (recipeIngredient.length === 0) {
    return null
  }

  // Extract name
  const name = typeof obj['name'] === 'string' ? obj['name'].trim() : null

  // Extract recipeYield (can be string or array)
  let recipeYield: string | null = null
  const yieldValue = obj['recipeYield']
  if (typeof yieldValue === 'string') {
    recipeYield = yieldValue.trim()
  } else if (Array.isArray(yieldValue) && yieldValue.length > 0) {
    // Take the first yield value
    const first = yieldValue[0]
    if (typeof first === 'string') {
      recipeYield = first.trim()
    }
  }

  return { name, recipeYield, recipeIngredient }
}

/**
 * Format JSON-LD recipe data as structured text for AI extraction.
 */
const formatJsonLdRecipeAsContent = (recipe: JsonLdRecipe): string => {
  const lines: string[] = []

  if (recipe.name) {
    lines.push(`Recipe Name: ${recipe.name}`)
  }

  if (recipe.recipeYield) {
    lines.push(`Servings: ${recipe.recipeYield}`)
  }

  lines.push('')
  lines.push('Ingredients:')

  for (const ingredient of recipe.recipeIngredient) {
    lines.push(`- ${ingredient}`)
  }

  return lines.join('\n')
}

/**
 * Extract main content from HTML, prioritizing JSON-LD Recipe data.
 *
 * First attempts to extract structured Recipe data from JSON-LD scripts.
 * Falls back to Mozilla Readability for general content extraction.
 */
export const extractContent = (html: string, url: string): ContentExtractResult => {
  try {
    const { document } = parseHTML(html)

    // Try JSON-LD Recipe extraction first (before removing scripts!)
    const jsonLdRecipe = extractJsonLdRecipe(document)
    if (jsonLdRecipe) {
      const content = formatJsonLdRecipeAsContent(jsonLdRecipe)
      return {
        ok: true,
        title: jsonLdRecipe.name,
        content,
        byline: null,
      }
    }

    // Remove unwanted elements before Readability extraction
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
