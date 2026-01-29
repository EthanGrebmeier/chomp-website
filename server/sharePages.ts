const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const buildJoinListSharePageHtml = (joinCode: string) => {
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

export const buildRecipeSharePageHtml = (recipeId: string) => {
  const safeRecipeId = escapeHtml(recipeId)
  const title = 'Open this recipe in Chomp'
  const description = 'Import this recipe into the Chomp app.'
  const imageUrl = 'https://chompgrocery.com/og/og-recipe.png'
  const shareUrl = `https://chompgrocery.com/recipes/share/${safeRecipeId}`
  const deepLinkUrl = `chomp://recipes/import/${safeRecipeId}`
  const fallbackUrl = `/recipes/import/${safeRecipeId}`

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
      window.setTimeout(function () {
        window.location.href = ${JSON.stringify(fallbackUrl)}
      }, 2000)
    </script>
  </body>
</html>`
}
