/**
 * Live checks against the real model. Skipped by default; run with:
 *   RUN_LIVE_AI_TESTS=1 pnpm vitest run server/recipe-url-ingredients/categories.live.test.ts
 * Requires ANTHROPIC_API_KEY (loaded from .env).
 */
import 'dotenv/config'
import { describe, it, expect } from 'vitest'
import { createAnthropicClient } from './anthropicClient.js'
import { parseAIResponse } from './aiExtract.js'
import { normalizeExtraction } from './normalizeIngredients.js'
import { DEFAULT_CATEGORIES, sanitizeCategories, type RecipeCategory } from './categories.js'

const enabled = process.env.RUN_LIVE_AI_TESTS === '1' && !!process.env.ANTHROPIC_API_KEY

const RECIPE = `Smoky chickpea stew (serves 4). Ingredients: 2 tsp ground cumin, 1 tbsp smoked paprika,
1 cup whole milk, 2 carrots diced, 1 yellow onion chopped, 1 can chickpeas drained, 2 tbsp olive oil,
1 loaf crusty bread for serving.`

const run = async (categories: RecipeCategory[]) => {
  const client = createAnthropicClient({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: process.env.ANTHROPIC_MODEL,
  })
  const result = await client.extractIngredients(RECIPE, { categories })
  const { extraction } = parseAIResponse(result)
  const response = normalizeExtraction(extraction, 'https://example.com', categories)
  const byName = (needle: string) =>
    response.ingredients.find((i) => i.name.toLowerCase().includes(needle))?.category
  return { response, byName }
}

describe.skipIf(!enabled)('live category assignment', () => {
  it('uses only default values when no categories are sent', async () => {
    const { response, byName } = await run(sanitizeCategories(undefined))
    const allowed = DEFAULT_CATEGORIES.map((c) => c.value)
    for (const i of response.ingredients) expect(allowed).toContain(i.category)
    expect(byName('milk')).toBe('dairy')
  }, 60_000)

  it('assigns cumin/paprika to a custom Spices category', async () => {
    const { byName } = await run(
      sanitizeCategories([...DEFAULT_CATEGORIES, { value: 'spices', label: 'Spices' }])
    )
    expect(byName('cumin')).toBe('spices')
    expect(byName('paprika')).toBe('spices')
  }, 60_000)

  it('returns the value of a renamed built-in, never the label', async () => {
    const { response, byName } = await run(
      sanitizeCategories([
        { value: 'produce', label: 'Fruit & Veg' },
        { value: 'dairy', label: 'Dairy' },
      ])
    )
    expect(byName('carrot')).toBe('produce')
    expect(JSON.stringify(response)).not.toContain('Fruit & Veg')
  }, 60_000)

  it('never assigns dairy when it was not offered', async () => {
    const { response } = await run(
      sanitizeCategories([
        { value: 'produce', label: 'Produce' },
        { value: 'fridge', label: 'Fridge' },
      ])
    )
    for (const i of response.ingredients) expect(i.category).not.toBe('dairy')
    const milk = response.ingredients.find((i) => i.name.toLowerCase().includes('milk'))
    expect(['fridge', 'other']).toContain(milk?.category)
  }, 60_000)
})
