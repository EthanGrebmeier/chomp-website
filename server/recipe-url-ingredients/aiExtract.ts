import { z } from 'zod'
import type { AnthropicExtractionResult } from './anthropicClient.js'

/**
 * Schema for validating the raw AI extraction response.
 * This matches the JSON structure requested in the prompt.
 */
const aiIngredientSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required'),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  notes: z.string().nullable(),
  category: z.enum([
    'Produce',
    'Deli',
    'Dairy',
    'Bakery',
    'Frozen',
    'Pantry',
    'Beverages',
    'Snacks',
    'Health & Beauty',
    'Household',
    'Other',
  ]),
})

const aiExtractionSchema = z.object({
  recipeName: z.string().nullable(),
  servings: z.string().nullable(),
  ingredients: z.array(aiIngredientSchema),
})

export type AIExtraction = z.infer<typeof aiExtractionSchema>
export type AIIngredient = z.infer<typeof aiIngredientSchema>

export type ParsedExtractionResult = {
  extraction: AIExtraction
  usage: {
    inputTokens: number
    outputTokens: number
  }
  model: string
  requestId?: string
  latencyMs: number
}

export type AIExtractErrorCode = 'json_parse_error' | 'schema_validation_error' | 'empty_response'

export class AIExtractError extends Error {
  constructor(
    message: string,
    public readonly code: AIExtractErrorCode,
    public readonly requestId?: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'AIExtractError'
  }
}

/**
 * Parses and validates the raw AI response string.
 * Handles common issues like markdown code blocks around JSON.
 *
 * @param result - The raw extraction result from the Anthropic client
 * @returns Parsed and validated extraction with metadata
 * @throws AIExtractError if parsing or validation fails
 */
export const parseAIResponse = (result: AnthropicExtractionResult): ParsedExtractionResult => {
  const { content, usage, model, requestId, latencyMs } = result

  if (!content || content.trim().length === 0) {
    throw new AIExtractError('AI returned empty response', 'empty_response', requestId)
  }

  // Clean up potential markdown code blocks that AI might include despite instructions
  const cleanedContent = stripMarkdownCodeBlocks(content.trim())

  // Parse JSON
  let parsed: unknown
  try {
    parsed = JSON.parse(cleanedContent)
  } catch (error) {
    throw new AIExtractError(
      `Failed to parse AI response as JSON: ${error instanceof Error ? error.message : 'Unknown parse error'}`,
      'json_parse_error',
      requestId,
      error
    )
  }

  // Validate against schema
  const validationResult = aiExtractionSchema.safeParse(parsed)

  if (!validationResult.success) {
    const issues = validationResult.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')

    throw new AIExtractError(
      `AI response failed schema validation: ${issues}`,
      'schema_validation_error',
      requestId,
      validationResult.error
    )
  }

  return {
    extraction: validationResult.data,
    usage,
    model,
    requestId,
    latencyMs,
  }
}

/**
 * Strips markdown code block delimiters from a string.
 * Handles cases where AI includes ```json ... ``` despite instructions.
 */
const stripMarkdownCodeBlocks = (content: string): string => {
  let result = content

  // Remove leading ```json or ``` and trailing ```
  const codeBlockMatch = result.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (codeBlockMatch) {
    result = codeBlockMatch[1]
  }

  return result.trim()
}

/**
 * Checks if the extraction contains any usable ingredients.
 * Returns false if the ingredients array is empty.
 */
export const hasIngredients = (extraction: AIExtraction): boolean => {
  return extraction.ingredients.length > 0
}
