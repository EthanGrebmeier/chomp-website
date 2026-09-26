/**
 * Runs real recipe URLs through the LLM-free pipeline (production fetch ->
 * structured extraction -> deterministic parse -> normalization) and writes the
 * JSON output. No categorization and no LLM calls.
 *
 * Usage: npx tsx scripts/fast-path-examples.ts [outFile] < urls.txt
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchHtml } from '../server/recipe-url-ingredients/htmlFetch.js'
import { extractContent } from '../server/recipe-url-ingredients/contentExtract.js'
import { parseIngredientLines } from '../server/recipe-url-ingredients/ingredientParser.js'
import {
  normalizeIngredientName,
  normalizeNotes,
  normalizeUnit,
  normalizeRecipeName,
  normalizeServings,
} from '../server/recipe-url-ingredients/normalizeIngredients.js'

const outFile = process.argv[2] ?? 'fast-path-examples.json'
const urls = readFileSync(0, 'utf8')
  .split('\n')
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith('#'))

type Outcome =
  | { url: string; status: 'fast_path'; source: string; timingsMs: object; result: object }
  | { url: string; status: 'would_fallback_to_llm'; reason: string; source?: string; failedLines?: string[] }
  | { url: string; status: 'fetch_failed'; reason: string }

const results: Outcome[] = []

for (const url of urls) {
  const fetchStart = Date.now()
  const fetched = await fetchHtml(new URL(url))
  const fetchMs = Date.now() - fetchStart
  if (!fetched.ok) {
    results.push({ url, status: 'fetch_failed', reason: `${fetched.code}: ${fetched.message}` })
    console.log(`✗ fetch   ${url} (${fetched.code})`)
    continue
  }

  const extractStart = Date.now()
  const content = await extractContent(fetched.html, fetched.finalUrl)
  const recipe = content.ok ? content.recipe : null
  if (!recipe) {
    results.push({ url, status: 'would_fallback_to_llm', reason: 'no structured recipe data' })
    console.log(`~ no data ${url}`)
    continue
  }

  const parsed = parseIngredientLines(recipe.ingredientLines)
  const parseMs = Date.now() - extractStart
  if (!parsed.ok) {
    results.push({
      url,
      status: 'would_fallback_to_llm',
      source: recipe.source,
      reason: parsed.reason,
      failedLines: parsed.failedLines,
    })
    console.log(`~ parse   ${url} (${parsed.failedLines.length} bad lines)`)
    continue
  }

  results.push({
    url,
    status: 'fast_path',
    source: recipe.source,
    timingsMs: { fetch: fetchMs, extractAndParse: parseMs },
    result: {
      sourceUrl: url,
      recipeName: normalizeRecipeName(recipe.name),
      servings: normalizeServings(recipe.servings),
      ingredients: parsed.ingredients.map((i) => ({
        name: normalizeIngredientName(i.name),
        quantity: i.quantity,
        unit: normalizeUnit(i.unit),
        notes: normalizeNotes(i.notes),
      })),
    },
  })
  console.log(`✓ ${recipe.source.padEnd(9)} ${url} (${parsed.ingredients.length} ingredients, ${parseMs}ms)`)
}

writeFileSync(outFile, JSON.stringify(results, null, 2))
const count = (s: string) => results.filter((r) => r.status === s).length
console.log(
  `\n${count('fast_path')} fast path, ${count('would_fallback_to_llm')} would fall back, ${count('fetch_failed')} fetch failed -> ${outFile}`
)
