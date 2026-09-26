import { describe, it, expect } from 'vitest'
import { parseIngredientLine, parseIngredientLines } from './ingredientParser.js'

const parse = (line: string) => {
  const result = parseIngredientLine(line)
  if (result.kind !== 'ingredient') throw new Error(`expected ingredient, got ${result.kind}`)
  return result.ingredient
}

describe('parseIngredientLine', () => {
  it.each([
    ['2 cups shredded cheddar cheese, divided', 'cheddar cheese', 2, 'cup', 'shredded, divided'],
    ['3 tablespoons unsalted butter, melted', 'unsalted butter', 3, 'tablespoon', 'melted'],
    ['1/4 cup all-purpose flour', 'all-purpose flour', 0.25, 'cup', null],
    ['½ teaspoon kosher salt', 'kosher salt', 0.5, 'teaspoon', null],
    ['1 ½ cups milk', 'milk', 1.5, 'cup', null],
    ['2-3 cloves garlic, minced', 'garlic', 3, 'clove', 'minced'],
    ['Salt and pepper, to taste', 'Salt and pepper', null, null, 'to taste'],
    ['freshly ground black pepper to taste', 'black pepper', null, null, 'freshly ground, to taste'],
    ['1 large yellow onion, finely chopped', 'yellow onion', 1, 'large', 'finely chopped'],
    ['3 medium carrots, peeled and diced', 'carrots', 3, 'medium', 'peeled and diced'],
    ['1 cup finely chopped fresh parsley', 'fresh parsley', 1, 'cup', 'finely chopped'],
    ['1/2 cup packed light brown sugar', 'light brown sugar', 0.5, 'cup', 'packed'],
    ['1 tablespoon chopped fresh parsley for garnish', 'fresh parsley', 1, 'tablespoon', 'chopped, for garnish'],
    ['1 pound ground beef (80/20)', 'ground beef', 1, 'pound', '80/20'],
    ['1 cup (240ml) heavy cream', 'heavy cream', 1, 'cup', '240ml'],
    ['1 (14.5 oz) can diced tomatoes', 'diced tomatoes', 1, 'can', '14.5 oz'],
    ['2 14-ounce cans coconut milk', 'coconut milk', 2, 'can', '14-ounce'],
    ['1 (400g) tin chickpeas, drained and rinsed', 'chickpeas', 1, 'tin', '400g, drained and rinsed'],
    ['1 small head cauliflower', 'cauliflower', 1, 'head', 'small'],
    ['Juice of 1 lemon', 'lemon', 1, null, 'juice'],
    ['2 cups of flour', 'flour', 2, 'cup', null],
    ['1 cup 2% milk', '2% milk', 1, 'cup', null],
    ['3 slices bacon', 'bacon', 3, 'slice', null],
    ['2 stalks celery, sliced', 'celery', 2, 'stalk', 'sliced'],
    ['1 teaspoon ground cumin', 'ground cumin', 1, 'teaspoon', null],
    ['▢ 2 tablespoons olive oil', 'olive oil', 2, 'tablespoon', null],
    // Real-world lines from NYT, Bon Appétit, RecipeTin Eats, Minimalist Baker, BBC
    ['2 cups minus 2 tablespoons cake flour (8 ½ ounces)', 'cake flour', 2, 'cup', '8 ½ ounces, minus 2 tablespoon'],
    ['1 cup plus 2 tablespoons granulated sugar (8 ounces)', 'granulated sugar', 1, 'cup', '8 ounces, plus 2 tablespoon'],
    ['4 cloves garlic ((minced))', 'garlic', 4, 'clove', 'minced'],
    ['1/2 tsp baking soda / bi-carb ((optional, Note 1))', 'baking soda / bi-carb', 0.5, 'teaspoon', 'optional'],
    ['1 1/2 tbsp light soy sauce ((or all purpose soy(Note 3)))', 'light soy sauce', 1.5, 'tablespoon', 'or all purpose soy'],
    ['12 ounces spaghetti pasta**', 'spaghetti pasta', 12, 'ounce', null],
    ['1 tbsp sunflower or vegetable oil, plus a little extra for frying', 'sunflower or vegetable oil', 1, 'tablespoon', 'plus a little extra for frying'],
    ['225g/8oz plain flour', 'plain flour', 225, 'gram', '8oz'],
    ['125ml/4½fl oz vegetable oil', 'vegetable oil', 125, 'milliliter', '4½fl oz'],
    ['4 tablespoons (57g) melted butter or 1/4 cup (50g) vegetable oil', 'butter', 4, 'tablespoon', 'melted, 57g, or 1/4 cup 50g vegetable oil'],
    ['4 (6- to 8-oz.) boneless, skinless chicken breasts', 'boneless skinless chicken breasts', 4, null, '6- to 8-oz.'],
    ['1 lb boneless, skinless chicken breast ($5.47)', 'boneless skinless chicken breast', 1, 'pound', null],
    ['2 cups diced peeled potatoes', 'potatoes', 2, 'cup', 'diced peeled'],
    ['3 green onions sliced ($0.25)', 'green onions', 3, null, 'sliced'],
    ['4 sheets refrigerated pie crust', 'refrigerated pie crust', 4, 'sheet', null],
    ['Toppings as desired', 'Toppings', null, null, 'as desired'],
    ['lemon wedges to serve (optional)', 'lemon wedges', null, null, 'to serve, optional'],
  ])('%s', (line, name, quantity, unit, notes) => {
    expect(parse(line)).toEqual({ name, quantity, unit, notes })
  })

  it('treats section headers as headers', () => {
    expect(parseIngredientLine('For the sauce:').kind).toBe('header')
  })

  it('rejects lines whose name still contains measurements', () => {
    expect(parseIngredientLine('2 cups 1 1/2 inch cubes of 3 day old bread').kind).toBe('invalid')
  })

  it('keeps the first of two alternatives that each carry an amount', () => {
    expect(
      parse('1¼ tsp. (4 g) Diamond Crystal or ¾ tsp. (4 g) Morton kosher salt')
    ).toEqual({
      name: 'Diamond Crystal',
      quantity: 1.25,
      unit: 'teaspoon',
      notes: '4 g, or ¾ tsp. 4 g Morton kosher salt',
    })
  })

  it('rejects a measurement leaking into the name', () => {
    expect(parseIngredientLine('1 cup flour ¾ tsp salt').kind).toBe('invalid')
  })

  it('rejects prose masquerading as an ingredient', () => {
    expect(
      parseIngredientLine(
        'Combine everything in a large bowl and mix until it is smooth and glossy and fully combined'
      ).kind
    ).toBe('invalid')
  })
})

describe('parseIngredientLines', () => {
  it('drops headers and returns ingredients', () => {
    const result = parseIngredientLines(['For the dough:', '2 cups flour', '1 tsp salt'])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.ingredients.map((i) => i.name)).toEqual(['flour', 'salt'])
  })

  it('fails the whole recipe if any line is invalid', () => {
    const result = parseIngredientLines(['2 cups flour', '2 cups 1 1/2 inch cubes of bread'])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.failedLines).toEqual(['2 cups 1 1/2 inch cubes of bread'])
  })

  it('fails when there are no ingredients', () => {
    expect(parseIngredientLines(['For the dough:']).ok).toBe(false)
  })
})
