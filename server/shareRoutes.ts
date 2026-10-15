import express from 'express'
import { loadConfig } from './config.js'
import { buildJoinListSharePageHtml, buildRecipeSharePageHtml } from './sharePages.js'
import {
  createInstantRecipePreviewLoader,
  type RecipePreview,
  type RecipePreviewLoader,
} from './share/recipePreview.js'

/** Link preview crawlers give up quickly, so never block the page on Instant for long. */
const RECIPE_PREVIEW_TIMEOUT_MS = 2000

type ShareRoutesOptions = {
  /** Pass `null` to disable recipe previews (e.g. when Instant is not configured). */
  recipePreviewLoader?: RecipePreviewLoader | null
}

const createDefaultRecipePreviewLoader = (): RecipePreviewLoader | null => {
  const { instantAppId, instantAdminToken } = loadConfig()
  if (!instantAppId || !instantAdminToken) {
    return null
  }
  return createInstantRecipePreviewLoader(instantAppId, instantAdminToken)
}

const loadRecipePreviewSafely = async (
  loader: RecipePreviewLoader | null,
  recipeId: string,
): Promise<RecipePreview | null> => {
  if (!loader) {
    return null
  }

  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      loader(recipeId),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), RECIPE_PREVIEW_TIMEOUT_MS)
      }),
    ])
  } catch (error) {
    // The share page still works without a preview, so degrade to generic copy.
    console.warn('Failed to load recipe share preview', { recipeId, error })
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export const createShareRoutes = (options: ShareRoutesOptions = {}) => {
  const router = express.Router()
  const recipePreviewLoader =
    options.recipePreviewLoader === undefined
      ? createDefaultRecipePreviewLoader()
      : options.recipePreviewLoader

  router.get('/join-list/:joinCode', (req, res) => {
    const { joinCode } = req.params
    res.set('Content-Type', 'text/html')
    res.send(buildJoinListSharePageHtml(joinCode))
  })

  router.get('/recipes/share/:recipeId', async (req, res) => {
    const { recipeId } = req.params
    const preview = await loadRecipePreviewSafely(recipePreviewLoader, recipeId)
    res.set('Content-Type', 'text/html')
    res.send(buildRecipeSharePageHtml(recipeId, preview))
  })

  return router
}
