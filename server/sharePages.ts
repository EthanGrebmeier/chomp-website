import type { RecipePreview } from './share/recipePreview.js'

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

const APP_STORE_URL = 'https://apps.apple.com/us/app/chomp-grocery-meal-planning/id6754225714'

const formatIngredientCount = (count: number) =>
  `${count} ${count === 1 ? 'ingredient' : 'ingredients'}`

export const buildRecipeSharePageHtml = (
  recipeId: string,
  preview: RecipePreview | null = null,
) => {
  const safeRecipeId = escapeHtml(encodeURIComponent(recipeId))
  const recipeName = preview ? escapeHtml(preview.name) : null
  const ingredientSummary =
    preview && preview.ingredientCount > 0 ? formatIngredientCount(preview.ingredientCount) : null

  const title = recipeName ? `${recipeName} · Chomp recipe` : 'A recipe shared with you on Chomp'
  const description = [
    ingredientSummary,
    'Open in Chomp to save it and add the ingredients to your grocery list.',
  ]
    .filter(Boolean)
    .join(' · ')
  const heading = recipeName ?? 'A recipe was shared with you'
  const imageUrl = 'https://chompgrocery.com/og/og-recipe.png'
  const shareUrl = `https://chompgrocery.com/recipes/share/${safeRecipeId}`
  const deepLinkUrl = `chomp://recipes/import/${safeRecipeId}`

  // No automatic redirect to the custom scheme: when the app isn't installed
  // iOS shows an "address is invalid" error. Installed apps open via
  // universal links before this page loads; the button covers in-app browsers.
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
    <meta name="apple-itunes-app" content="app-id=6754225714, app-argument=${shareUrl}" />
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: 24px;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        -webkit-font-smoothing: antialiased;
        background: Canvas;
        color: CanvasText;
      }
      main { width: 100%; max-width: 360px; text-align: center; }
      .eyebrow { margin: 0 0 8px; font-size: 14px; opacity: 0.6; }
      h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.2; text-wrap: balance; overflow-wrap: anywhere; }
      .summary { margin: 0 0 32px; font-size: 16px; opacity: 0.7; text-wrap: pretty; }
      a.button {
        display: block;
        padding: 14px 20px;
        border-radius: 14px;
        font-size: 17px;
        font-weight: 600;
        text-decoration: none;
        -webkit-tap-highlight-color: transparent;
      }
      a.primary { background: CanvasText; color: Canvas; }
      a.secondary { margin-top: 12px; color: inherit; opacity: 0.7; }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Shared from Chomp</p>
      <h1>${heading}</h1>
      <p class="summary">${description}</p>
      <a class="button primary" href="${deepLinkUrl}">Open in Chomp</a>
      <a class="button secondary" href="${APP_STORE_URL}">Don’t have Chomp? Get it on the App Store</a>
    </main>
  </body>
</html>`
}
