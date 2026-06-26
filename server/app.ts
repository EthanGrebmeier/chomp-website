import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAccountDeletionRoute } from './account/route.js'
import { accountDeletionErrorHandler } from './account/errors.js'
import { createRecipeUrlIngredientsRoute } from './recipe-url-ingredients/route.js'
import { recipeUrlIngredientsErrorHandler } from './recipe-url-ingredients/errors.js'
import { createShareRoutes } from './shareRoutes.js'

const getPublicPaths = () => {
  const currentFile = fileURLToPath(import.meta.url)
  const currentDir = path.dirname(currentFile)
  const isBuiltServer = currentDir.endsWith(path.join('server', 'dist'))

  if (isBuiltServer) {
    return {
      distPath: path.resolve(currentDir, '../../dist'),
      publicPath: path.resolve(currentDir, '../../public'),
    }
  }

  return {
    distPath: path.resolve(currentDir, '../dist'),
    publicPath: path.resolve(currentDir, '../public'),
  }
}

export const createApp = () => {
  const app = express()
  const { distPath, publicPath } = getPublicPaths()

  // JSON body parser for API routes
  app.use(express.json())

  app.use(express.static(distPath))
  app.use('/.well-known', express.static(path.join(publicPath, '.well-known')))

  app.use(createShareRoutes())

  // Recipe URL ingredients API
  app.post('/api/recipes/ingredients-from-url', ...createRecipeUrlIngredientsRoute())

  // Account deletion API
  app.delete('/api/account', ...createAccountDeletionRoute())

  // Error handler for account API (must be after routes)
  app.use('/api/account', accountDeletionErrorHandler)

  // Error handler for recipe URL ingredients API (must be after routes)
  app.use('/api/recipes', recipeUrlIngredientsErrorHandler)

  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })

  return app
}
