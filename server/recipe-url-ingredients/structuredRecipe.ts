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

export type StructuredRecipeSource = 'json-ld' | 'wprm' | 'microdata' | 'html-list'

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

/**
 * JSON.parse, retrying once with raw control characters (literal newlines/tabs
 * inside strings, which some CMSes emit) replaced by spaces. Returns null if
 * the JSON is still invalid.
 */
const parseLenientJson = (content: string): unknown => {
  try {
    return JSON.parse(content)
  } catch {
    try {
      // eslint-disable-next-line no-control-regex
      return JSON.parse(content.replace(/[\u0000-\u001F]+/g, ' '))
    } catch {
      return null
    }
  }
}

export const extractJsonLdRecipe = (document: Document): StructuredRecipe | null => {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]')

  for (const script of scripts) {
    const content = script.textContent
    if (!content) continue

    const recipe = findRecipeInJsonLd(parseLenientJson(content))
    if (recipe) return recipe
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

// ---------------------------------------------------------------------------
// Plain HTML ingredient lists (no recipe markup at all)
// ---------------------------------------------------------------------------

/** A line that opens with an amount: "2 cups", "½ tsp", "One 8-ounce can". */
const STARTS_WITH_AMOUNT =
  /^(?:[\d½¼¾⅓⅔⅛]|(?:one|two|three|four|five|six|seven|eight|nine|ten|twelve|half)\s)/i

/** "2 cups", "1 (14 oz) can", "3 large": an amount followed by a unit or size. */
const AMOUNT_WITH_UNIT =
  /^[\d½¼¾⅓⅔⅛][\d\s/½¼¾⅓⅔⅛.,-]*(?:\([^)]*\)\s*)?(?:cups?|tablespoons?|tbsps?\.?|teaspoons?|tsps?\.?|ounces?|oz\.?|pounds?|lbs?\.?|grams?|g|kg|ml|liters?|litres?|cloves?|cans?|large|medium|small|pinch|sticks?|slices?|bunch(?:es)?|heads?|sprigs?|quarts?|pints?)\b/i

/** "Two years ago: <link>" (Smitten Kitchen's "Previously" block). */
const TIME_AGO = /^\S+\s+(?:years?|months?|weeks?)\s+ago\b/i

const MIN_BLOCK_LINES = 3
const MAX_BLOCK_LINES = 40
const MAX_LINE_LENGTH = 200
/** Share of a block's lines that must start with an amount. */
const MIN_AMOUNT_RATIO = 0.6
/** Across all blocks, a recipe needs at least this many "amount + unit" lines. */
const MIN_RECIPE_UNIT_LINES = 3

const NON_CONTENT_SELECTOR =
  'nav, header, footer, aside, form, script, style, noscript, .sidebar, .widget, .comments, #comments, .related, .jp-relatedposts, .sharedaddy'

/**
 * Split a <p> into lines at <br>. A line that is nothing but emphasized text
 * ("<b>Frosting</b>", "<u>Stew</u>") is a sub-recipe title, not an ingredient.
 */
const paragraphLines = (el: Element): string[] =>
  el.innerHTML
    .split(/<br\s*\/?>/i)
    .filter((segment) => {
      const unemphasized = segment.replace(/<(b|strong|u|em|i)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      return cleanMarkupText(unemphasized) !== '' || cleanMarkupText(segment) === ''
    })
    .map(cleanMarkupText)
    .filter(Boolean)

const listLines = (el: Element): string[] =>
  Array.from(el.children)
    .filter((child) => child.tagName === 'LI' && !child.querySelector('ul, ol'))
    .map((li) => textOf(li))
    .filter(Boolean)

const hasAmount = (line: string): boolean => STARTS_WITH_AMOUNT.test(line) && !TIME_AGO.test(line)

const isIngredientBlock = (lines: string[]): boolean => {
  if (lines.length < MIN_BLOCK_LINES || lines.length > MAX_BLOCK_LINES) return false
  if (lines.some((line) => line.length > MAX_LINE_LENGTH)) return false
  const withAmount = lines.filter(hasAmount).length
  return withAmount / lines.length >= MIN_AMOUNT_RATIO
}

/** A full sentence with no leading amount. */
const isProse = (line: string): boolean =>
  !hasAmount(line) && /[.!?]$/.test(line) && line.split(/\s+/).length >= 8

const YIELD_PATTERN = /^(?:yield|yields|serves|servings|makes)\s*:?\s*(.{1,60})$/i

/**
 * Older blog posts (pre-2015 Smitten Kitchen and many others) have no recipe
 * markup: the ingredients are a <br>-separated paragraph or a bare list. Find
 * blocks where most lines start with an amount. Deliberately strict; the
 * caller still validates every line with the parser and falls back to the
 * LLM (with the full article) if any line looks wrong.
 */
export const extractHtmlListRecipe = (document: Document): StructuredRecipe | null => {
  const body = document.body
  if (!body) return null
  const junk = new Set(Array.from(body.querySelectorAll(NON_CONTENT_SELECTOR)))
  const insideJunk = (el: Element): boolean => {
    for (let node: Element | null = el; node; node = node.parentElement) {
      if (junk.has(node)) return true
    }
    return false
  }

  const ingredientLines: string[] = []
  let servings: string | null = null

  for (const el of Array.from(body.querySelectorAll('p, ul, ol'))) {
    if (insideJunk(el)) continue
    const lines = el.tagName === 'P' ? paragraphLines(el) : listLines(el)
    if (!servings && el.tagName === 'P' && lines.length === 1) {
      servings = lines[0].match(YIELD_PATTERN)?.[1]?.trim() ?? null
    }
    // Prose inside the block ("Optional: If you love cilantro, add some.") is advice, not an ingredient.
    if (isIngredientBlock(lines)) ingredientLines.push(...lines.filter((line) => !isProse(line)))
  }

  // Listicles ("40+ Pie Recipes") start lines with numbers too; real
  // ingredient lists have units.
  const withUnit = ingredientLines.filter((line) => AMOUNT_WITH_UNIT.test(line)).length
  if (withUnit < MIN_RECIPE_UNIT_LINES) return null

  const title =
    document.querySelector('meta[property="og:title"]')?.getAttribute('content') ??
    textOf(document.querySelector('h1')) ??
    null

  return {
    source: 'html-list',
    name: title ? cleanMarkupText(title) || null : null,
    servings,
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
