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
        max_tokens: 2048,
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
      const latencyMs = Date.now() - startTime

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
      "notes": "string or null (e.g., 'minced', 'divided')"
    }
  ]
}

Rules:
- Return ONLY the JSON object, no markdown code blocks or explanation
- If no ingredients are found, return an empty ingredients array
- Quantity should be a number (convert fractions: 1/2 = 0.5, 1 1/2 = 1.5)
- Unit should be standardized (tbsp, tsp, cup, oz, lb, g, kg, ml, L, cloves, etc.)
- Include preparation notes in the "notes" field, not in the name

Webpage content:
${content}`
}

const mapAnthropicApiError = (
  error: Anthropic.APIError,
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
