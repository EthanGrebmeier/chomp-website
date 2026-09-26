/**
 * Live checks against the real Jev model: the same category scenarios as
 * categories.live.test.ts, run through the LLM-free path. Skipped by default:
 *   RUN_LIVE_AI_TESTS=1 pnpm vitest run server/recipe-url-ingredients/jevCategorizer.live.test.ts
 * Requires TYPESAFE_API_KEY (loaded from .env).
 */
import 'dotenv/config'
import { describe, it, expect } from 'vitest'
import { createJevCategorizer } from './jevCategorizer.js'
import { parseIngredientLines } from './ingredientParser.js'
import { DEFAULT_CATEGORIES, sanitizeCategories, type RecipeCategory } from './categories.js'

const enabled = process.env.RUN_LIVE_AI_TESTS === '1' && !!process.env.TYPESAFE_API_KEY

const LINES = [
  '2 tsp ground cumin',
  '1 tbsp smoked paprika',
  '1 cup whole milk',
  '2 carrots, diced',
  '1 yellow onion, chopped',
  '1 can chickpeas, drained',
  '2 tbsp olive oil',
  '1 loaf crusty bread, for serving',
]

const run = async (categories: RecipeCategory[]) => {
  const parsed = parseIngredientLines(LINES)
  if (!parsed.ok) throw new Error(parsed.reason)
  const categorizer = createJevCategorizer({
    apiKey: process.env.TYPESAFE_API_KEY!,
    model: process.env.TYPESAFE_MODEL,
  })
  const result = await categorizer.categorize(parsed.ingredients, {
    categories,
    recipeName: 'Smoky chickpea stew',
  })
  console.log(
    `jev ${result.model} ${result.latencyMs}ms minConfidence=${result.minConfidence}`,
    parsed.ingredients.map((i, idx) => `${i.name}=${result.categories[idx]}`).join(', ')
  )
  const byName = (needle: string) => {
    const index = parsed.ingredients.findIndex((i) => i.name.toLowerCase().includes(needle))
    return result.categories[index]
  }
  return { result, byName }
}

describe.skipIf(!enabled)('live Jev category assignment', () => {
  it('uses only default values when no categories are sent', async () => {
    const { result, byName } = await run(sanitizeCategories(undefined))
    const allowed = DEFAULT_CATEGORIES.map((c) => c.value)
    for (const c of result.categories) expect(allowed).toContain(c)
    expect(byName('milk')).toBe('dairy')
    expect(byName('carrot')).toBe('produce')
    expect(byName('bread')).toBe('bakery')
  }, 30_000)

  it('assigns cumin/paprika to a custom Spices category', async () => {
    const { byName } = await run(
      sanitizeCategories([...DEFAULT_CATEGORIES, { value: 'spices', label: 'Spices' }])
    )
    expect(byName('cumin')).toBe('spices')
    expect(byName('paprika')).toBe('spices')
  }, 30_000)

  it('follows the label of a renamed built-in', async () => {
    const { byName } = await run(
      sanitizeCategories([
        { value: 'produce', label: 'Fruit & Veg' },
        { value: 'dairy', label: 'Dairy' },
      ])
    )
    expect(byName('carrot')).toBe('produce')
  }, 30_000)

  it('never assigns dairy when it was not offered', async () => {
    const { result, byName } = await run(
      sanitizeCategories([
        { value: 'produce', label: 'Produce' },
        { value: 'fridge', label: 'Fridge' },
      ])
    )
    for (const c of result.categories) expect(c).not.toBe('dairy')
    expect(['fridge', 'other']).toContain(byName('milk'))
  }, 30_000)
})
