import { z } from 'zod'
import type { ParsedRecipeUrlIngredientsRequest } from './types.js'
import { sanitizeCategories } from './categories.js'

const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const urlSchema = z
  .string()
  .trim()
  .min(1, 'URL is required')
  .refine(isHttpUrl, { message: 'URL must be http(s) and publicly reachable.' })

export const recipeUrlIngredientsRequestSchema = z.object({
  url: urlSchema,
  // Never rejected: bad category input is cleaned up (or replaced with the
  // defaults) by sanitizeCategories so it can't fail an import.
  categories: z.unknown().transform(sanitizeCategories),
})

export const ingredientCategorySchema = z.string().min(1)

export const recipeUrlIngredientSchema = z.object({
  name: z.string().trim().min(1, 'Ingredient name is required'),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  notes: z.string().nullable(),
  category: ingredientCategorySchema,
})

export const recipeUrlIngredientsResponseSchema = z.object({
  sourceUrl: urlSchema,
  recipeName: z.string().nullable(),
  servings: z.string().nullable(),
  ingredients: z.array(recipeUrlIngredientSchema),
})

export const recipeUrlIngredientsErrorCodeSchema = z.enum([
  'invalid_url',
  'unsupported_content',
  'unauthorized',
  'not_found',
  'fetch_timeout',
  'content_too_large',
  'parse_failed',
  'rate_limited',
  'server_error',
])

export const recipeUrlIngredientsErrorResponseSchema = z.object({
  error: z.object({
    code: recipeUrlIngredientsErrorCodeSchema,
    message: z.string().min(1),
  }),
})

export const parseRecipeUrlIngredientsRequest = (
  input: unknown,
): ParsedRecipeUrlIngredientsRequest => recipeUrlIngredientsRequestSchema.parse(input)
