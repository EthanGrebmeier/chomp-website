import type { AIExtraction, AIIngredient } from './aiExtract.js'
import type { RecipeUrlIngredient, RecipeUrlIngredientsResponse } from './types.js'

/**
 * Common unit abbreviation mappings to standardize output.
 * Maps various forms to a canonical lowercase abbreviation.
 */
const UNIT_MAPPINGS: Record<string, string> = {
  // Volume
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbsp: 'tbsp',
  tbs: 'tbsp',
  tb: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tsp: 'tsp',
  cup: 'cup',
  cups: 'cup',
  c: 'cup',
  pint: 'pint',
  pints: 'pint',
  pt: 'pint',
  quart: 'quart',
  quarts: 'quart',
  qt: 'quart',
  gallon: 'gallon',
  gallons: 'gallon',
  gal: 'gallon',
  liter: 'liter',
  liters: 'liter',
  litre: 'liter',
  litres: 'liter',
  l: 'liter',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  ml: 'ml',
  'fluid ounce': 'fl oz',
  'fluid ounces': 'fl oz',
  'fl oz': 'fl oz',
  floz: 'fl oz',

  // Weight
  pound: 'lb',
  pounds: 'lb',
  lb: 'lb',
  lbs: 'lb',
  ounce: 'oz',
  ounces: 'oz',
  oz: 'oz',
  gram: 'g',
  grams: 'g',
  g: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  kg: 'kg',

  // Count
  clove: 'clove',
  cloves: 'clove',
  piece: 'piece',
  pieces: 'piece',
  slice: 'slice',
  slices: 'slice',
  can: 'can',
  cans: 'can',
  package: 'package',
  packages: 'package',
  pkg: 'package',
  bunch: 'bunch',
  bunches: 'bunch',
  head: 'head',
  heads: 'head',
  sprig: 'sprig',
  sprigs: 'sprig',
  stalk: 'stalk',
  stalks: 'stalk',
  stick: 'stick',
  sticks: 'stick',
  dash: 'dash',
  dashes: 'dash',
  pinch: 'pinch',
  pinches: 'pinch',
  handful: 'handful',
  handfuls: 'handful',

  // Size descriptors (when used as units)
  small: 'small',
  medium: 'medium',
  large: 'large',
}

/**
 * Normalizes whitespace in a string.
 * Trims leading/trailing whitespace and collapses multiple spaces to single space.
 */
const normalizeWhitespace = (value: string): string => {
  return value.trim().replace(/\s+/g, ' ')
}

/**
 * Normalizes a unit string to a canonical lowercase form.
 * Returns null if input is null or empty after normalization.
 */
export const normalizeUnit = (unit: string | null): string | null => {
  if (unit === null) {
    return null
  }

  const cleaned = normalizeWhitespace(unit.toLowerCase())

  if (cleaned.length === 0) {
    return null
  }

  // Look up in unit mappings, fall back to cleaned value
  return UNIT_MAPPINGS[cleaned] ?? cleaned
}

/**
 * Normalizes an ingredient name.
 * Trims whitespace, collapses multiple spaces, and converts to lowercase.
 */
export const normalizeIngredientName = (name: string): string => {
  return normalizeWhitespace(name).toLowerCase()
}

/**
 * Normalizes a notes string.
 * Returns null if input is null or empty after normalization.
 */
export const normalizeNotes = (notes: string | null): string | null => {
  if (notes === null) {
    return null
  }

  const cleaned = normalizeWhitespace(notes)
  return cleaned.length === 0 ? null : cleaned
}

/**
 * Normalizes a single ingredient from AI extraction.
 */
export const normalizeIngredient = (ingredient: AIIngredient): RecipeUrlIngredient => {
  return {
    name: normalizeIngredientName(ingredient.name),
    quantity: ingredient.quantity,
    unit: normalizeUnit(ingredient.unit),
    notes: normalizeNotes(ingredient.notes),
  }
}

/**
 * Normalizes the recipe name.
 * Returns null if input is null or empty after normalization.
 */
export const normalizeRecipeName = (name: string | null): string | null => {
  if (name === null) {
    return null
  }

  const cleaned = normalizeWhitespace(name)
  return cleaned.length === 0 ? null : cleaned
}

/**
 * Normalizes the servings string.
 * Returns null if input is null or empty after normalization.
 */
export const normalizeServings = (servings: string | null): string | null => {
  if (servings === null) {
    return null
  }

  const cleaned = normalizeWhitespace(servings)
  return cleaned.length === 0 ? null : cleaned
}

/**
 * Normalizes a complete AI extraction into the final response format.
 * Applies whitespace normalization, unit standardization, and lowercase ingredient names.
 *
 * @param extraction - The raw AI extraction result
 * @param sourceUrl - The original URL that was parsed
 * @returns Normalized response ready for the API
 */
export const normalizeExtraction = (
  extraction: AIExtraction,
  sourceUrl: string
): RecipeUrlIngredientsResponse => {
  return {
    sourceUrl,
    recipeName: normalizeRecipeName(extraction.recipeName),
    servings: normalizeServings(extraction.servings),
    ingredients: extraction.ingredients.map(normalizeIngredient),
  }
}
