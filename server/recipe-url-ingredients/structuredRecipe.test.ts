import { describe, it, expect } from 'vitest'
import { parseHTML } from 'linkedom'
import {
  cleanMarkupText,
  extractHtmlListRecipe,
  extractStructuredRecipe,
} from './structuredRecipe.js'

const doc = (html: string) => parseHTML(html).document as unknown as Document

const jsonLd = (data: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body></body></html>`

describe('cleanMarkupText', () => {
  it('decodes entities and strips tags', () => {
    expect(cleanMarkupText('1 &amp; &frac12; cups <strong>chile&#39;s</strong>&nbsp;sauce')).toBe(
      "1 & ½ cups chile's sauce"
    )
  })
})

describe('extractStructuredRecipe', () => {
  it('reads a top-level JSON-LD Recipe', () => {
    const recipe = extractStructuredRecipe(
      doc(
        jsonLd({
          '@type': 'Recipe',
          name: 'Pasta',
          recipeYield: 4,
          recipeIngredient: ['2 cups flour', ' ', '3 eggs'],
        })
      )
    )
    expect(recipe).toEqual({
      source: 'json-ld',
      name: 'Pasta',
      servings: '4',
      ingredientLines: ['2 cups flour', '3 eggs'],
    })
  })

  it('finds a Recipe nested under mainEntity with a URL type', () => {
    const recipe = extractStructuredRecipe(
      doc(
        jsonLd({
          '@type': 'WebPage',
          mainEntity: { '@type': ['http://schema.org/Recipe'], recipeIngredient: ['1 egg'] },
        })
      )
    )
    expect(recipe?.ingredientLines).toEqual(['1 egg'])
  })

  it('reads WP Recipe Maker markup when there is no JSON-LD', () => {
    const recipe = extractStructuredRecipe(
      doc(`<html><body><div class="wprm-recipe-container">
        <h2 class="wprm-recipe-name">Soup</h2>
        <ul>
          <li class="wprm-recipe-ingredient">
            <span class="wprm-recipe-ingredient-amount">2</span>
            <span class="wprm-recipe-ingredient-unit">cloves</span>
            <span class="wprm-recipe-ingredient-name">garlic</span>
            <span class="wprm-recipe-ingredient-notes">(minced)</span>
          </li>
          <li class="wprm-recipe-ingredient">
            <span class="wprm-recipe-ingredient-name">salt</span>
          </li>
        </ul>
      </div></body></html>`)
    )
    expect(recipe).toEqual({
      source: 'wprm',
      name: 'Soup',
      servings: null,
      ingredientLines: ['2 cloves garlic, minced', 'salt'],
    })
  })

  it('reads microdata', () => {
    const recipe = extractStructuredRecipe(
      doc(`<html><body><div itemscope itemtype="https://schema.org/Recipe">
        <h1 itemprop="name">Toast</h1>
        <meta itemprop="recipeYield" content="2">
        <li itemprop="recipeIngredient">2 slices bread</li>
        <li itemprop="recipeIngredient">1 tbsp butter</li>
      </div></body></html>`)
    )
    expect(recipe).toEqual({
      source: 'microdata',
      name: 'Toast',
      servings: '2',
      ingredientLines: ['2 slices bread', '1 tbsp butter'],
    })
  })

  it('tolerates raw control characters inside JSON-LD strings', () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"Recipe","recipeIngredient":["1 cup\tchickpeas"],"description":"line one
line two"}</script></head></html>`
    expect(extractStructuredRecipe(doc(html))?.ingredientLines).toEqual(['1 cup chickpeas'])
  })

  it('returns null when there is no structured data', () => {
    expect(extractStructuredRecipe(doc('<html><body><p>hi</p></body></html>'))).toBeNull()
  })
})

describe('extractHtmlListRecipe', () => {
  const page = (body: string) =>
    doc(`<html><head><meta property="og:title" content="Blue Sky Bran Muffins"></head><body>${body}</body></html>`)

  it('reads a <br>-separated ingredient paragraph (old Smitten Kitchen)', () => {
    const recipe = extractHtmlListRecipe(
      page(`
        <p><b>Two years ago:</b> <a href="#">Pizza</a><br /><b>Three years ago:</b> <a href="#">Bread</a></p>
        <p>Yield: 12 muffins</p>
        <p><u>Batter</u><br />1 1/3 cups (315 ml) buttermilk<br />1 large egg<br />1/4 teaspoon table salt<br />Kosher salt, to taste</p>
        <p>Heat oven to 425 degrees F. Whisk 2 cups of flour with the buttermilk until smooth.</p>
      `)
    )
    expect(recipe).toEqual({
      source: 'html-list',
      name: 'Blue Sky Bran Muffins',
      servings: '12 muffins',
      ingredientLines: [
        '1 1/3 cups (315 ml) buttermilk',
        '1 large egg',
        '1/4 teaspoon table salt',
        'Kosher salt, to taste',
      ],
    })
  })

  it('reads a bare <ul> ingredient list', () => {
    const recipe = extractHtmlListRecipe(
      page('<ul><li>2 cups flour</li><li>1 tsp salt</li><li>3 large eggs</li></ul>')
    )
    expect(recipe?.ingredientLines).toEqual(['2 cups flour', '1 tsp salt', '3 large eggs'])
  })

  it('ignores listicles and "years ago" link blocks', () => {
    expect(
      extractHtmlListRecipe(
        page(`
          <ul><li>40+ Thanksgiving Pie Recipes</li><li>30+ Pumpkin Desserts</li><li>25 Side Dishes</li></ul>
          <p>One year ago: Crispy Treats<br />Two years ago: Pasta<br />Three years ago: Salad</p>
        `)
      )
    ).toBeNull()
  })
})
