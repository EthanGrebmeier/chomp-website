import { init } from '@instantdb/admin'

/** The subset of a recipe shown in link previews and on the share page. */
export type RecipePreview = {
  name: string
  ingredientCount: number
}

export type RecipePreviewLoader = (recipeId: string) => Promise<RecipePreview | null>

type RecipePreviewQueryResult = {
  recipes?: {
    name?: string
    recipe_ingredients?: unknown[]
  }[]
}

/**
 * Loads recipe details with admin credentials so a shared link can preview
 * the recipe even though recipes are private by default. The recipe id in the
 * share URL is the capability: only someone the owner sent it to has it.
 */
export const createInstantRecipePreviewLoader = (
  appId: string,
  adminToken: string,
): RecipePreviewLoader => {
  const db = init({ appId, adminToken })

  return async (recipeId) => {
    const result = (await db.query({
      recipes: {
        $: { where: { id: recipeId } },
        recipe_ingredients: {},
      },
    })) as RecipePreviewQueryResult

    const recipe = result.recipes?.[0]
    const name = recipe?.name?.trim()
    if (!recipe || !name) {
      return null
    }

    return {
      name,
      ingredientCount: recipe.recipe_ingredients?.length ?? 0,
    }
  }
}
