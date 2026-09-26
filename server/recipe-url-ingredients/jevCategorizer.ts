import { TypeSafeClient, choice, type ChoiceQuestion } from '@typesafe-ai/sdk'
import {
  DEFAULT_CATEGORIES,
  OTHER_CATEGORY_VALUE,
  coerceCategory,
  withOtherCategory,
  type RecipeCategory,
} from './categories.js'

/**
 * Ingredient categorization with TypeSafe's Jev "System One" model.
 *
 * Jev returns a typed choice (plus calibrated probabilities) instead of
 * generated text, typically in well under a second. Questions are evaluated in
 * parallel, so we ask one `choice` question per ingredient in a single call.
 * The answer is constrained to the offered category values by construction.
 */

export type JevCategorizerConfig = {
  apiKey: string
  /** Defaults to the SDK's `jev-latest`. */
  model?: string
  /** Per-attempt timeout. Kept short: on failure we fall back to the LLM path. */
  timeoutMs?: number
  maxRetries?: number
  /** Injectable for tests. */
  client?: Pick<TypeSafeClient, 'systemOne'>
}

export type CategorizeItem = {
  name: string
  notes?: string | null
}

export type CategorizeResult = {
  /** Category value per input item, same order as the input. */
  categories: string[]
  /** Lowest confidence across all answers (for logging / tuning). */
  minConfidence: number | null
  latencyMs: number
  usage: { inputTokens: number; outputTokens: number }
  model: string
}

export class JevCategorizerError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'JevCategorizerError'
  }
}

const DEFAULT_TIMEOUT_MS = 4_000
const DEFAULT_MAX_RETRIES = 1

/** What the built-in category values usually hold (mirrors the LLM prompt). */
const BUILT_IN_HINTS: Record<string, string> = {
  produce: 'fresh fruit, vegetables, fresh herbs',
  deli: 'deli meats, prepared foods, deli-counter cheeses',
  dairy: 'milk, cheese, yogurt, butter, eggs, cream',
  bakery: 'bread, rolls, pastries, tortillas',
  frozen: 'frozen foods',
  beverages: 'drinks, juice, coffee, tea',
  snacks: 'chips, crackers, cookies, candy',
  'health-beauty': 'personal care items',
  household: 'cleaning and household supplies',
  [OTHER_CATEGORY_VALUE]:
    'anything no other category fits: pantry staples, spices, oils, flour, sugar, grains, pasta, canned goods, raw meat and seafood',
}

const DEFAULT_LABELS = new Map(DEFAULT_CATEGORIES.map((c) => [c.value, c.label]))

/**
 * Describe each category for Jev. The user's label is always primary. A
 * built-in hint is only added when the label is unchanged, so a renamed
 * built-in ("produce" shown as "Fruit & Veg") is judged by the user's label.
 */
export const buildCategoryCriteria = (
  categories: readonly RecipeCategory[]
): Record<string, string> => {
  const criteria: Record<string, string> = {}
  for (const { value, label } of categories) {
    const hint = BUILT_IN_HINTS[value]
    const unchanged = DEFAULT_LABELS.get(value) === label
    criteria[value] = hint && unchanged ? `${label}: ${hint}` : label
  }
  return criteria
}

const questionKey = (index: number) => `i${index}`

export const createJevCategorizer = (config: JevCategorizerConfig) => {
  const client =
    config.client ??
    new TypeSafeClient({
      apiKey: config.apiKey,
      defaultModel: config.model,
      timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      retry: { maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES },
      logLevel: 'off',
    })

  const categorize = async (
    items: readonly CategorizeItem[],
    options: { categories?: readonly RecipeCategory[]; recipeName?: string | null } = {}
  ): Promise<CategorizeResult> => {
    const categories = withOtherCategory(options.categories ?? DEFAULT_CATEGORIES)
    const allowed = new Set(categories.map((c) => c.value))
    const criteria = buildCategoryCriteria(categories)
    const startTime = Date.now()

    if (items.length === 0) {
      return {
        categories: [],
        minConfidence: null,
        latencyMs: 0,
        usage: { inputTokens: 0, outputTokens: 0 },
        model: 'none',
      }
    }

    // Ask once per distinct ingredient name.
    const uniqueNames: string[] = []
    const indexByName = new Map<string, number>()
    const itemQuestionIndex = items.map((item) => {
      const key = item.name.trim().toLowerCase()
      let index = indexByName.get(key)
      if (index === undefined) {
        index = uniqueNames.length
        uniqueNames.push(item.name.trim())
        indexByName.set(key, index)
      }
      return index
    })

    const questions: Record<string, ChoiceQuestion<Record<string, string>>> = {}
    uniqueNames.forEach((name, index) => {
      questions[questionKey(index)] = choice(
        {
          question:
            'Which of the shopper\'s grocery categories should this ingredient go in? Choose the most specific category that fits, preferring the shopper\'s own custom categories when they clearly apply.',
          ingredient: name,
        },
        criteria
      )
    })

    let response
    try {
      response = await client.systemOne({
        state: {
          task: 'Sort recipe ingredients onto a grocery shopping list',
          recipe: options.recipeName ?? null,
        },
        questions,
      })
    } catch (error) {
      throw new JevCategorizerError(
        `Jev categorization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      )
    }

    const latencyMs = Date.now() - startTime
    let minConfidence: number | null = null
    const answersByQuestion = uniqueNames.map((_, index) => {
      const answer = response.answers[questionKey(index)]
      if (!answer || answer.type !== 'choice') {
        throw new JevCategorizerError(`Jev response missing answer ${questionKey(index)}`)
      }
      minConfidence =
        minConfidence === null ? answer.confidence : Math.min(minConfidence, answer.confidence)
      return coerceCategory(answer.choice, allowed)
    })

    return {
      categories: itemQuestionIndex.map((index) => answersByQuestion[index]),
      minConfidence,
      latencyMs,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: response.model,
    }
  }

  return { categorize }
}

export type JevCategorizer = ReturnType<typeof createJevCategorizer>
