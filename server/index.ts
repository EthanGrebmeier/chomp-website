import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = Number(process.env.PORT) || 3000

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
  const shareUrl = `https://chompgrocery.com/list/${safeJoinCode}`
  const deepLinkUrl = `chomp://list/${safeJoinCode}`

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

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})
