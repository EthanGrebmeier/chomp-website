import { describe, it, expect } from 'vitest'
import {
  normalizeUnit,
  normalizeIngredientName,
  normalizeNotes,
  normalizeIngredient,
  normalizeRecipeName,
  normalizeServings,
  normalizeExtraction,
} from './normalizeIngredients.js'
import type { AIExtraction, AIIngredient } from './aiExtract.js'

describe('normalizeUnit', () => {
  it('returns null for null input', () => {
    expect(normalizeUnit(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(normalizeUnit('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(normalizeUnit('   ')).toBeNull()
  })

  describe('volume units', () => {
    it('normalizes tablespoon variations to tbsp', () => {
      expect(normalizeUnit('tablespoon')).toBe('tbsp')
      expect(normalizeUnit('Tablespoons')).toBe('tbsp')
      expect(normalizeUnit('TBSP')).toBe('tbsp')
      expect(normalizeUnit('tbs')).toBe('tbsp')
      expect(normalizeUnit('Tb')).toBe('tbsp')
    })

    it('normalizes teaspoon variations to tsp', () => {
      expect(normalizeUnit('teaspoon')).toBe('tsp')
      expect(normalizeUnit('Teaspoons')).toBe('tsp')
      expect(normalizeUnit('TSP')).toBe('tsp')
    })

    it('normalizes cup variations', () => {
      expect(normalizeUnit('cup')).toBe('cup')
      expect(normalizeUnit('cups')).toBe('cup')
      expect(normalizeUnit('Cup')).toBe('cup')
      expect(normalizeUnit('c')).toBe('cup')
    })

    it('normalizes milliliter variations to ml', () => {
      expect(normalizeUnit('milliliter')).toBe('ml')
      expect(normalizeUnit('milliliters')).toBe('ml')
      expect(normalizeUnit('millilitre')).toBe('ml')
      expect(normalizeUnit('ML')).toBe('ml')
    })

    it('normalizes fluid ounce variations', () => {
      expect(normalizeUnit('fluid ounce')).toBe('fl oz')
      expect(normalizeUnit('fluid ounces')).toBe('fl oz')
      expect(normalizeUnit('fl oz')).toBe('fl oz')
      expect(normalizeUnit('floz')).toBe('fl oz')
    })

    it('normalizes liter variations', () => {
      expect(normalizeUnit('liter')).toBe('liter')
      expect(normalizeUnit('liters')).toBe('liter')
      expect(normalizeUnit('litre')).toBe('liter')
      expect(normalizeUnit('litres')).toBe('liter')
      expect(normalizeUnit('L')).toBe('liter')
    })
  })

  describe('weight units', () => {
    it('normalizes pound variations to lb', () => {
      expect(normalizeUnit('pound')).toBe('lb')
      expect(normalizeUnit('pounds')).toBe('lb')
      expect(normalizeUnit('lb')).toBe('lb')
      expect(normalizeUnit('lbs')).toBe('lb')
      expect(normalizeUnit('LB')).toBe('lb')
    })

    it('normalizes ounce variations to oz', () => {
      expect(normalizeUnit('ounce')).toBe('oz')
      expect(normalizeUnit('ounces')).toBe('oz')
      expect(normalizeUnit('oz')).toBe('oz')
      expect(normalizeUnit('OZ')).toBe('oz')
    })

    it('normalizes gram variations to g', () => {
      expect(normalizeUnit('gram')).toBe('g')
      expect(normalizeUnit('grams')).toBe('g')
      expect(normalizeUnit('g')).toBe('g')
      expect(normalizeUnit('G')).toBe('g')
    })

    it('normalizes kilogram variations to kg', () => {
      expect(normalizeUnit('kilogram')).toBe('kg')
      expect(normalizeUnit('kilograms')).toBe('kg')
      expect(normalizeUnit('kg')).toBe('kg')
      expect(normalizeUnit('KG')).toBe('kg')
    })
  })

  describe('count units', () => {
    it('normalizes clove/cloves', () => {
      expect(normalizeUnit('clove')).toBe('clove')
      expect(normalizeUnit('cloves')).toBe('clove')
    })

    it('normalizes piece/pieces', () => {
      expect(normalizeUnit('piece')).toBe('piece')
      expect(normalizeUnit('pieces')).toBe('piece')
    })

    it('normalizes can/cans', () => {
      expect(normalizeUnit('can')).toBe('can')
      expect(normalizeUnit('cans')).toBe('can')
    })

    it('normalizes package variations', () => {
      expect(normalizeUnit('package')).toBe('package')
      expect(normalizeUnit('packages')).toBe('package')
      expect(normalizeUnit('pkg')).toBe('package')
    })

    it('normalizes pinch/pinches and dash/dashes', () => {
      expect(normalizeUnit('pinch')).toBe('pinch')
      expect(normalizeUnit('pinches')).toBe('pinch')
      expect(normalizeUnit('dash')).toBe('dash')
      expect(normalizeUnit('dashes')).toBe('dash')
    })
  })

  it('preserves unknown units as lowercase', () => {
    expect(normalizeUnit('Wedge')).toBe('wedge')
    expect(normalizeUnit('BUNCH')).toBe('bunch')
    expect(normalizeUnit('SomeWeirdUnit')).toBe('someweirdunit')
  })

  it('trims and collapses whitespace', () => {
    expect(normalizeUnit('  tablespoon  ')).toBe('tbsp')
    expect(normalizeUnit('fl    oz')).toBe('fl oz')
  })
})

describe('normalizeIngredientName', () => {
  it('converts to lowercase', () => {
    expect(normalizeIngredientName('Garlic')).toBe('garlic')
    expect(normalizeIngredientName('OLIVE OIL')).toBe('olive oil')
  })

  it('trims whitespace', () => {
    expect(normalizeIngredientName('  garlic  ')).toBe('garlic')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeIngredientName('olive   oil')).toBe('olive oil')
  })

  it('handles mixed case and spacing', () => {
    expect(normalizeIngredientName('  Fresh   Basil   Leaves  ')).toBe('fresh basil leaves')
  })
})

describe('normalizeNotes', () => {
  it('returns null for null input', () => {
    expect(normalizeNotes(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(normalizeNotes('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(normalizeNotes('   ')).toBeNull()
  })

  it('trims whitespace', () => {
    expect(normalizeNotes('  minced  ')).toBe('minced')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeNotes('finely   chopped')).toBe('finely chopped')
  })

  it('preserves case for notes', () => {
    expect(normalizeNotes('Room Temperature')).toBe('Room Temperature')
  })
})

describe('normalizeRecipeName', () => {
  it('returns null for null input', () => {
    expect(normalizeRecipeName(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(normalizeRecipeName('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(normalizeRecipeName('   ')).toBeNull()
  })

  it('trims and collapses whitespace', () => {
    expect(normalizeRecipeName('  Spaghetti   Pomodoro  ')).toBe('Spaghetti Pomodoro')
  })

  it('preserves case', () => {
    expect(normalizeRecipeName('Classic Italian Pasta')).toBe('Classic Italian Pasta')
  })
})

describe('normalizeServings', () => {
  it('returns null for null input', () => {
    expect(normalizeServings(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(normalizeServings('')).toBeNull()
  })

  it('trims whitespace', () => {
    expect(normalizeServings('  4 servings  ')).toBe('4 servings')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeServings('4   to   6')).toBe('4 to 6')
  })
})

describe('normalizeIngredient', () => {
  it('normalizes a complete ingredient', () => {
    const input: AIIngredient = {
      name: '  Garlic  ',
      quantity: 3,
      unit: 'Cloves',
      notes: '  minced  ',
    }

    expect(normalizeIngredient(input)).toEqual({
      name: 'garlic',
      quantity: 3,
      unit: 'clove',
      notes: 'minced',
    })
  })

  it('handles null values', () => {
    const input: AIIngredient = {
      name: 'Salt',
      quantity: null,
      unit: null,
      notes: null,
    }

    expect(normalizeIngredient(input)).toEqual({
      name: 'salt',
      quantity: null,
      unit: null,
      notes: null,
    })
  })

  it('normalizes quantity of 0', () => {
    const input: AIIngredient = {
      name: 'Pepper',
      quantity: 0,
      unit: 'tsp',
      notes: 'to taste',
    }

    expect(normalizeIngredient(input)).toEqual({
      name: 'pepper',
      quantity: 0,
      unit: 'tsp',
      notes: 'to taste',
    })
  })

  it('handles fractional quantities', () => {
    const input: AIIngredient = {
      name: 'Butter',
      quantity: 0.5,
      unit: 'cup',
      notes: 'softened',
    }

    expect(normalizeIngredient(input)).toEqual({
      name: 'butter',
      quantity: 0.5,
      unit: 'cup',
      notes: 'softened',
    })
  })

  it('converts empty string unit to null', () => {
    const input: AIIngredient = {
      name: 'Eggs',
      quantity: 2,
      unit: '',
      notes: 'large',
    }

    expect(normalizeIngredient(input)).toEqual({
      name: 'eggs',
      quantity: 2,
      unit: null,
      notes: 'large',
    })
  })

  it('converts empty string notes to null', () => {
    const input: AIIngredient = {
      name: 'Flour',
      quantity: 2,
      unit: 'cups',
      notes: '',
    }

    expect(normalizeIngredient(input)).toEqual({
      name: 'flour',
      quantity: 2,
      unit: 'cup',
      notes: null,
    })
  })
})

describe('normalizeExtraction', () => {
  it('normalizes a complete extraction', () => {
    const extraction: AIExtraction = {
      recipeName: '  Spaghetti   Pomodoro  ',
      servings: '  4  ',
      ingredients: [
        { name: '  Spaghetti  ', quantity: 12, unit: 'OUNCES', notes: null },
        { name: 'Olive Oil', quantity: 2, unit: 'tablespoons', notes: '  extra virgin  ' },
        { name: '  GARLIC  ', quantity: 3, unit: 'cloves', notes: 'minced' },
      ],
    }

    const result = normalizeExtraction(extraction, 'https://example.com/recipe')

    expect(result).toEqual({
      sourceUrl: 'https://example.com/recipe',
      recipeName: 'Spaghetti Pomodoro',
      servings: '4',
      ingredients: [
        { name: 'spaghetti', quantity: 12, unit: 'oz', notes: null },
        { name: 'olive oil', quantity: 2, unit: 'tbsp', notes: 'extra virgin' },
        { name: 'garlic', quantity: 3, unit: 'clove', notes: 'minced' },
      ],
    })
  })

  it('handles null recipe name and servings', () => {
    const extraction: AIExtraction = {
      recipeName: null,
      servings: null,
      ingredients: [{ name: 'Flour', quantity: 1, unit: 'cup', notes: null }],
    }

    const result = normalizeExtraction(extraction, 'https://example.com')

    expect(result).toEqual({
      sourceUrl: 'https://example.com',
      recipeName: null,
      servings: null,
      ingredients: [{ name: 'flour', quantity: 1, unit: 'cup', notes: null }],
    })
  })

  it('converts empty string recipe name/servings to null', () => {
    const extraction: AIExtraction = {
      recipeName: '   ',
      servings: '',
      ingredients: [{ name: 'Sugar', quantity: 1, unit: 'tbsp', notes: null }],
    }

    const result = normalizeExtraction(extraction, 'https://example.com')

    expect(result).toEqual({
      sourceUrl: 'https://example.com',
      recipeName: null,
      servings: null,
      ingredients: [{ name: 'sugar', quantity: 1, unit: 'tbsp', notes: null }],
    })
  })

  it('handles empty ingredients array', () => {
    const extraction: AIExtraction = {
      recipeName: 'Empty Recipe',
      servings: '4',
      ingredients: [],
    }

    const result = normalizeExtraction(extraction, 'https://example.com')

    expect(result).toEqual({
      sourceUrl: 'https://example.com',
      recipeName: 'Empty Recipe',
      servings: '4',
      ingredients: [],
    })
  })
})
