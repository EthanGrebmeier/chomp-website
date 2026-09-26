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
  handful: { short: 'handful', plural: 'handfuls', alternates: ['fistful', 'fistfuls'], type: 'count' },
  rasher: { short: 'rasher', plural: 'rashers', alternates: [], type: 'count' },
  knob: { short: 'knob', plural: 'knobs', alternates: [], type: 'count' },
  drizzle: { short: 'drizzle', plural: 'drizzles', alternates: [], type: 'count' },
  splash: { short: 'splash', plural: 'splashes', alternates: [], type: 'count' },
  fillet: { short: 'fillet', plural: 'fillets', alternates: [], type: 'count' },
  jar: { short: 'jar', plural: 'jars', alternates: [], type: 'count' },
  bottle: { short: 'bottle', plural: 'bottles', alternates: [], type: 'count' },
  tin: { short: 'tin', plural: 'tins', alternates: [], type: 'count' },
  sheet: { short: 'sheet', plural: 'sheets', alternates: [], type: 'count' },
  stem: { short: 'stem', plural: 'stems', alternates: [], type: 'count' },
  recipe: { short: 'recipe', plural: 'recipes', alternates: ['batch'], type: 'count' },
  strip: { short: 'strip', plural: 'strips', alternates: [], type: 'count' },
  log: { short: 'log', plural: 'logs', alternates: [], type: 'count' },
  tub: { short: 'tub', plural: 'tubs', alternates: [], type: 'count' },
  packet: { short: 'packet', plural: 'packets', alternates: [], type: 'count' },
  envelope: { short: 'envelope', plural: 'envelopes', alternates: [], type: 'count' },
  pouch: { short: 'pouch', plural: 'pouches', alternates: [], type: 'count' },
  sachet: { short: 'sachet', plural: 'sachets', alternates: [], type: 'count' },
  loaf: { short: 'loaf', plural: 'loaves', alternates: [], type: 'count' },
  block: { short: 'block', plural: 'blocks', alternates: [], type: 'count' },
  // British spellings (BBC, RecipeTin Eats) on top of parse-ingredient's defaults.
  liter: {
    short: 'l',
    plural: 'liters',
    alternates: ['l.', 'litre', 'litres', 'ltr'],
    type: 'volume',
    conversionFactor: 1000,
  },
  milliliter: {
    short: 'ml',
    plural: 'milliliters',
    alternates: ['mL', 'ml.', 'mL.', 'millilitre', 'millilitres'],
    type: 'volume',
    conversionFactor: 1,
  },
}

const PARSE_OPTIONS = { normalizeUOM: true, additionalUOMs: ADDITIONAL_UOMS } as const

const SIZE_UNITS = new Set(['small', 'medium', 'large'])

/** Mass and volume units that can describe a package size ("400g can"). */
const MEASURE_UNITS = new Set([
  'gram',
  'kilogram',
  'ounce',
  'pound',
  'milliliter',
  'liter',
  'fluid ounce',
])

/** "1 1/2 inch cubes" describes a cut, not an amount. */
const LENGTH_UNITS = new Set(['inch', 'centimeter', 'millimeter', 'foot', 'meter', 'yard'])

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
  'tub',
  'packet',
  'envelope',
  'pouch',
  'sachet',
  'block',
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
  'slivered',
  'pureed',
  'puréed',
  'riced',
  'shaved',
  'smashed',
  'snipped',
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

const PREP_PHRASE = `(?:(?:${PREP_ADVERBS.join('|')}|rough|fine)[\\s-]+)?(?:${PREP_WORDS.join('|')})`
const LEADING_PREP = new RegExp(
  `^(${PREP_PHRASE}(?:(?:\\s*(?:,|and|or|&)\\s*|\\s+)${PREP_PHRASE})*)\\s+`,
  'i'
)

/** Phrases that trail an ingredient without a comma: "salt to taste". */
const TRAILING_NOTE = new RegExp(
  `\\s+(to taste|to serve|to finish|if (?:you )?(?:like|prefer|wish|desired|needed|using|available)\\b.*|for (?:garnish|serving|the pan|the top|work surface|[a-z]+ing)\\b.*|cut (?:into|in) .*|as needed|if needed|as desired|optional|divided|at room temperature|room temperature|plus .*)$`,
  'i'
)

/** A number as written in recipes: "2", "1.5", "1/2", "1 1/2", "2½", "½". */
const NUM = String.raw`(?:\d+\/\d+|\d+(?:[.,]\d+)?(?:\s*[½¼¾⅓⅔⅛]|\s+\d+\/\d+)?|[½¼¾⅓⅔⅛])`

/** Units that appear in size descriptors and slash-separated alternate measurements. */
const MEASURE_UNIT = String.raw`(?:(?:fl\.?\s*oz|ounces?|oz|grams?|g|kg|kilograms?|mg|ml|milliliters?|millilitres?|l|liters?|litres?|pounds?|lbs?|cups?|tablespoons?|tbsps?|teaspoons?|tsps?|pints?|pt|quarts?|qt|inch(?:es)?|in|cm|mm|sticks?)\b|["”″])`

/**
 * Size descriptors in front of the real unit or name: "14-ounce", "14 oz",
 * "400g", "5- to 5 1/2-ounce", "6-inch", '3"', '3x2"'.
 */
const LEADING_PACKAGE_SIZE = new RegExp(
  String.raw`^(${NUM}\s*-?\s*(?:to\s*-?\s*${NUM}\s*-?\s*)?(?:x\s*${NUM}\s*)?${MEASURE_UNIT})\.?(?:\s+|$)`,
  'i'
)

/**
 * The part of a fruit/vegetable you use: "juice of 1 lemon", "grated zest of
 * 1/2 orange", "seeds scraped from 1/2 vanilla bean", "kernels cut from 2 ears
 * of corn". The thing to buy is what follows "of"/"from".
 */
const JUICE_OR_ZEST_OF =
  /^((?:the\s+)?(?:[a-z]+\s+)?(?:juice|zest|seeds|kernels)(?:\s*(?:and|&)\s*(?:juice|zest))?(?:\s+(?:cut|scraped|squeezed|removed|stripped))?)\s+(?:of|from)\s+(.+)$/i

/** "half an 8-ounce package", "one quarter of a lemon", "1/2 of 1 large cucumber" */
const WORD_FRACTION = /^(?:(?:one|a)\s+)?(half|quarter|third)\s+(?:of\s+)?(?:an?\s+|one\s+|1\s+)?(?=\S)/i
const FRACTION_OF_ONE = new RegExp(String.raw`^(${NUM})\s+of\s+(?:an?|one|1)\s+(?=\S)`, 'i')
const WORD_FRACTION_VALUES: Record<string, string> = { half: '1/2', quarter: '1/4', third: '1/3' }

const WORD_NUMBERS: Record<string, string> = {
  a: '1',
  an: '1',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
}
const LEADING_WORD_NUMBER = new RegExp(`^(${Object.keys(WORD_NUMBERS).join('|')})\\s+(?=\\S)`, 'i')

/** Approximation words in front of the amount: "About 2 cups", "Scant ¼ tsp", "~1/2 tsp". */
const LEADING_QUALIFIER =
  /^(about|approximately|approx\.?|around|roughly|scant|heaping|heaped|generous|rounded|level|just|barely|slightly|a heaping|a scant|a generous|a good|a lot of|lots of|a ton of|a little bit of|a bit of|a little|or|~)\s+(?=\S)|^(~)(?=\S)/i

/** "optional: 1/4 cup flaxseed", "toppings: parmesan and basil" */
const LEADING_LABEL = /^([a-z][a-z -]{0,30}):\s*(?=\S)/i

/** "1 and 1/2 cups" -> "1 1/2 cups" (Sally's Baking Addiction) */
const AND_FRACTION = /^(\d+)\s+and\s+(?=\d+\/\d+|[½¼¾⅓⅔⅛])/i

/** "½ packed cup", "2 thin slices": the adjective is a note so the unit is found. */
const QUALIFIED_UNIT = new RegExp(
  String.raw`^(${NUM})\s+(packed|heaping|heaped|scant|level|generous|loosely packed|firmly packed|thin|thick|big|good)\s+(cups?|tablespoons?|tbsps?|teaspoons?|tsps?|slices?|cloves?|sprigs?|bunch(?:es)?|handfuls?|pinch(?:es)?|heads?|knobs?|pieces?)\b`,
  'i'
)

/**
 * Dual units written with a slash: "225g/8oz plain flour", "½ cup/120
 * milliliters oil", "90g / 6 tbsp butter", "1 large egg/50 grams". Keep the
 * first measurement and turn the alternate into a parenthetical. The slash
 * must follow a letter or space so fractions ("1/2 cup") never match.
 */
const ALT_MEASURE = String.raw`${NUM}(?:\s*[-–]\s*${NUM})?\s*${MEASURE_UNIT}\.?`
const DUAL_UNIT = new RegExp(
  String.raw`^(${NUM}[^/()]{0,40}?)(?<=[\p{L}.\s])((?:\s*\/\s*${ALT_MEASURE})+)`,
  'iu'
)

/** "250-gram or 8.8-ounce package", "4 tablespoons or 1/4 cup butter" */
const SIZE_OR_SIZE = new RegExp(
  String.raw`(${NUM}\s*-?\s*${MEASURE_UNIT}\.?)\s+or\s+(${NUM}\s*-?\s*${MEASURE_UNIT}\.?)(?=\s)`,
  'i'
)

/** "1/4 + 1/8 teaspoon" */
const SUMMED_QUANTITY = new RegExp(String.raw`^(${NUM})\s*\+\s*(${NUM})\s+(?=\p{L})`, 'u')

/** "2 x 400g tins" (Jamie Oliver): the count times a package size. */
const TIMES_PACKAGE = new RegExp(String.raw`^(${NUM})(?:\s*[x×]\s*(?=\d)|\s+[x×]\s+)`, 'i')

/** Equipment listed with the ingredients. */
const EQUIPMENT_LABEL = /^(?:special\s+)?equipment\s*:/i

/** " - " used as a comma: "1 sweet potato - cut into steaks" (RecipeTin Eats). */
const DASH_SEPARATOR = /\s+[-–—]\s+/g

/** "1 large or 2 medium eggplants": the text after the unit starts with an alternative amount. */
const LEADING_ALTERNATIVE = /^or\s+(?=[\d½¼¾⅓⅔⅛]|half\b|a\s+quarter\b)/i

/** "cubes of bread", "strips of lemon zest": the shape is a note. */
const CUT_SHAPE_OF = /^(cubes?|chunks?|pieces?|strips?|wedges?|rounds?|lengths?)\s+of\s+(?=\S)/i

/** "or thinly ribboned", "and rough-chopped": a second prep word after the first. */
const ALTERNATE_PREP = /^(?:or|and)\s+(?:\w+ly[\s-]+|rough-|fine-)?[\w-]+ed\s+(?=\S)/i

/** Two ingredients joined with "+": "1 large egg + 1 egg yolk". */
const PLUS_SEPARATOR = /\s+\+\s+(?=[\d½¼¾⅓⅔⅛])/

const BULLET = /^[\s\-–—•*▢□☐✓✔·]+/

/** "2 cups minus 2 tablespoons flour", "1½ cups plus 1 Tbsp. flour" */
const COMPOUND_QUANTITY = /^(plus|minus|\+)\s+/i

/** "melted butter or 1/4 cup vegetable oil": an alternative with its own amount. */
const ALTERNATIVE_WITH_AMOUNT = /\s+or\s+(?=[\d½¼¾⅓⅔⅛])(?![\d.]+\s*%)/i

/**
 * Notes with no shopping information: footnote references ("Note 1", "see
 * note") and per-ingredient prices ("$0.20", Budget Bytes).
 */
const USELESS_NOTE = /^(?:(?:see\s+)?notes?(?:\s*\d+)?|\$\s?\d+(?:\.\d+)?)$/i

/**
 * Descriptors that can precede a comma without being the ingredient itself:
 * "boneless, skinless chicken breasts" must not become "boneless".
 */
const COMMA_DESCRIPTORS = new Set([
  'boneless',
  'skinless',
  'bone-in',
  'skin-on',
  'seedless',
  'unsalted',
  'salted',
  'ripe',
  'fresh',
  'raw',
  'cooked',
  'uncooked',
  'organic',
  'large',
  'small',
  'medium',
  'thick',
  'thin',
  'hot',
  'cold',
  'warm',
  'lean',
  'extra-lean',
])

const isOnlyDescriptors = (text: string): boolean => {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  return words.length > 0 && words.every((w) => COMMA_DESCRIPTORS.has(w))
}

/** Prep word stuck on the end without a comma: "green onions sliced". */
const TRAILING_PREP = new RegExp(
  `\\s+(${PREP_PHRASE}(?:(?:\\s*(?:,|and|or|&)\\s*|\\s+)${PREP_PHRASE})*)$`,
  'i'
)

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
  // An unclosed "(" (often a line cut off mid-note: "5 egg whites (I used 6")
  // turns everything after it into a note.
  const unclosed = result.indexOf('(')
  if (unclosed !== -1) {
    found.push(result.slice(unclosed + 1))
    result = result.slice(0, unclosed)
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
 * Numbers that legitimately belong to a product name: "2% milk", "2 percent
 * milk", "80/20 ground beef", "00 flour", "100 calorie buns".
 */
const NAME_NUMBER_TOKENS =
  /\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:%|percent\b)|\b\d{2,}\/\d{2,}\b|\b0+\b|\b\d+[- ]?calories?\b/gi

/**
 * Letters are required. Digits (and unicode fractions) are only allowed as part
 * of a product name (see NAME_NUMBER_TOKENS); anything else means a second
 * measurement leaked into the name ("Diamond Crystal or ¾ tsp. Morton kosher salt").
 */
const looksLikeName = (name: string): boolean =>
  /\p{L}/u.test(name) &&
  // Leftovers of a split that went wrong: "or pureed bananas", "large".
  !/^(?:or|and|plus|of|with)\b/i.test(name) &&
  !SIZE_UNITS.has(name.toLowerCase()) &&
  !/\d/.test(name.replace(NAME_NUMBER_TOKENS, ' ')) &&
  !/[\u00BC-\u00BE\u2150-\u215E]/.test(name) &&
  name.length <= 60 &&
  name.split(/\s+/).length <= 8

/** Position of the first match of `pattern` that is not inside parentheses. */
const searchOutsideParens = (text: string, pattern: RegExp): number => {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const before = text.slice(0, match.index)
    const depth = (before.match(/\(/g)?.length ?? 0) - (before.match(/\)/g)?.length ?? 0)
    if (depth <= 0) return match.index
    if (match[0].length === 0) re.lastIndex++
  }
  return -1
}

/** Split `text` on every match of `pattern` that is not inside parentheses. */
const splitOutsideParens = (text: string, pattern: RegExp): string[] => {
  const parts: string[] = []
  let rest = text
  let index = searchOutsideParens(rest, pattern)
  while (index !== -1) {
    const match = rest.slice(index).match(pattern)
    if (!match || match[0].length === 0) break
    parts.push(rest.slice(0, index))
    rest = rest.slice(index + match[0].length)
    index = searchOutsideParens(rest, pattern)
  }
  parts.push(rest)
  return parts.map((p) => p.trim()).filter(Boolean)
}

/**
 * Rewrite the common ways sites deviate from "amount unit name, notes" before
 * handing the line to parse-ingredient. Qualifiers and labels that carry
 * meaning become notes.
 */
const normalizeLine = (rawLine: string, notes: string[]): string => {
  let line = rawLine
    .replace(BULLET, '')
    // Square brackets are parentheticals too (and sites mismatch them: "[1 lb each)").
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    // U+2044 fraction slash ("1⁄2") is a plain fraction.
    .replace(/(\d)\u2044(\d)/g, '$1/$2')
    .replace(/\s+/g, ' ')
    .trim()

  // Leading prefixes, in any order: "(optional) 2 tsp", "optional: about 1/4 cup".
  for (let i = 0; i < 3; i++) {
    const paren = line.match(/^\(([^()]*)\)\s*(?=\S)/)
    if (paren) {
      notes.push(...splitNotes(paren[1]))
      line = line.slice(paren[0].length)
      continue
    }
    const label = line.match(LEADING_LABEL)
    if (label) {
      notes.push(label[1].trim().toLowerCase())
      line = line.slice(label[0].length)
      continue
    }
    const qualifier = line.match(LEADING_QUALIFIER)
    if (qualifier) {
      const word = (qualifier[1] ?? qualifier[2]).toLowerCase()
      notes.push(word === '~' ? 'about' : /^(a lot|lots|a ton) of$/.test(word) ? 'generous' : /^a (little|bit)/.test(word) ? 'a little' : word)
      line = line.slice(qualifier[0].length)
      continue
    }
    break
  }

  // "half an 8-ounce package", "1/2 of 1 large cucumber"
  line = line
    .replace(WORD_FRACTION, (_m, word: string) => `${WORD_FRACTION_VALUES[word.toLowerCase()]} `)
    .replace(FRACTION_OF_ONE, '$1 ')
    .replace(TIMES_PACKAGE, '$1 ')
    // "A 250-gram package"
    .replace(/^an?\s+(?=\d)/i, '1 ')

  // "1/4 + 1/8 teaspoon" -> 0.375 teaspoon
  const summed = line.match(SUMMED_QUANTITY)
  if (summed) {
    const [a] = parseIngredient(`${summed[1]} x`)
    const [b] = parseIngredient(`${summed[2]} x`)
    if (a?.quantity != null && b?.quantity != null) {
      line = `${Number((a.quantity + b.quantity).toFixed(3))} ${line.slice(summed[0].length)}`
    }
  }

  // "a few tablespoons of chili crisp" -> note "a few tablespoons"
  const vague = line.match(/^(a few|a couple(?: of)?|several)\s+(?=\S)/i)
  if (vague) {
    const rest = line.slice(vague[0].length)
    const leading = takeLeadingUnit(rest)
    if (!leading) {
      notes.push(vague[1].toLowerCase())
      line = rest
    } else if (rest.endsWith(leading.rest)) {
      const amount = rest.slice(0, rest.length - leading.rest.length).replace(/\s+of\s*$/i, '')
      notes.push(`${vague[1]} ${amount.trim()}`.toLowerCase())
      line = leading.rest.replace(/^of\s+/i, '')
    }
  }

  // "One 8-ounce package" -> "1 8-ounce package". "a"/"an" only before a unit
  // ("a pinch of salt"), never "a few sprigs".
  const word = line.match(LEADING_WORD_NUMBER)
  if (word) {
    const rest = line.slice(word[0].length)
    const isArticle = /^an?$/i.test(word[1])
    const probe = rest.replace(/^(?:big|good|generous|small)\s+/i, '')
    if (!isArticle || takeLeadingUnit(probe)) {
      line = `${WORD_NUMBERS[word[1].toLowerCase()]} ${rest}`
    }
  }

  line = line.replace(new RegExp(String.raw`^(${NUM})\s+or so\s+`, 'i'), (_m, n: string) => {
    notes.push('about')
    return `${n} `
  })

  return line
    .replace(AND_FRACTION, '$1 ')
    // "1+ tablespoons", "15- ounce can"
    .replace(new RegExp(String.raw`^(${NUM})\+\s*`), '$1 ')

    .replace(QUALIFIED_UNIT, (_m, n: string, adjective: string, u: string) => {
      notes.push(adjective.toLowerCase())
      return `${n} ${u}`
    })
    // "15-ounce can pumpkin" / "15- ounce can": a package size with an implied count of 1.
    .replace(new RegExp(String.raw`^(${NUM}(?:\s*-?\s*to\s*-?\s*${NUM})?-)\s*(?=${MEASURE_UNIT})`, 'i'), '1 $1')
    .replace(DUAL_UNIT, (_m, first: string, alternates: string) => {
      const alts = alternates.split('/').map((a) => a.trim()).filter(Boolean)
      return `${first.trim()} (${alts.join(', ')})`
    })
    .replace(SIZE_OR_SIZE, '$1 ($2)')
    .replace(DASH_SEPARATOR, (sep, offset: number, whole: string) =>
      // "2 - 3 cloves" is a range, not a separator.
      /\d$/.test(whole.slice(0, offset)) && /^\d/.test(whole.slice(offset + sep.length)) ? sep : ', '
    )
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Last-resort cleanup for a name that failed validation. Each rescue only
 * drops trailing detail into notes, so the result is still the ingredient the
 * line starts with.
 */
const rescueName = (name: string, notes: string[]): string | null => {
  // "yellow or orange bell peppers or other sweet pepper": prefer the longest
  // valid head, so try the last " or " first.
  const ors = [...name.matchAll(/\s+or\s+/gi)].map((m) => m.index ?? -1).reverse()
  for (const index of ors) {
    const head = name.slice(0, index).trim()
    if (looksLikeName(head)) {
      notes.push(name.slice(index).trim())
      return head
    }
  }

  // "aubergine sliced lengthways into ½cm slices", "tortilla with 110 calories or less"
  const tail = name.search(new RegExp(String.raw`\s+(?:${PREP_PHRASE}|with|such as|like|tossed|dissolved|mixed|for)\b`, 'i'))
  if (tail > 0) {
    const head = name.slice(0, tail).trim()
    if (looksLikeName(head)) {
      notes.push(name.slice(tail).trim())
      return head
    }
  }

  return null
}

type LineResult =
  | { kind: 'ingredient'; ingredient: ParsedIngredient }
  | { kind: 'header' }
  | { kind: 'invalid' }

export const parseIngredientLine = (rawLine: string): LineResult => {
  if (EQUIPMENT_LABEL.test(rawLine.replace(BULLET, ''))) return { kind: 'header' }
  // "STEAMED ASPARAGUS & QUICK TOMATO SAUCE": an all-caps sub-recipe title.
  if (/^[^\p{Ll}\d]*\p{Lu}[^\p{Ll}\d]*\s[^\p{Ll}\d]*\p{Lu}[^\p{Ll}\d]*$/u.test(rawLine.trim())) {
    return { kind: 'header' }
  }
  const notes: string[] = []
  const line = normalizeLine(rawLine, notes)
  if (!line) return { kind: 'header' }

  const [parsed] = parseIngredient(line, PARSE_OPTIONS)
  if (!parsed) return { kind: 'invalid' }
  if (parsed.isGroupHeader) return { kind: 'header' }

  // For a range ("2-3 cloves") shop for the upper bound.
  let quantity = parsed.quantity2 ?? parsed.quantity
  let unit = parsed.unitOfMeasureID
  let text = parsed.description.trim()

  // "5cm piece ginger": the length is the size of one piece.
  if (unit && LENGTH_UNITS.has(unit) && quantity !== null) {
    const afterParens = text.replace(/^(?:\([^()]*\)\s*)+/, '')
    const piece = takeLeadingUnit(afterParens)
    if (piece && !LENGTH_UNITS.has(piece.unit) && !SIZE_UNITS.has(piece.unit)) {
      notes.push(`${quantity} ${parsed.unitOfMeasure ?? unit}`)
      quantity = 1
      unit = piece.unit
      text = `${text.slice(0, text.length - afterParens.length)} ${piece.rest}`.trim()
    }
  }

  // "400g can black beans", "16 oz can": the measure is the package size.
  if (unit && MEASURE_UNITS.has(unit) && quantity !== null) {
    const container = takeLeadingUnit(text)
    if (container && CONTAINER_UNITS.has(container.unit)) {
      notes.push(`${quantity} ${parsed.unitOfMeasure ?? unit}`)
      quantity = 1
      unit = container.unit
      text = container.rest
    }
  }

  // "1 large or 2 medium eggplants": the alternative amount is a note.
  const leadingParens = text.match(/^(?:\([^()]*\)\s*)+(?=or\s)/)
  const leadingAlternative = text.slice(leadingParens?.[0].length ?? 0).match(LEADING_ALTERNATIVE)
  if (leadingAlternative) {
    if (leadingParens) {
      extractParentheticals(leadingParens[0], notes)
      text = text.slice(leadingParens[0].length)
    }
    const rest = text
      .slice(leadingAlternative[0].length)
      .replace(WORD_FRACTION, (_m, word: string) => `${WORD_FRACTION_VALUES[word.toLowerCase()]} `)
    const [alt] = parseIngredient(rest, PARSE_OPTIONS)
    if (alt && alt.quantity !== null && alt.description && rest.endsWith(alt.description)) {
      notes.push(`or ${rest.slice(0, rest.length - alt.description.length).trim()}`)
      text = alt.description.trim()
    }
  }

  // An alternative that carries its own amount ("butter or 1/4 cup (50g) oil")
  // is a note, not part of the name. Split before parentheticals so the
  // alternative keeps its own sizes, but never inside one ("(55 g or 2 oz)").
  let alternativeNote: string | null = null
  const alternative = searchOutsideParens(text, ALTERNATIVE_WITH_AMOUNT)
  if (alternative !== -1) {
    alternativeNote = text.slice(alternative).trim()
    text = text.slice(0, alternative).trim()
  }

  // Parentheticals anywhere are notes: "(14.5 oz) can", "ground beef (80/20)".
  const notesBeforeParens = notes.length
  text = extractParentheticals(text, notes).replace(/\*+/g, '').trim()

  // "1 can (15 oz chicken broth)", "For serving: (naan or rice)": the only
  // name is inside the parentheses, so parse it from there.
  if (!/\p{L}/u.test(text) && notes.length > notesBeforeParens) {
    const inner = notes.splice(notesBeforeParens).join(', ')
    const [innerParsed] = parseIngredient(inner, PARSE_OPTIONS)
    if (innerParsed?.description && innerParsed.quantity !== null && innerParsed.unitOfMeasure) {
      notes.push(`${innerParsed.quantity} ${innerParsed.unitOfMeasure}`)
      text = innerParsed.description.trim()
    } else {
      text = inner
    }
  }

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

  // "1 large, ripe mango": nothing between the unit and the comma.
  text = text.replace(/^[,\s]+/, '')

  // "2 14-ounce cans coconut milk" -> size is a note, "cans" is the unit.
  const packageSize = text.match(LEADING_PACKAGE_SIZE)
  if (packageSize) {
    notes.push(packageSize[1].replace(/\s+/g, ' '))
    text = text.slice(packageSize[0].length)
  }

  // "5 cups 1 large head romaine": a second measurement after the unit is a note.
  if (unit && /^[\d½¼¾⅓⅔⅛]/.test(text)) {
    const [second] = parseIngredient(text, PARSE_OPTIONS)
    if (
      second?.unitOfMeasureID &&
      !LENGTH_UNITS.has(second.unitOfMeasureID) &&
      second.description &&
      text.endsWith(second.description)
    ) {
      notes.push(text.slice(0, text.length - second.description.length).trim())
      text = second.description.trim()
    }
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

  // "1 1/2 inch cubes of bread" -> bread, notes "1 1/2 inch, cubes"
  text = text.replace(CUT_SHAPE_OF, (_match, shape: string) => {
    notes.push(shape.toLowerCase())
    return ''
  })

  // "a pinch or two of cloves", "shredded or thinly ribboned chard", "pitted and
  // rough-chopped olives": a second amount or prep word left at the front.
  text = text
    .replace(/^or\s+(?:two|three|so)\s+(?:of\s+)?/i, (m) => {
      notes.push(m.replace(/\s+of\s*$/i, '').trim())
      return ''
    })
  const stripAlternatePrep = () => {
    text = text.replace(ALTERNATE_PREP, (m) => {
      notes.push(m.trim())
      return ''
    })
  }
  stripAlternatePrep()

  // "1/2 tsp each salt + pepper"
  text = text.replace(/^each\s+/i, () => {
    notes.push('each')
    return ''
  })

  // Everything after the first comma is preparation / notes.
  // Descriptor-only segments ("boneless, skinless, chicken") are joined back on.
  const segments = text.split(/\s*[,;]\s*/)
  let head = segments.shift() ?? ''
  while (segments.length > 0 && (head === '' || isOnlyDescriptors(head))) {
    head = `${head} ${segments.shift()}`.trim()
  }
  notes.push(...segments.flatMap(splitNotes))
  text = head

  // Trailing phrases with no comma: "salt to taste", "parsley for garnish".
  let trailing = text.match(TRAILING_NOTE)
  while (trailing) {
    notes.unshift(trailing[1])
    text = text.slice(0, trailing.index).trim()
    trailing = text.match(TRAILING_NOTE)
  }

  const trailingPrep = text.match(TRAILING_PREP)
  if (trailingPrep && trailingPrep.index) {
    notes.unshift(trailingPrep[1])
    text = text.slice(0, trailingPrep.index).trim()
  }

  // "juice of 1 lemon" -> lemon, notes "juice".
  const takeJuice = () => {
    const juice = text.match(JUICE_OR_ZEST_OF)
    if (juice) {
      notes.unshift(juice[1].replace(/^the\s+/i, '').toLowerCase())
      text = juice[2]
        .replace(WORD_FRACTION, (_m, word: string) => `${WORD_FRACTION_VALUES[word.toLowerCase()]} `)
        .replace(FRACTION_OF_ONE, '$1 ')
        .replace(/^(?:one|an?)\s+/i, '1 ')
      // "zest from 1 medium orange": the amount is the fruit count.
      const [fruit] = /^[\d½¼¾⅓⅔⅛]/.test(text) ? parseIngredient(text, PARSE_OPTIONS) : []
      if (fruit && fruit.quantity !== null && fruit.description) {
        if (quantity === null) {
          quantity = fruit.quantity2 ?? fruit.quantity
          unit = fruit.unitOfMeasureID
        }
        text = fruit.description.trim()
      }
    }
  }
  takeJuice()

  // Leading prep words: "finely chopped yellow onion" -> "yellow onion".
  const prep = text.match(LEADING_PREP)
  if (prep && prep[0].length < text.length && !(unit && CONTAINER_UNITS.has(unit))) {
    notes.unshift(prep[1])
    text = text.slice(prep[0].length)
    stripAlternatePrep()
    // "finely grated zest of 1 orange"
    takeJuice()
  }

  if (alternativeNote) notes.push(alternativeNote)

  // "2 cups of flour" -> "flour"
  let name = text.replace(/^of\s+/i, '').replace(/[\s.:;-]+$/, '').trim()

  if (!looksLikeName(name)) {
    const rescued = rescueName(name, notes)
    if (!rescued) return { kind: 'invalid' }
    name = rescued
  }

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
    // "1 large egg + 1 egg yolk" is two ingredients.
    // "1/4 + 1/8 teaspoon" is one amount, so only split when both sides have words.
    const parts = splitOutsideParens(line, PLUS_SEPARATOR)
    const pieces = parts.every((p) => /\p{L}/u.test(p)) ? parts : [line]
    const results = pieces.map(parseIngredientLine)
    if (results.some((r) => r.kind === 'invalid')) {
      failedLines.push(line)
      continue
    }
    for (const result of results) {
      if (result.kind === 'ingredient') ingredients.push(result.ingredient)
    }
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
