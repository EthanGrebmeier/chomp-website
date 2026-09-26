import { parseIngredient, type UnitOfMeasureDefinitions } from 'parse-ingredient'

/**
 * Deterministic ingredient-line parser.
 *
 * Turns structured recipe lines ("2 cups shredded cheddar cheese, divided") into
 * `{ name, quantity, unit, notes }` without an LLM. Quantity/unit parsing is
 * delegated to `parse-ingredient` (fractions, unicode fractions, ranges, unit
 * aliases); this module layers on the shopping-list specific cleanup:
 *
 * - parentheticals, comma tails and trailing phrases ("to taste") become notes
 * - leading prep words ("finely chopped", "melted") become notes
 * - package sizes ("1 (14 oz) can", "2 14-ounce cans") become unit + notes
 * - "juice of 1 lemon" becomes lemon + notes "juice"
 *
 * Every line must pass a sanity check. If any line looks wrong, the whole
 * recipe is rejected so the caller can fall back to the LLM: the fast path
 * must never be worse than the slow one.
 */

export type ParsedIngredient = {
  name: string
  quantity: number | null
  unit: string | null
  notes: string | null
}

export type IngredientParseSuccess = {
  ok: true
  ingredients: ParsedIngredient[]
}

export type IngredientParseFailure = {
  ok: false
  reason: string
  /** The raw lines that failed validation (for debugging / evaluation). */
  failedLines: string[]
}

export type IngredientParseResult = IngredientParseSuccess | IngredientParseFailure

const ADDITIONAL_UOMS: UnitOfMeasureDefinitions = {
  slice: { short: 'slice', plural: 'slices', alternates: [], type: 'count' },
  stalk: { short: 'stalk', plural: 'stalks', alternates: [], type: 'count' },
  handful: { short: 'handful', plural: 'handfuls', alternates: [], type: 'count' },
  fillet: { short: 'fillet', plural: 'fillets', alternates: [], type: 'count' },
  jar: { short: 'jar', plural: 'jars', alternates: [], type: 'count' },
  bottle: { short: 'bottle', plural: 'bottles', alternates: [], type: 'count' },
  tin: { short: 'tin', plural: 'tins', alternates: [], type: 'count' },
}

const PARSE_OPTIONS = { normalizeUOM: true, additionalUOMs: ADDITIONAL_UOMS } as const

const SIZE_UNITS = new Set(['small', 'medium', 'large'])

/**
 * For packaged goods the prep word is part of the product you buy
 * ("diced tomatoes", "crushed pineapple", "shredded coconut"), so keep it.
 */
const CONTAINER_UNITS = new Set([
  'can',
  'tin',
  'jar',
  'package',
  'pack',
  'bag',
  'box',
  'bottle',
  'carton',
  'container',
])

/** Preparation words that describe what to do with an ingredient, not what to buy. */
const PREP_WORDS = [
  'chopped',
  'minced',
  'diced',
  'sliced',
  'shredded',
  'grated',
  'melted',
  'softened',
  'crushed',
  'peeled',
  'cubed',
  'julienned',
  'halved',
  'quartered',
  'sifted',
  'packed',
  'beaten',
  'whisked',
  'toasted',
  'rinsed',
  'drained',
  'trimmed',
  'thawed',
  'pitted',
  'seeded',
  'deseeded',
  'cored',
  'zested',
  'juiced',
  'torn',
  'mashed',
  'crumbled',
  'cooled',
  'chilled',
  'warmed',
  'freshly ground',
  'freshly grated',
  'freshly squeezed',
]

const PREP_ADVERBS = [
  'finely',
  'roughly',
  'coarsely',
  'thinly',
  'thickly',
  'lightly',
  'firmly',
  'loosely',
  'well',
  'very',
]

const PREP_PHRASE = `(?:(?:${PREP_ADVERBS.join('|')})\\s+)?(?:${PREP_WORDS.join('|')})`
const LEADING_PREP = new RegExp(
  `^(${PREP_PHRASE}(?:\\s*(?:,|and|or|&)\\s*${PREP_PHRASE})*)\\s+`,
  'i'
)

/** Phrases that trail an ingredient without a comma: "salt to taste". */
const TRAILING_NOTE = new RegExp(
  `\\s+(to taste|to serve|for (?:garnish|garnishing|serving|topping|drizzling|dusting|frying|the pan)|as needed|if needed|optional|divided|at room temperature|room temperature|plus .*)$`,
  'i'
)

/** Package size descriptors in front of a container: "14-ounce", "14 oz", "400g". */
const LEADING_PACKAGE_SIZE =
  /^(\d+(?:[.,]\d+)?\s*-?\s*(?:ounces?|oz|fl\.?\s*oz|grams?|g|ml|milliliters?|pounds?|lbs?|lb))\.?\s+/i

const JUICE_OR_ZEST_OF = /^((?:the\s+)?(?:juice|zest|zest and juice|juice and zest))\s+(?:of|from)\s+(?:an?\s+|\d+\s+)?(.+)$/i

const BULLET = /^[\s\-–—•*▢□☐✓✔·]+/

/** "2 cups minus 2 tablespoons flour", "1½ cups plus 1 Tbsp. flour" */
const COMPOUND_QUANTITY = /^(plus|minus|\+)\s+/i

/** Footnote references carry no shopping information: "Note 1", "see note". */
const USELESS_NOTE = /^(?:see\s+)?notes?(?:\s*\d+)?$/i

/**
 * Pull every parenthetical (including nested and WPRM's doubled "((minced))")
 * out into notes, innermost first, then drop any unbalanced leftovers.
 */
const extractParentheticals = (text: string, notes: string[]): string => {
  let result = text
  const found: string[] = []
  const innermost = /\(([^()]*)\)/
  let match = result.match(innermost)
  while (match && match.index !== undefined) {
    found.unshift(match[1])
    result = `${result.slice(0, match.index)} ${result.slice(match.index + match[0].length)}`
    match = result.match(innermost)
  }
  notes.push(...found.flatMap(splitNotes))
  return result.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
}

const splitNotes = (text: string): string[] =>
  text
    .split(/\s*[;,]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)

const joinNotes = (notes: string[]): string | null => {
  const cleaned = notes
    .map((n) => n.replace(/[()*]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((n) => n && !USELESS_NOTE.test(n))
    .filter((n, i, all) => all.findIndex((m) => m.toLowerCase() === n.toLowerCase()) === i)
  return cleaned.length > 0 ? cleaned.join(', ') : null
}

/**
 * If `text` begins with a unit of measure ("can diced tomatoes"), return the
 * unit id and the remaining text.
 */
const takeLeadingUnit = (text: string): { unit: string; rest: string } | null => {
  const [probe] = parseIngredient(`1 ${text}`, PARSE_OPTIONS)
  if (!probe?.unitOfMeasureID || !probe.description) return null
  return { unit: probe.unitOfMeasureID, rest: probe.description }
}

/**
 * Letters are required. Digits (and unicode fractions) are only allowed as part
 * of a percentage ("2% milk"); anything else means a second measurement leaked
 * into the name ("Diamond Crystal or ¾ tsp. Morton kosher salt").
 */
const looksLikeName = (name: string): boolean =>
  /\p{L}/u.test(name) &&
  !/\d(?!\s*%)/.test(name) &&
  !/[\u00BC-\u00BE\u2150-\u215E]/.test(name) &&
  name.length <= 60 &&
  name.split(/\s+/).length <= 8

type LineResult =
  | { kind: 'ingredient'; ingredient: ParsedIngredient }
  | { kind: 'header' }
  | { kind: 'invalid' }

export const parseIngredientLine = (rawLine: string): LineResult => {
  const line = rawLine.replace(BULLET, '').replace(/\s+/g, ' ').trim()
  if (!line) return { kind: 'header' }

  const [parsed] = parseIngredient(line, PARSE_OPTIONS)
  if (!parsed) return { kind: 'invalid' }
  if (parsed.isGroupHeader) return { kind: 'header' }

  // For a range ("2-3 cloves") shop for the upper bound.
  const quantity = parsed.quantity2 ?? parsed.quantity
  let unit = parsed.unitOfMeasureID
  let text = parsed.description.trim()
  const notes: string[] = []

  // Parentheticals anywhere are notes: "(14.5 oz) can", "ground beef (80/20)".
  text = extractParentheticals(text, notes).replace(/\*+/g, '').trim()

  // "2 cups minus 2 tablespoons flour": keep the primary quantity, note the adjustment.
  const compound = text.match(COMPOUND_QUANTITY)
  if (compound) {
    const [extra] = parseIngredient(text.slice(compound[0].length), PARSE_OPTIONS)
    if (extra && extra.quantity !== null && extra.unitOfMeasure) {
      const sign = compound[1].toLowerCase() === 'minus' ? 'minus' : 'plus'
      notes.push(`${sign} ${extra.quantity} ${extra.unitOfMeasure}`)
      text = extra.description.trim()
    }
  }

  // "2 14-ounce cans coconut milk" -> size is a note, "cans" is the unit.
  const packageSize = text.match(LEADING_PACKAGE_SIZE)
  if (packageSize) {
    notes.push(packageSize[1].replace(/\s+/g, ' '))
    text = text.slice(packageSize[0].length)
  }

  // "1 (14 oz) can diced tomatoes", "1 small head cauliflower": the real unit
  // follows the size/parenthetical. A size word becomes a note.
  if (!unit || SIZE_UNITS.has(unit)) {
    const leading = takeLeadingUnit(text)
    if (leading && !SIZE_UNITS.has(leading.unit)) {
      if (unit) notes.push(unit)
      unit = leading.unit
      text = leading.rest
    }
  }

  // Everything after the first comma is preparation / notes.
  const commaIndex = text.indexOf(',')
  if (commaIndex !== -1) {
    notes.push(...splitNotes(text.slice(commaIndex + 1)))
    text = text.slice(0, commaIndex).trim()
  }

  // Trailing phrases with no comma: "salt to taste", "parsley for garnish".
  let trailing = text.match(TRAILING_NOTE)
  while (trailing) {
    notes.unshift(trailing[1])
    text = text.slice(0, trailing.index).trim()
    trailing = text.match(TRAILING_NOTE)
  }

  // "juice of 1 lemon" -> lemon, notes "juice".
  const juice = text.match(JUICE_OR_ZEST_OF)
  if (juice) {
    notes.unshift(juice[1].replace(/^the\s+/i, '').toLowerCase())
    text = juice[2]
  }

  // Leading prep words: "finely chopped yellow onion" -> "yellow onion".
  const prep = text.match(LEADING_PREP)
  if (prep && prep[0].length < text.length && !(unit && CONTAINER_UNITS.has(unit))) {
    notes.unshift(prep[1])
    text = text.slice(prep[0].length)
  }

  // "2 cups of flour" -> "flour"
  const name = text.replace(/^of\s+/i, '').replace(/[\s.:;-]+$/, '').trim()

  if (!looksLikeName(name)) return { kind: 'invalid' }

  return {
    kind: 'ingredient',
    ingredient: {
      name,
      quantity,
      unit,
      notes: joinNotes(notes),
    },
  }
}

export const parseIngredientLines = (lines: readonly string[]): IngredientParseResult => {
  const ingredients: ParsedIngredient[] = []
  const failedLines: string[] = []

  for (const line of lines) {
    const result = parseIngredientLine(line)
    if (result.kind === 'ingredient') ingredients.push(result.ingredient)
    else if (result.kind === 'invalid') failedLines.push(line)
  }

  if (failedLines.length > 0) {
    return {
      ok: false,
      reason: `${failedLines.length} of ${lines.length} ingredient lines could not be parsed`,
      failedLines,
    }
  }

  if (ingredients.length === 0) {
    return { ok: false, reason: 'No ingredients found in structured data', failedLines: [] }
  }

  return { ok: true, ingredients }
}
