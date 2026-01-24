export type RecipeUrlIngredientsRequest = {
  url: string
}

export type IngredientCategory =
  | 'Produce'
  | 'Deli'
  | 'Dairy'
  | 'Bakery'
  | 'Frozen'
  | 'Pantry'
  | 'Beverages'
  | 'Snacks'
  | 'Health & Beauty'
  | 'Household'
  | 'Other'

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
