/**
 * User-defined shopping categories.
 *
 * The client sends the user's category list (in display order) so the model can
 * sort ingredients into custom categories ("Spices", "Costco Run") or renamed
 * built-ins (`produce` shown as "Fruit & Veg"). The `value` is the stable id
 * the client stores and is what we return; the `label` is free text the user
 * typed and is only used to tell the model what the category means.
 */

export type RecipeCategory = {
  value: string
  label: string
}

export const OTHER_CATEGORY_VALUE = 'other'
const OTHER_CATEGORY_LABEL = 'Other'

export const MAX_CATEGORIES = 100
export const MAX_CATEGORY_FIELD_LENGTH = 100

export const DEFAULT_CATEGORIES: readonly RecipeCategory[] = Object.freeze([
  { value: 'produce', label: 'Produce' },
  { value: 'deli', label: 'Deli' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'health-beauty', label: 'Health & Beauty' },
  { value: 'household', label: 'Household' },
  { value: OTHER_CATEGORY_VALUE, label: OTHER_CATEGORY_LABEL },
])

const cleanField = (input: unknown): string | null => {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_CATEGORY_FIELD_LENGTH) return null
  return trimmed
}

/**
 * Cleans up the client-supplied category list. Never throws: bad input is
 * dropped rather than rejected so a malformed list can't fail an import.
 *
 * - entries whose value/label aren't non-empty strings (after trim) are dropped
 * - entries whose value/label exceed MAX_CATEGORY_FIELD_LENGTH are dropped
 * - duplicate values keep the first occurrence
 * - at most MAX_CATEGORIES entries are kept
 * - an empty result (or missing/non-array input) falls back to the defaults
 */
export const sanitizeCategories = (input: unknown): RecipeCategory[] => {
  if (!Array.isArray(input)) return [...DEFAULT_CATEGORIES]

  const seen = new Set<string>()
  const result: RecipeCategory[] = []

  for (const entry of input) {
    if (result.length >= MAX_CATEGORIES) break
    if (typeof entry !== 'object' || entry === null) continue

    const value = cleanField((entry as Record<string, unknown>).value)
    const label = cleanField((entry as Record<string, unknown>).label)
    if (value === null || label === null) continue
    if (seen.has(value)) continue

    seen.add(value)
    result.push({ value, label })
  }

  return result.length > 0 ? result : [...DEFAULT_CATEGORIES]
}

/**
 * Returns the categories the model may choose from: the user's list plus
 * `other` (appended) if the user's list doesn't already contain it.
 */
export const withOtherCategory = (categories: readonly RecipeCategory[]): RecipeCategory[] => {
  if (categories.some((c) => c.value === OTHER_CATEGORY_VALUE)) return [...categories]
  return [...categories, { value: OTHER_CATEGORY_VALUE, label: OTHER_CATEGORY_LABEL }]
}

/**
 * Forces a model-returned category onto the offered set. Anything that isn't
 * exactly one of the offered values (including a label) becomes `other`.
 */
export const coerceCategory = (category: unknown, allowedValues: ReadonlySet<string>): string => {
  if (typeof category === 'string' && allowedValues.has(category)) return category
  return OTHER_CATEGORY_VALUE
}
