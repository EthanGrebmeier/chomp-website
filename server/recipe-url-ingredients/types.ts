import type { RecipeCategory } from './categories.js'

export type RecipeUrlIngredientsRequest = {
  url: string
  /** User's categories in display order. Optional for older app builds. */
  categories?: Array<{ value: string; label: string }>
}

/** Request after validation: categories are sanitized and always present. */
export type ParsedRecipeUrlIngredientsRequest = {
  url: string
  categories: RecipeCategory[]
}

/** One of the offered category `value`s, or 'other'. Never a label. */
export type IngredientCategory = string

export type RecipeUrlIngredient = {
  name: string
  quantity: number | null
  unit: string | null
  notes: string | null
  category: IngredientCategory
}

export type RecipeUrlIngredientsResponse = {
  sourceUrl: string
  recipeName: string | null
  servings: string | null
  ingredients: RecipeUrlIngredient[]
}

export type RecipeUrlIngredientsErrorCode =
  | 'invalid_url'
  | 'unsupported_content'
  | 'unauthorized'
  | 'not_found'
  | 'fetch_timeout'
  | 'content_too_large'
  | 'parse_failed'
  | 'rate_limited'
  | 'server_error'

export type RecipeUrlIngredientsErrorResponse = {
  error: {
    code: RecipeUrlIngredientsErrorCode
    message: string
  }
}
