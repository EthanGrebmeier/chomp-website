import { describe, it, expect, vi } from 'vitest'
import {
  buildCategoryCriteria,
  createJevCategorizer,
  JevCategorizerError,
} from './jevCategorizer.js'

type FakeRequest = {
  questions: Record<string, { type: string; instructions: { ingredient: string }; criteria: Record<string, string> }>
}

const fakeClient = (pick: (ingredient: string) => string) => {
  const systemOne = vi.fn(async (request: FakeRequest) => ({
    model: 'jev-test',
    usage: { input_tokens: 42, output_tokens: 0 },
    answers: Object.fromEntries(
      Object.entries(request.questions).map(([key, q]) => [
        key,
        { type: 'choice', choice: pick(q.instructions.ingredient), confidence: 0.8, probabilities: {} },
      ])
    ),
  }))
  return { systemOne }
}

describe('buildCategoryCriteria', () => {
  it('adds hints to unchanged built-ins and uses the label alone otherwise', () => {
    expect(
      buildCategoryCriteria([
        { value: 'dairy', label: 'Dairy' },
        { value: 'produce', label: 'Fruit & Veg' },
        { value: 'spices', label: 'Spices' },
      ])
    ).toEqual({
      dairy: 'Dairy: milk, cheese, yogurt, butter, eggs, cream',
      produce: 'Fruit & Veg',
      spices: 'Spices',
    })
  })
})

describe('createJevCategorizer', () => {
  it('asks one question per distinct ingredient and maps answers back in order', async () => {
    const client = fakeClient((name) => (name === 'garlic' ? 'produce' : 'dairy'))
    const categorizer = createJevCategorizer({ apiKey: 'x', client: client as never })

    const result = await categorizer.categorize(
      [{ name: 'butter' }, { name: 'garlic' }, { name: 'Butter' }],
      { categories: [{ value: 'produce', label: 'Produce' }, { value: 'dairy', label: 'Dairy' }] }
    )

    expect(result.categories).toEqual(['dairy', 'produce', 'dairy'])
    const request = client.systemOne.mock.calls[0][0]
    expect(Object.keys(request.questions)).toEqual(['i0', 'i1'])
    // `other` is always offered
    expect(Object.keys(request.questions.i0.criteria)).toEqual(['produce', 'dairy', 'other'])
  })

  it('coerces unknown choices to other', async () => {
    const categorizer = createJevCategorizer({
      apiKey: 'x',
      client: fakeClient(() => 'made-up') as never,
    })
    const result = await categorizer.categorize([{ name: 'salt' }])
    expect(result.categories).toEqual(['other'])
  })

  it('wraps client failures', async () => {
    const categorizer = createJevCategorizer({
      apiKey: 'x',
      client: { systemOne: vi.fn(async () => Promise.reject(new Error('boom'))) } as never,
    })
    await expect(categorizer.categorize([{ name: 'salt' }])).rejects.toBeInstanceOf(
      JevCategorizerError
    )
  })
})
