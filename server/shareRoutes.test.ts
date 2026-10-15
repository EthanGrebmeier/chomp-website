import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createShareRoutes } from './shareRoutes.js'
import type { RecipePreviewLoader } from './share/recipePreview.js'

const createApp = (recipePreviewLoader: RecipePreviewLoader | null) => {
  const app = express()
  app.use(createShareRoutes({ recipePreviewLoader }))
  return app
}

describe('GET /recipes/share/:recipeId', () => {
  it('describes the shared recipe in link previews and on the page', async () => {
    const loader = vi.fn<RecipePreviewLoader>().mockResolvedValue({
      name: 'Mac & Cheese <Deluxe>',
      ingredientCount: 7,
    })

    const response = await request(createApp(loader)).get('/recipes/share/recipe-123')

    expect(loader).toHaveBeenCalledWith('recipe-123')
    expect(response.status).toBe(200)
    expect(response.text).toContain(
      '<meta property="og:title" content="Mac &amp; Cheese &lt;Deluxe&gt; · Chomp recipe" />',
    )
    expect(response.text).toContain('7 ingredients')
    expect(response.text).toContain('href="chomp://recipes/import/recipe-123"')
    expect(response.text).not.toContain('<Deluxe>')
  })

  it('does not auto-redirect to the custom scheme', async () => {
    const response = await request(createApp(null)).get('/recipes/share/recipe-123')

    expect(response.text).not.toContain('http-equiv="refresh"')
    expect(response.text).not.toContain('window.location')
  })

  it('falls back to generic copy when the recipe cannot be loaded', async () => {
    const loader = vi.fn<RecipePreviewLoader>().mockRejectedValue(new Error('instant down'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const response = await request(createApp(loader)).get('/recipes/share/recipe-123')

    expect(response.status).toBe(200)
    expect(response.text).toContain('A recipe shared with you on Chomp')
  })
})
