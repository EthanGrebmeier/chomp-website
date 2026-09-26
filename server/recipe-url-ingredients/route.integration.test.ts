import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express, { type Express } from 'express'
import request from 'supertest'
import type { HtmlFetchResult } from './htmlFetch.js'
import type { AnthropicExtractionResult, AnthropicRequestOptions } from './anthropicClient.js'
import { AnthropicClientError } from './anthropicClient.js'
import { DEFAULT_CATEGORIES } from './categories.js'

// Mock request-filtering-agent to avoid module-level instantiation issues
vi.mock('request-filtering-agent', () => ({
  createFilteredHttpAgent: () => ({}),
  createFilteredHttpsAgent: () => ({}),
}))

// Mock config to avoid requiring real env vars
vi.mock('../config.js', () => ({
  loadConfig: () => ({
    anthropicApiKey: 'test-api-key',
    typesafeApiKey: 'test-typesafe-key',
    clerkSecretKey: 'test-clerk-key',
    clerkPublishableKey: 'test-clerk-pub-key',
    port: 3000,
  }),
}))

// Mock Clerk auth - default to authenticated
let mockIsAuthenticated = true
let mockUserId: string | null = 'test-user-123'

vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  getAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    userId: mockUserId,
    sessionId: mockUserId ? 'test-session-456' : null,
  }),
}))

// Mock fetchHtml with controllable behavior
let mockFetchHtmlResult: HtmlFetchResult | null = null
vi.mock('./htmlFetch.js', () => ({
  fetchHtml: vi.fn(async () => {
    if (!mockFetchHtmlResult) {
      throw new Error('mockFetchHtmlResult not set')
    }
    return mockFetchHtmlResult
  }),
}))

// Mock Anthropic client with controllable behavior
let mockExtractIngredientsResult: AnthropicExtractionResult | null = null
let mockExtractIngredientsError: Error | null = null
let lastExtractOptions: AnthropicRequestOptions | undefined

vi.mock('./anthropicClient.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./anthropicClient.js')>()
  return {
    ...original,
    createAnthropicClient: () => ({
      extractIngredients: vi.fn(async (_content: string, options?: AnthropicRequestOptions) => {
        lastExtractOptions = options
        if (mockExtractIngredientsError) {
          throw mockExtractIngredientsError
        }
        if (!mockExtractIngredientsResult) {
          throw new Error('mockExtractIngredientsResult not set')
        }
        return mockExtractIngredientsResult
      }),
    }),
  }
})

// Mock Jev categorizer with controllable behavior
let mockCategorizeError: Error | null = null
let mockCategorizeFn: ((names: string[]) => string[]) | null = null
let categorizeCalls = 0

vi.mock('./jevCategorizer.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./jevCategorizer.js')>()
  return {
    ...original,
    createJevCategorizer: () => ({
      categorize: vi.fn(async (items: Array<{ name: string }>) => {
        categorizeCalls += 1
        if (mockCategorizeError) throw mockCategorizeError
        const names = items.map((i) => i.name)
        return {
          categories: mockCategorizeFn ? mockCategorizeFn(names) : names.map(() => 'other'),
          minConfidence: 0.9,
          latencyMs: 120,
          usage: { inputTokens: 50, outputTokens: 0 },
          model: 'jev-test',
        }
      }),
    }),
  }
})

const jsonLdRecipeHtml = (ingredients: string[]) => `
<!DOCTYPE html>
<html>
<head>
  <title>Mac &amp; Cheese</title>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name: 'Page' },
      {
        '@type': 'Recipe',
        name: 'Baked Mac &amp; Cheese',
        recipeYield: ['6', '6 servings'],
        recipeIngredient: ingredients,
      },
    ],
  })}</script>
</head>
<body><p>Story time.</p></body>
</html>
`

const validRecipeHtml = `
<!DOCTYPE html>
<html>
<head><title>Test Recipe</title></head>
<body>
  <article>
    <h1>Simple Pasta</h1>
    <p>Serves 4</p>
    <ul>
      <li>2 cups flour</li>
      <li>3 eggs</li>
      <li>1 tsp salt</li>
    </ul>
  </article>
</body>
</html>
`

const validAIResponse = JSON.stringify({
  recipeName: 'Simple Pasta',
  servings: '4',
  ingredients: [
    { name: 'Flour', quantity: 2, unit: 'cups', notes: null, category: 'other' },
    { name: 'Eggs', quantity: 3, unit: null, notes: null, category: 'dairy' },
    { name: 'Salt', quantity: 1, unit: 'tsp', notes: null, category: 'other' },
  ],
})

describe('POST /api/recipes/ingredients-from-url', () => {
  let app: Express

  beforeEach(async () => {
    // Reset all mock state
    mockIsAuthenticated = true
    mockUserId = 'test-user-123'
    mockFetchHtmlResult = null
    mockExtractIngredientsResult = null
    mockExtractIngredientsError = null
    lastExtractOptions = undefined
    mockCategorizeError = null
    mockCategorizeFn = null
    categorizeCalls = 0

    // Reset module cache to get fresh route handler with fresh client
    vi.resetModules()

    // Re-import after reset to get fresh instances
    const { createRecipeUrlIngredientsRoute } = await import('./route.js')
    const { recipeUrlIngredientsErrorHandler } = await import('./errors.js')

    app = express()
    app.use(express.json())
    app.post('/api/recipes/ingredients-from-url', ...createRecipeUrlIngredientsRoute())
    app.use('/api/recipes', recipeUrlIngredientsErrorHandler)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Success cases', () => {
    it('returns 200 with normalized ingredients for a valid recipe URL', async () => {
      mockFetchHtmlResult = {
        ok: true,
        html: validRecipeHtml,
        contentType: 'text/html',
        finalUrl: 'https://example.com/recipe',
      }

      mockExtractIngredientsResult = {
        content: validAIResponse,
        usage: { inputTokens: 100, outputTokens: 50 },
        model: 'claude-sonnet-4-6',
        requestId: 'test-req-id',
        latencyMs: 500,
      }

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        sourceUrl: 'https://example.com/recipe',
        recipeName: 'Simple Pasta',
        servings: '4',
        ingredients: [
          { name: 'Flour', quantity: 2, unit: 'cup', notes: null, category: 'other' },
          { name: 'Eggs', quantity: 3, unit: null, notes: null, category: 'dairy' },
          { name: 'Salt', quantity: 1, unit: 'tsp', notes: null, category: 'other' },
        ],
      })
    })

    it('handles recipes with null servings and recipe name', async () => {
      mockFetchHtmlResult = {
        ok: true,
        html: validRecipeHtml,
        contentType: 'text/html',
        finalUrl: 'https://example.com/recipe',
      }

      mockExtractIngredientsResult = {
        content: JSON.stringify({
          recipeName: null,
          servings: null,
          ingredients: [{ name: 'Sugar', quantity: 1, unit: 'cup', notes: null, category: 'other' }],
        }),
        usage: { inputTokens: 100, outputTokens: 30 },
        model: 'claude-sonnet-4-6',
        latencyMs: 300,
      }

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(200)
      expect(response.body.recipeName).toBeNull()
      expect(response.body.servings).toBeNull()
      expect(response.body.ingredients).toHaveLength(1)
    })
  })

  describe('URL validation errors', () => {
    it('returns 400 for missing URL', async () => {
      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('invalid_url')
    })

    it('returns 400 for empty URL', async () => {
      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: '' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('invalid_url')
    })

    it('returns 400 for non-HTTP URL', async () => {
      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'ftp://example.com/recipe' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('invalid_url')
    })

    it('returns 400 for malformed URL', async () => {
      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'not-a-valid-url' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('invalid_url')
    })
  })

  describe('Fetch errors', () => {
    it('returns 408 for fetch timeout', async () => {
      mockFetchHtmlResult = {
        ok: false,
        code: 'fetch_timeout',
        message: 'Request timed out',
      }

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://slow-site.com/recipe' })

      expect(response.status).toBe(408)
      expect(response.body.error.code).toBe('fetch_timeout')
    })

    it('returns 413 for content too large', async () => {
      mockFetchHtmlResult = {
        ok: false,
        code: 'content_too_large',
        message: 'Response body exceeds limit of 2097152 bytes',
      }

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://huge-page.com/recipe' })

      expect(response.status).toBe(413)
      expect(response.body.error.code).toBe('content_too_large')
    })

    it('returns 400 for SSRF blocked requests', async () => {
      mockFetchHtmlResult = {
        ok: false,
        code: 'ssrf_blocked',
        message: 'Request blocked: target address not allowed',
      }

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('invalid_url')
    })

    it('returns 400 for invalid content type', async () => {
      mockFetchHtmlResult = {
        ok: false,
        code: 'invalid_content_type',
        message: 'Expected HTML content-type, got: application/pdf',
      }

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe.pdf' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('unsupported_content')
    })

    it('returns 500 for generic fetch failure', async () => {
      mockFetchHtmlResult = {
        ok: false,
        code: 'fetch_failed',
        message: 'Network error',
      }

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('server_error')
    })
  })

  describe('AI extraction errors', () => {
    beforeEach(() => {
      mockFetchHtmlResult = {
        ok: true,
        html: validRecipeHtml,
        contentType: 'text/html',
        finalUrl: 'https://example.com/recipe',
      }
    })

    it('returns 429 for Anthropic rate limit', async () => {
      mockExtractIngredientsError = new AnthropicClientError(
        'Anthropic rate limit exceeded',
        'rate_limit_error',
        'req-123'
      )

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(429)
      expect(response.body.error.code).toBe('rate_limited')
    })

    it('returns 408 for Anthropic timeout', async () => {
      mockExtractIngredientsError = new AnthropicClientError(
        'Anthropic request timed out',
        'timeout_error',
        'req-123'
      )

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(408)
      expect(response.body.error.code).toBe('fetch_timeout')
    })

    it('returns 500 for Anthropic API error', async () => {
      mockExtractIngredientsError = new AnthropicClientError(
        'Anthropic API error: Internal server error',
        'api_error',
        'req-123'
      )

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('server_error')
    })

    it('returns 500 for Anthropic authentication error', async () => {
      mockExtractIngredientsError = new AnthropicClientError(
        'Invalid Anthropic API key',
        'authentication_error',
        'req-123'
      )

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('server_error')
    })
  })

  describe('AI response parsing errors', () => {
    beforeEach(() => {
      mockFetchHtmlResult = {
        ok: true,
        html: validRecipeHtml,
        contentType: 'text/html',
        finalUrl: 'https://example.com/recipe',
      }
    })

    it('returns 422 for invalid JSON response from AI', async () => {
      mockExtractIngredientsResult = {
        content: 'This is not valid JSON',
        usage: { inputTokens: 100, outputTokens: 10 },
        model: 'claude-sonnet-4-6',
        latencyMs: 200,
      }

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(422)
      expect(response.body.error.code).toBe('parse_failed')
    })

    it('returns 422 for AI response failing schema validation', async () => {
      mockExtractIngredientsResult = {
        content: JSON.stringify({
          recipeName: 'Test',
          // Missing 'servings' and 'ingredients' fields
        }),
        usage: { inputTokens: 100, outputTokens: 10 },
        model: 'claude-sonnet-4-6',
        latencyMs: 200,
      }

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(422)
      expect(response.body.error.code).toBe('parse_failed')
    })

    it('returns 400 when no ingredients are found', async () => {
      mockExtractIngredientsResult = {
        content: JSON.stringify({
          recipeName: 'Empty Recipe',
          servings: '4',
          ingredients: [],
        }),
        usage: { inputTokens: 100, outputTokens: 20 },
        model: 'claude-sonnet-4-6',
        latencyMs: 200,
      }

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('unsupported_content')
      expect(response.body.error.message).toContain('No ingredients found')
    })
  })

  describe('AI response edge cases', () => {
    beforeEach(() => {
      mockFetchHtmlResult = {
        ok: true,
        html: validRecipeHtml,
        contentType: 'text/html',
        finalUrl: 'https://example.com/recipe',
      }
    })

    it('handles AI response wrapped in markdown code blocks', async () => {
      mockExtractIngredientsResult = {
        content: '```json\n' + validAIResponse + '\n```',
        usage: { inputTokens: 100, outputTokens: 50 },
        model: 'claude-sonnet-4-6',
        latencyMs: 500,
      }

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(200)
      expect(response.body.ingredients).toHaveLength(3)
    })

    it('handles AI response with just triple backticks (no json tag)', async () => {
      mockExtractIngredientsResult = {
        content: '```\n' + validAIResponse + '\n```',
        usage: { inputTokens: 100, outputTokens: 50 },
        model: 'claude-sonnet-4-6',
        latencyMs: 500,
      }

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(200)
      expect(response.body.ingredients).toHaveLength(3)
    })
  })

  describe('User categories', () => {
    const aiResponseWith = (ingredients: Array<{ name: string; category: string }>) => ({
      content: JSON.stringify({
        recipeName: 'Test',
        servings: '2',
        ingredients: ingredients.map((i) => ({ quantity: 1, unit: null, notes: null, ...i })),
      }),
      usage: { inputTokens: 100, outputTokens: 50 },
      model: 'claude-haiku-4-5',
      latencyMs: 100,
    })

    const offeredValues = () => (lastExtractOptions?.categories ?? []).map((c) => c.value)

    beforeEach(() => {
      mockFetchHtmlResult = {
        ok: true,
        html: validRecipeHtml,
        contentType: 'text/html',
        finalUrl: 'https://example.com/recipe',
      }
    })

    it('uses the default categories when none are sent', async () => {
      mockExtractIngredientsResult = aiResponseWith([
        { name: 'Milk', category: 'dairy' },
        { name: 'Flour', category: 'Pantry' }, // legacy value, no longer offered
        { name: 'Apples', category: 'Produce' }, // label, not a value
      ])

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(200)
      expect(offeredValues()).toEqual(DEFAULT_CATEGORIES.map((c) => c.value))
      const categories = response.body.ingredients.map((i: { category: string }) => i.category)
      expect(categories).toEqual(['dairy', 'other', 'other'])
      for (const c of categories) {
        expect(DEFAULT_CATEGORIES.map((d) => d.value)).toContain(c)
      }
    })

    it('offers and returns a custom category', async () => {
      mockExtractIngredientsResult = aiResponseWith([
        { name: 'Cumin', category: 'spices' },
        { name: 'Paprika', category: 'spices' },
      ])

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({
          url: 'https://example.com/recipe',
          categories: [
            { value: 'produce', label: 'Produce' },
            { value: 'spices', label: 'Spices' },
          ],
        })

      expect(response.status).toBe(200)
      expect(lastExtractOptions?.categories).toEqual([
        { value: 'produce', label: 'Produce' },
        { value: 'spices', label: 'Spices' },
      ])
      expect(response.body.ingredients.map((i: { category: string }) => i.category)).toEqual([
        'spices',
        'spices',
      ])
    })

    it('returns the value of a renamed built-in, never its label', async () => {
      mockExtractIngredientsResult = aiResponseWith([
        { name: 'Carrots', category: 'produce' },
        { name: 'Apples', category: 'Fruit & Veg' },
      ])

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({
          url: 'https://example.com/recipe',
          categories: [{ value: 'produce', label: 'Fruit & Veg' }],
        })

      expect(response.status).toBe(200)
      const categories = response.body.ingredients.map((i: { category: string }) => i.category)
      expect(categories).toEqual(['produce', 'other'])
      expect(JSON.stringify(response.body)).not.toContain('Fruit & Veg')
    })

    it('never returns dairy when dairy was not offered', async () => {
      mockExtractIngredientsResult = aiResponseWith([{ name: 'Milk', category: 'dairy' }])

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({
          url: 'https://example.com/recipe',
          categories: [
            { value: 'produce', label: 'Produce' },
            { value: 'fridge', label: 'Fridge' },
          ],
        })

      expect(response.status).toBe(200)
      expect(offeredValues()).not.toContain('dairy')
      expect(response.body.ingredients[0].category).toBe('other')
    })

    it('cleans up bad category entries and still returns 200', async () => {
      mockExtractIngredientsResult = aiResponseWith([{ name: 'Cumin', category: 'spices' }])

      const many = Array.from({ length: 150 }, (_, i) => ({ value: `c${i}`, label: `Cat ${i}` }))
      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({
          url: 'https://example.com/recipe',
          categories: [
            { value: '', label: 'Empty value' },
            { value: 'blank-label', label: '   ' },
            { value: 42, label: 'Number' },
            null,
            'not-an-object',
            { value: '  spices  ', label: ' Spices ' },
            { value: 'spices', label: 'Duplicate' },
            { value: 'x'.repeat(101), label: 'Too long' },
            ...many,
          ],
        })

      expect(response.status).toBe(200)
      const offered = lastExtractOptions?.categories ?? []
      expect(offered).toHaveLength(100)
      expect(offered[0]).toEqual({ value: 'spices', label: 'Spices' })
      expect(offered.filter((c) => c.value === 'spices')).toHaveLength(1)
      expect(response.body.ingredients[0].category).toBe('spices')
    })

    it('falls back to defaults for a non-array categories field', async () => {
      mockExtractIngredientsResult = aiResponseWith([{ name: 'Milk', category: 'dairy' }])

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe', categories: 'produce' })

      expect(response.status).toBe(200)
      expect(offeredValues()).toEqual(DEFAULT_CATEGORIES.map((c) => c.value))
      expect(response.body.ingredients[0].category).toBe('dairy')
    })

    it('replaces a category the model invented with other', async () => {
      mockExtractIngredientsResult = aiResponseWith([
        { name: 'Cumin', category: 'seasonings' },
        { name: 'Salt', category: 'spices' },
      ])

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({
          url: 'https://example.com/recipe',
          categories: [{ value: 'spices', label: 'Spices' }],
        })

      expect(response.status).toBe(200)
      expect(response.body.ingredients.map((i: { category: string }) => i.category)).toEqual([
        'other',
        'spices',
      ])
    })
  })

  describe('Fast path (structured data + Jev)', () => {
    const setHtml = (html: string) => {
      mockFetchHtmlResult = {
        ok: true,
        html,
        contentType: 'text/html',
        finalUrl: 'https://example.com/recipe',
      }
    }

    it('parses JSON-LD ingredients in code and categorizes with Jev, skipping the LLM', async () => {
      setHtml(
        jsonLdRecipeHtml([
          '1 lb elbow macaroni',
          '2 cups shredded cheddar cheese, divided',
          '3 tablespoons butter, melted',
          '1 clove garlic, minced',
        ])
      )
      mockCategorizeFn = (names) =>
        names.map((n) => (/cheese|butter/.test(n) ? 'dairy' : /garlic/.test(n) ? 'produce' : 'other'))

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(200)
      expect(categorizeCalls).toBe(1)
      expect(lastExtractOptions).toBeUndefined()
      expect(response.body).toEqual({
        sourceUrl: 'https://example.com/recipe',
        recipeName: 'Baked Mac & Cheese',
        servings: '6 servings',
        ingredients: [
          { name: 'Elbow Macaroni', quantity: 1, unit: 'lb', notes: null, category: 'other' },
          {
            name: 'Cheddar Cheese',
            quantity: 2,
            unit: 'cup',
            notes: 'shredded, divided',
            category: 'dairy',
          },
          { name: 'Butter', quantity: 3, unit: 'tbsp', notes: 'melted', category: 'dairy' },
          { name: 'Garlic', quantity: 1, unit: 'clove', notes: 'minced', category: 'produce' },
        ],
      })
    })

    it('coerces a category that was not offered to other', async () => {
      setHtml(jsonLdRecipeHtml(['1 cup milk']))
      mockCategorizeFn = (names) => names.map(() => 'dairy')

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe', categories: [{ value: 'produce', label: 'Produce' }] })

      expect(response.status).toBe(200)
      expect(response.body.ingredients[0].category).toBe('other')
    })

    it('falls back to the LLM when a line cannot be parsed', async () => {
      setHtml(jsonLdRecipeHtml(['1 lb pasta', '2 cups 1 1/2 inch cubes of 3 day old bread']))
      mockExtractIngredientsResult = {
        content: validAIResponse,
        usage: { inputTokens: 100, outputTokens: 50 },
        model: 'claude-haiku-4-5',
        latencyMs: 500,
      }

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(200)
      expect(categorizeCalls).toBe(0)
      expect(lastExtractOptions).toBeDefined()
      expect(response.body.recipeName).toBe('Simple Pasta')
    })

    it('falls back to the LLM when Jev fails', async () => {
      setHtml(jsonLdRecipeHtml(['1 lb pasta']))
      mockCategorizeError = new Error('jev down')
      mockExtractIngredientsResult = {
        content: validAIResponse,
        usage: { inputTokens: 100, outputTokens: 50 },
        model: 'claude-haiku-4-5',
        latencyMs: 500,
      }

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(200)
      expect(categorizeCalls).toBe(1)
      expect(lastExtractOptions).toBeDefined()
      expect(response.body.recipeName).toBe('Simple Pasta')
    })

    it('uses the LLM for pages without structured data', async () => {
      setHtml(validRecipeHtml)
      mockExtractIngredientsResult = {
        content: validAIResponse,
        usage: { inputTokens: 100, outputTokens: 50 },
        model: 'claude-haiku-4-5',
        latencyMs: 500,
      }

      const response = await request(app)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(200)
      expect(categorizeCalls).toBe(0)
    })
  })

  describe('Authentication errors', () => {
    it('returns 401 for unauthenticated requests', async () => {
      mockIsAuthenticated = false
      mockUserId = null

      // Recreate app with new auth state
      vi.resetModules()
      const { createRecipeUrlIngredientsRoute } = await import('./route.js')
      const { recipeUrlIngredientsErrorHandler } = await import('./errors.js')

      const unauthApp = express()
      unauthApp.use(express.json())
      unauthApp.post('/api/recipes/ingredients-from-url', ...createRecipeUrlIngredientsRoute())
      unauthApp.use('/api/recipes', recipeUrlIngredientsErrorHandler)

      const response = await request(unauthApp)
        .post('/api/recipes/ingredients-from-url')
        .send({ url: 'https://example.com/recipe' })

      expect(response.status).toBe(401)
      expect(response.body.error.code).toBe('unauthorized')
    })
  })
})
