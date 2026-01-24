import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.js'
import { createRecipeUrlIngredientsRoute } from './recipe-url-ingredients/route.js'
import { recipeUrlIngredientsErrorHandler } from './recipe-url-ingredients/errors.js'

const app = express()
let port = 3000
try {
  const config = loadConfig()
  port = config.port
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
}

// JSON body parser for API routes
app.use(express.json())

const currentFile = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFile)
const distPath = path.resolve(currentDir, '../../dist')
const publicPath = path.resolve(currentDir, '../../public')

app.use(express.static(distPath))
app.use('/.well-known', express.static(path.join(publicPath, '.well-known')))

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const buildSharePageHtml = (joinCode: string) => {
  const safeJoinCode = escapeHtml(joinCode)
  const title = 'Join my Chomp list'
  const description = 'Open this list in the Chomp app.'
  const imageUrl = 'https://chompgrocery.com/og/og-invite.png'
  const shareUrl = `https://chompgrocery.com/join-list/${safeJoinCode}`
  const deepLinkUrl = `chomp://join-list/${safeJoinCode}`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Chomp" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:url" content="${shareUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <meta http-equiv="refresh" content="1; url=${deepLinkUrl}" />
  </head>
  <body>
    <p>Opening Chomp… If nothing happens, <a href="${deepLinkUrl}">tap here</a>.</p>
    <script>
      window.setTimeout(function () {
        window.location.href = ${JSON.stringify(deepLinkUrl)}
      }, 1000)
    </script>
  </body>
</html>`
}

app.get('/join-list/:joinCode', (req, res) => {
  const { joinCode } = req.params
  res.set('Content-Type', 'text/html')
  res.send(buildSharePageHtml(joinCode))
})

// Recipe URL ingredients API
app.post('/api/recipes/ingredients-from-url', ...createRecipeUrlIngredientsRoute())

// Error handler for recipe URL ingredients API (must be after routes)
app.use('/api/recipes', recipeUrlIngredientsErrorHandler)

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})
