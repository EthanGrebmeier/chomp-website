import Anthropic from '@anthropic-ai/sdk'

export type AnthropicClientConfig = {
  apiKey: string
  /** Request timeout in milliseconds. Default: 30000 (30s) */
  timeoutMs?: number
  /** Max retries for transient failures. Default: 2 */
  maxRetries?: number
}

export type AnthropicRequestOptions = {
  /** Unique request ID for tracing */
  requestId?: string
}

export type AnthropicExtractionResult = {
  content: string
  usage: {
    inputTokens: number
    outputTokens: number
  }
  model: string
  requestId?: string
  latencyMs: number
}

export type AnthropicErrorCode =
  | 'api_error'
  | 'authentication_error'
  | 'rate_limit_error'
  | 'timeout_error'
  | 'invalid_request_error'
  | 'unknown_error'

export class AnthropicClientError extends Error {
  constructor(
    message: string,
    public readonly code: AnthropicErrorCode,
    public readonly requestId?: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'AnthropicClientError'
  }
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 2
const MODEL = 'claude-sonnet-4-20250514'

export const createAnthropicClient = (config: AnthropicClientConfig) => {
  const { apiKey, timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES } = config

  const client = new Anthropic({
    apiKey,
    timeout: timeoutMs,
    maxRetries,
  })

  const extractIngredients = async (
    content: string,
    options: AnthropicRequestOptions = {}
  ): Promise<AnthropicExtractionResult> => {
    const { requestId } = options
    const startTime = Date.now()

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: buildExtractionPrompt(content),
          },
        ],
      })

      const latencyMs = Date.now() - startTime

      const textContent = response.content.find((block) => block.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new AnthropicClientError(
          'No text content in AI response',
          'api_error',
          requestId
        )
      }

      return {
        content: textContent.text,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        model: response.model,
        requestId,
        latencyMs,
      }
    } catch (error) {

      if (error instanceof AnthropicClientError) {
        throw error
      }

      if (error instanceof Anthropic.APIError) {
        throw mapAnthropicApiError(error, requestId)
      }

      throw new AnthropicClientError(
        `Unexpected error during AI extraction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'unknown_error',
        requestId,
        error
      )
    }
  }

  return {
    extractIngredients,
  }
}

const buildExtractionPrompt = (content: string): string => {
  return `Extract the recipe ingredients from the following webpage content. Return ONLY valid JSON matching this exact schema, with no additional text or markdown:

{
  "recipeName": "string or null if not found",
  "servings": "string or null if not found",
  "ingredients": [
    {
      "name": "ingredient name (required)",
      "quantity": number or null,
      "unit": "string or null",
      "notes": "string or null (e.g., 'minced', 'divided')",
      "category": "one of: Produce, Deli, Dairy, Bakery, Frozen, Pantry, Beverages, Snacks, Health & Beauty, Household, Other"
    }
  ]
}

Rules:
- Return ONLY the JSON object, no markdown code blocks or explanation
- If no ingredients are found, return an empty ingredients array
- Quantity should be a number (convert fractions: 1/2 = 0.5, 1 1/2 = 1.5)
- Unit should be standardized (tbsp, tsp, cup, oz, lb, g, kg, ml, L, cloves, etc.)
- Include preparation notes in the "notes" field, not in the name
- Category must be exactly one of: Produce, Deli, Dairy, Bakery, Frozen, Pantry, Beverages, Snacks, Health & Beauty, Household, Other
- Category guidance:
  - Produce: fresh fruits, vegetables, herbs
  - Deli: deli meats, prepared foods, cheeses from deli counter
  - Dairy: milk, cheese, yogurt, butter, eggs, cream
  - Bakery: bread, rolls, pastries, tortillas
  - Frozen: frozen vegetables, frozen meals, ice cream
  - Pantry: canned goods, dry goods, spices, oils, vinegar, pasta, rice, flour, sugar, condiments
  - Beverages: drinks, juice, soda, coffee, tea
  - Snacks: chips, crackers, cookies, candy
  - Health & Beauty: non-food items for personal care
  - Household: cleaning supplies, non-food household items
  - Other: anything that doesn't fit the above categories

Few-shot examples (follow this behavior exactly):

Example 1
Input text:
"Classic guacamole serves 4. Ingredients: 2 ripe avocados, 1/2 red onion finely diced, 2 tbsp lime juice, 1 clove garlic minced, 1 tsp kosher salt."

Output JSON:
{
  "recipeName": "Classic guacamole",
  "servings": "4",
  "ingredients": [
    {
      "name": "avocados",
      "quantity": 2,
      "unit": null,
      "notes": "ripe",
      "category": "Produce"
    },
    {
      "name": "red onion",
      "quantity": 0.5,
      "unit": null,
      "notes": "finely diced",
      "category": "Produce"
    },
    {
      "name": "lime juice",
      "quantity": 2,
      "unit": "tbsp",
      "notes": null,
      "category": "Produce"
    },
    {
      "name": "garlic",
      "quantity": 1,
      "unit": "clove",
      "notes": "minced",
      "category": "Produce"
    },
    {
      "name": "kosher salt",
      "quantity": 1,
      "unit": "tsp",
      "notes": null,
      "category": "Pantry"
    }
  ]
}

Example 2
Input text:
"Baked mac and cheese (serves 6): 1 lb elbow macaroni, 2 cups shredded cheddar cheese divided, 3 tbsp butter melted, 2 cups whole milk, 1/4 cup all-purpose flour, 1 tsp paprika."

Output JSON:
{
  "recipeName": "Baked mac and cheese",
  "servings": "6",
  "ingredients": [
    {
      "name": "elbow macaroni",
      "quantity": 1,
      "unit": "lb",
      "notes": null,
      "category": "Pantry"
    },
    {
      "name": "cheddar cheese",
      "quantity": 2,
      "unit": "cup",
      "notes": "shredded, divided",
      "category": "Dairy"
    },
    {
      "name": "butter",
      "quantity": 3,
      "unit": "tbsp",
      "notes": "melted",
      "category": "Dairy"
    },
    {
      "name": "whole milk",
      "quantity": 2,
      "unit": "cup",
      "notes": null,
      "category": "Dairy"
    },
    {
      "name": "all-purpose flour",
      "quantity": 0.25,
      "unit": "cup",
      "notes": null,
      "category": "Pantry"
    },
    {
      "name": "paprika",
      "quantity": 1,
      "unit": "tsp",
      "notes": null,
      "category": "Pantry"
    }
  ]
}

Example 3
Input text:
"This page contains cooking tips and techniques but does not list a recipe ingredient list."

Output JSON:
{
  "recipeName": null,
  "servings": null,
  "ingredients": []
}

Webpage content:
${content}`
}

const mapAnthropicApiError = (
  error: InstanceType<typeof Anthropic.APIError>,
  requestId?: string
): AnthropicClientError => {
  const status = error.status

  if (status === 401) {
    return new AnthropicClientError(
      'Invalid Anthropic API key',
      'authentication_error',
      requestId,
      error
    )
  }

  if (status === 429) {
    return new AnthropicClientError(
      'Anthropic rate limit exceeded',
      'rate_limit_error',
      requestId,
      error
    )
  }

  if (status === 408 || error.message?.toLowerCase().includes('timeout')) {
    return new AnthropicClientError(
      'Anthropic request timed out',
      'timeout_error',
      requestId,
      error
    )
  }

  if (status === 400) {
    return new AnthropicClientError(
      `Invalid request to Anthropic: ${error.message}`,
      'invalid_request_error',
      requestId,
      error
    )
  }

  return new AnthropicClientError(
    `Anthropic API error: ${error.message}`,
    'api_error',
    requestId,
    error
  )
}

export type AnthropicClient = ReturnType<typeof createAnthropicClient>
