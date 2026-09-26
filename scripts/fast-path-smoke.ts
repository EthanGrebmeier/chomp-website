/**
 * Live check of the LLM-free parse path against real recipe URLs.
 * Usage: npx tsx scripts/fast-path-smoke.ts <url> [url...]
 */
import { extractContent } from '../server/recipe-url-ingredients/contentExtract.ts'
import { parseIngredientLines } from '../server/recipe-url-ingredients/ingredientParser.ts'
const urls = process.argv.slice(2)
let fast = 0
for (const url of urls) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/124 Safari/537.36', accept: 'text/html' }, signal: AbortSignal.timeout(10000) })
    const html = await res.text()
    const t = Date.now()
    const c = await extractContent(html, url)
    const ms = Date.now() - t
    if (!c.ok || !c.recipe) { console.log(`✗ ${new URL(url).host} status=${res.status} no structured data (${ms}ms)`); continue }
    const p = parseIngredientLines(c.recipe.ingredientLines)
    if (p.ok) fast++
    console.log(`${p.ok ? '✓' : '~'} ${new URL(url).host} [${c.recipe.source}] ${c.recipe.ingredientLines.length} lines (${ms}ms)`)
    if (!p.ok) console.log('   failed:', p.failedLines)
    else for (const i of p.ingredients.slice(0, 20)) console.log('   ', JSON.stringify(i))
  } catch (e) { console.log(`! ${url} ${(e as Error).message}`) }
}
console.log(`\nfast-path eligible: ${fast}/${urls.length}`)
