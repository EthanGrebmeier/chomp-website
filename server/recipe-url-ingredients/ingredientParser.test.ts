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
    // Hardening run: Smitten Kitchen, NYT, RecipeTin, Sally's, Food Network, Jamie Oliver, BBC, KAB...
    ['2 medium eggplants [1 pound each or 2 pounds total)', 'eggplants', 2, 'medium', '1 pound each or 2 pounds total'],
    ['4 tablespoons (55 grams or 2 ounces) unsalted butter, softened', 'unsalted butter', 4, 'tablespoon', '55 grams or 2 ounces, softened'],
    ['½ cup/120 milliliters vegetable oil', 'vegetable oil', 0.5, 'cup', '120 milliliters'],
    ['½ packed cup/110 grams light brown sugar', 'light brown sugar', 0.5, 'cup', 'packed, 110 grams'],
    ['1/4 cup / 65 ml warm water', 'warm water', 0.25, 'cup', '65 ml'],
    ['400 g / 14 oz / 4 cups shredded mozzarella cheese', 'mozzarella cheese', 400, 'gram', 'shredded, 14 oz, 4 cups'],
    ['1.5 litres/2½ pints vegetable stock', 'vegetable stock', 1.5, 'liter', '2½ pints'],
    ['5cm/2in piece fresh root ginger, peeled and chopped', 'fresh root ginger', 1, 'piece', '5 centimeter, 2in, peeled and chopped'],
    ['1 and 1/2 teaspoons ground cinnamon', 'ground cinnamon', 1.5, 'teaspoon', null],
    ['One 8-ounce package cream cheese, at room temperature', 'cream cheese', 1, 'package', '8-ounce, at room temperature'],
    ['Two 28-ounce cans diced tomatoes', 'diced tomatoes', 2, 'can', '28-ounce'],
    ['One 3- to 5-pound chuck roast', 'chuck roast', 1, null, '3- to 5-pound'],
    ['2 x 400g tins of quality plum tomatoes', 'quality plum tomatoes', 2, 'tin', '400g'],
    ['400g can black beans drained', 'black beans', 1, 'can', 'drained, 400 gram'],
    ['15- ounce can pumpkin puree', 'pumpkin puree', 1, 'can', '15-ounce'],
    ['10-to-12-ounce (285-to-340-gram) bag semisweet chocolate chips', 'semisweet chocolate chips', 1, 'bag', '285-to-340-gram, 10-to-12-ounce'],
    ['A 250-gram or 8.8-ounce package dried thin egg noodles', 'dried thin egg noodles', 1, 'package', '8.8-ounce, 250-gram'],
    ['half an 8-ounce package (113g) cream cheese', 'cream cheese', 0.5, 'package', '113g, 8-ounce'],
    ['1 3" piece ginger, peeled', 'ginger', 1, 'piece', '3", peeled'],
    ['15 6-inch corn tortillas ($1.37)', 'corn tortillas', 15, null, '6-inch'],
    ['1/4 + 1/8 teaspoon baking soda', 'baking soda', 0.375, 'teaspoon', null],
    ['Scant ¼ teaspoon cayenne pepper (optional)', 'cayenne pepper', 0.25, 'teaspoon', 'scant, optional'],
    ['~1/2 tsp salt', 'salt', 0.5, 'teaspoon', 'about'],
    ['2 or so teaspoons saffron', 'saffron', 2, 'teaspoon', 'about'],
    ['optional: 1/4 cup (28g) ground flaxseed', 'ground flaxseed', 0.25, 'cup', 'optional, 28g'],
    ['(optional) 2 teaspoons dried marjoram', 'dried marjoram', 2, 'teaspoon', 'optional'],
    ['a pinch of salt', 'salt', 1, 'pinch', null],
    ['a few sprigs thyme', 'thyme', null, null, 'a few sprigs'],
    ['1 large, ripe mango', 'ripe mango', 1, 'large', null],
    ['1 large or 2 medium eggplants', 'eggplants', 1, 'large', 'or 2 medium'],
    ['2 lb 80/20 ground beef', '80/20 ground beef', 2, 'pound', null],
    ['1 ½ cups 00 flour', '00 flour', 1.5, 'cup', null],
    ['½ pound 93% ground turkey', '93% ground turkey', 0.5, 'pound', null],
    ['7 ounces (200g) of 60-70% dark chocolate', '60-70% dark chocolate', 7, 'ounce', '200g'],
    ['16 ounces 90% or 93% lean ground turkey', '90% or 93% lean ground turkey', 16, 'ounce', null],
    ['1 ½ cups white whole wheat flour or regular whole wheat flour', 'white whole wheat flour', 1.5, 'cup', 'or regular whole wheat flour'],
    ['6 makrut (Thai) lime leaves or zest of 2 limes', 'makrut lime leaves', 6, null, 'Thai, or zest of 2 limes'],
    ['1 large aubergine sliced lengthways into ½cm slices', 'aubergine', 1, 'large', 'sliced lengthways into ½cm slices'],
    ['1 red pepper deseeded and sliced', 'red pepper', 1, null, 'deseeded and sliced'],
    ['2 large skinless chicken breasts cut into strips', 'skinless chicken breasts', 2, 'large', 'cut into strips'],
    ['Finely grated zest from 1 medium orange', 'orange', 1, 'medium', 'zest, Finely grated'],
    ['Seeds scraped from ½ vanilla bean', 'vanilla bean', 0.5, null, 'seeds scraped'],
    ['Kernels cut from 2 ears of corn', 'corn', 2, 'ear', 'kernels cut'],
    ['1 gigantic sweet potato - to cut into steaks', 'gigantic sweet potato', 1, null, 'to cut into steaks'],
    ['3 g (1 teaspoon) Diamond Crystal kosher salt; for table salt, use half', 'Diamond Crystal kosher salt', 3, 'gram', '1 teaspoon, for table salt, use half'],
    ['5 extra-large egg whites (I used 6 since I was using', 'extra-large egg whites', 5, null, 'I used 6 since I was using'],
    ['1 can (15 oz chicken broth)', 'chicken broth', 1, 'can', '15 ounce'],
    ['2 thin slices deli ham', 'deli ham', 2, 'slice', 'thin'],
    ['4 rashers of smoked streaky bacon', 'smoked streaky bacon', 4, 'rasher', null],
    ['3 to 4 cups shredded or thinly ribboned Swiss chard', 'Swiss chard', 4, 'cup', 'shredded, or thinly ribboned'],
    ['1/2 cup pitted and rough-chopped olives', 'olives', 0.5, 'cup', 'pitted and rough-chopped'],
    ['A pinch or two of ground cloves', 'ground cloves', 1, 'pinch', 'or two'],
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

  it('treats equipment and all-caps sub-recipe titles as headers', () => {
    expect(parseIngredientLine('Special equipment: 2" leaf cookie cutters').kind).toBe('header')
    expect(parseIngredientLine('STEAMED ASPARAGUS & QUICK TOMATO SAUCE').kind).toBe('header')
  })

  it('rejects names left over from a bad split', () => {
    expect(parseIngredientLine('3 cups large or 4 small ripe bananas').kind).toBe('invalid')
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
    const result = parseIngredientLines(['2 cups flour', '1 cup sugar ¾ tsp salt'])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.failedLines).toEqual(['1 cup sugar ¾ tsp salt'])
  })

  it('splits two ingredients joined with +', () => {
    const result = parseIngredientLines(['1 large egg + 1 egg yolk, at room temperature'])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.ingredients.map((i) => i.name)).toEqual(['egg', 'egg yolk'])
  })

  it('fails when there are no ingredients', () => {
    expect(parseIngredientLines(['For the dough:']).ok).toBe(false)
  })
})
