import express from 'express'
import {
  buildJoinListSharePageHtml,
  buildRecipeSharePageHtml,
} from './sharePages.js'

export const createShareRoutes = () => {
  const router = express.Router()

  router.get('/join-list/:joinCode', (req, res) => {
    const { joinCode } = req.params
    res.set('Content-Type', 'text/html')
    res.send(buildJoinListSharePageHtml(joinCode))
  })

  router.get('/recipes/share/:recipeId', (req, res) => {
    const { recipeId } = req.params
    res.set('Content-Type', 'text/html')
    res.send(buildRecipeSharePageHtml(recipeId))
  })

  return router
}
