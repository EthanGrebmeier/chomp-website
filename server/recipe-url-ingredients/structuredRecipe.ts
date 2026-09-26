/**
 * Structured recipe data pulled straight out of the page markup, without any
 * content-extraction heuristics or AI.
 *
 * Most recipe pages publish their ingredient list in a machine-readable form:
 * - JSON-LD Schema.org `Recipe` (big publishers and every major WordPress recipe plugin)
 * - WP Recipe Maker (WPRM) card markup, which splits amount / unit / name / notes
 * - Schema.org microdata (`itemprop="recipeIngredient"`)
 *
 * When we find one, the ingredient lines can be parsed deterministically and the
 * LLM round-trip is skipped entirely (see ingredientParser.ts).
 */

export type StructuredRecipeSource = 'json-ld' | 'wprm' | 'microdata'

export type StructuredRecipe = {
  source: StructuredRecipeSource
  name: string | null
  servings: string | null
  /** One raw ingredient line per entry, e.g. "2 cups shredded cheddar, divided". */
  ingredientLines: string[]
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  frac12: '½',
  frac13: '⅓',
  frac14: '¼',
  frac34: '¾',
  frac23: '⅔',
  frac18: '⅛',
  deg: '°',
  eacute: 'é',
  egrave: 'è',
  ntilde: 'ñ',
}

/**
 * JSON-LD strings are frequently double-encoded by CMS plugins
 * ("1 &amp; 1/2 cups", "chile&#39;s", "<strong>salt</strong>").
 * Strip tags and decode the entities we actually see in the wild.
 */
export const cleanMarkupText = (value: string): string => {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (match, entity: string) => {
      if (entity[0] === '#') {
        const code =
          entity[1] === 'x' || entity[1] === 'X'
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10)
        return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? match
    })
    .replace(/\s+/g, ' ')
    .trim()
}

const cleanLines = (values: unknown[]): string[] =>
  values
    .filter((item): item is string => typeof item === 'string')
    .map(cleanMarkupText)
    .filter((s) => s.length > 0)

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

const isRecipeType = (type: unknown): boolean => {
  const matches = (t: unknown) =>
    typeof t === 'string' && (t === 'Recipe' || /(?:^|[/:])Recipe$/.test(t))
  return Array.isArray(type) ? type.some(matches) : matches(type)
}

const parseYield = (value: unknown): string | null => {
  if (typeof value === 'string') return cleanMarkupText(value) || null
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) {
    // Prefer a descriptive entry ("4 servings") over a bare number when both exist.
    const strings = value
      .map((v) => (typeof v === 'number' ? String(v) : v))
      .filter((v): v is string => typeof v === 'string')
    const descriptive = strings.find((s) => /\D/.test(s))
    const chosen = descriptive ?? strings[0]
    return chosen ? cleanMarkupText(chosen) || null : null
  }
  return null
}

const parseJsonLdRecipeObject = (obj: Record<string, unknown>): StructuredRecipe | null => {
  // `ingredients` is the deprecated schema.org name; some older sites still use it.
  const raw = obj['recipeIngredient'] ?? obj['ingredients']
  const list = typeof raw === 'string' ? raw.split(/\r?\n/) : raw
  if (!Array.isArray(list)) return null

  const ingredientLines = cleanLines(list)
  if (ingredientLines.length === 0) return null

  const name = typeof obj['name'] === 'string' ? cleanMarkupText(obj['name']) || null : null

  return {
    source: 'json-ld',
    name,
    servings: parseYield(obj['recipeYield']),
    ingredientLines,
  }
}

const MAX_JSON_LD_DEPTH = 6

/**
 * Search JSON-LD for a Recipe. Handles top-level objects, arrays, `@graph`, and
 * recipes nested under `mainEntity` / `mainEntityOfPage` (common on news sites).
 */
const findRecipeInJsonLd = (data: unknown, depth = 0): StructuredRecipe | null => {
  if (!data || typeof data !== 'object' || depth > MAX_JSON_LD_DEPTH) return null

  if (Array.isArray(data)) {
    for (const item of data) {
      const recipe = findRecipeInJsonLd(item, depth + 1)
      if (recipe) return recipe
    }
    return null
  }

  const obj = data as Record<string, unknown>
  if (isRecipeType(obj['@type'])) {
    const recipe = parseJsonLdRecipeObject(obj)
    if (recipe) return recipe
  }

  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage']) {
    const recipe = findRecipeInJsonLd(obj[key], depth + 1)
    if (recipe) return recipe
  }

  return null
}

export const extractJsonLdRecipe = (document: Document): StructuredRecipe | null => {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]')

  for (const script of scripts) {
    const content = script.textContent
    if (!content) continue

    try {
      const recipe = findRecipeInJsonLd(JSON.parse(content))
      if (recipe) return recipe
    } catch {
      // Invalid JSON, skip this script
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// HTML markup (WPRM + microdata)
// ---------------------------------------------------------------------------

const textOf = (el: Element | null | undefined): string =>
  el?.textContent ? cleanMarkupText(el.textContent) : ''

/**
 * WP Recipe Maker renders each ingredient as separate amount / unit / name /
 * notes spans. Rebuild a canonical "amount unit name, notes" line so the parser
 * sees the notes after a comma regardless of how the card is styled.
 */
export const extractWprmRecipe = (document: Document): StructuredRecipe | null => {
  const container = document.querySelector('.wprm-recipe-container, .wprm-recipe')
  if (!container) return null

  const items = container.querySelectorAll('li.wprm-recipe-ingredient')
  const ingredientLines: string[] = []

  for (const item of items) {
    const name = textOf(item.querySelector('.wprm-recipe-ingredient-name'))
    if (!name) {
      const fallback = textOf(item)
      if (fallback) ingredientLines.push(fallback)
      continue
    }
    const amount = textOf(item.querySelector('.wprm-recipe-ingredient-amount'))
    const unit = textOf(item.querySelector('.wprm-recipe-ingredient-unit'))
    const notes = textOf(item.querySelector('.wprm-recipe-ingredient-notes'))
      .replace(/^\((.*)\)$/, '$1')
      .trim()

    const head = [amount, unit, name].filter(Boolean).join(' ')
    ingredientLines.push(notes ? `${head}, ${notes}` : head)
  }

  if (ingredientLines.length === 0) return null

  return {
    source: 'wprm',
    name: textOf(container.querySelector('.wprm-recipe-name')) || null,
    servings: textOf(container.querySelector('.wprm-recipe-servings')) || null,
    ingredientLines,
  }
}

export const extractMicrodataRecipe = (document: Document): StructuredRecipe | null => {
  const scope =
    document.querySelector('[itemtype*="schema.org/Recipe"]') ?? document.documentElement
  if (!scope) return null

  const ingredientLines = Array.from(
    scope.querySelectorAll('[itemprop="recipeIngredient"], [itemprop="ingredients"]')
  )
    .map((el) => textOf(el))
    .filter((s) => s.length > 0)

  if (ingredientLines.length === 0) return null

  const nameEl = scope.querySelector('[itemprop="name"]')
  const yieldEl = scope.querySelector('[itemprop="recipeYield"]')

  return {
    source: 'microdata',
    name: textOf(nameEl) || null,
    servings: yieldEl?.getAttribute('content')?.trim() || textOf(yieldEl) || null,
    ingredientLines,
  }
}

/**
 * Try every structured source, best first. JSON-LD wins because it is the most
 * widely published and least affected by page styling.
 */
export const extractStructuredRecipe = (document: Document): StructuredRecipe | null =>
  extractJsonLdRecipe(document) ??
  extractWprmRecipe(document) ??
  extractMicrodataRecipe(document)

/**
 * Format structured recipe data as compact text for the LLM fallback path.
 */
export const formatStructuredRecipeAsContent = (recipe: StructuredRecipe): string => {
  const lines: string[] = []
  if (recipe.name) lines.push(`Recipe Name: ${recipe.name}`)
  if (recipe.servings) lines.push(`Servings: ${recipe.servings}`)
  lines.push('')
  lines.push('Ingredients:')
  for (const ingredient of recipe.ingredientLines) {
    lines.push(`- ${ingredient}`)
  }
  return lines.join('\n')
}
