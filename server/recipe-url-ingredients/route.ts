import type { Request, Response, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { loadConfig } from '../config.js'
import { createClerkAuthMiddleware } from './auth.js'
import { createRateLimitMiddleware } from './rateLimit.js'
import { parseRecipeUrlIngredientsRequest } from './schema.js'
import { validateUrl } from './urlValidation.js'
import { fetchHtml, type HtmlFetchError } from './htmlFetch.js'
import { extractContent, type ContentExtractError } from './contentExtract.js'
import {
  createAnthropicClient,
  AnthropicClientError,
  type AnthropicClient,
} from './anthropicClient.js'
import {
  parseAIResponse,
  AIExtractError,
  hasIngredients,
  type AIExtraction,
} from './aiExtract.js'
import { parseIngredientLines } from './ingredientParser.js'
import { createJevCategorizer, type JevCategorizer } from './jevCategorizer.js'
import type { StructuredRecipe } from './structuredRecipe.js'
import type { RecipeCategory } from './categories.js'
import { normalizeExtraction } from './normalizeIngredients.js'
import {
  createLoggingMiddleware,
  getRequestContext,
  extractUrlHost,
  startTimer,
  logRequest,
  type RequestLogEntry,
} from './logging.js'
import {
  RecipeUrlIngredientsError,
  asyncHandler,
} from './errors.js'
import type {
  RecipeUrlIngredientsResponse,
  RecipeUrlIngredientsErrorCode,
} from './types.js'

/**
 * Maps HtmlFetchError codes to API error codes.
 */
const mapFetchErrorCode = (code: string): RecipeUrlIngredientsErrorCode => {
  switch (code) {
    case 'fetch_timeout':
      return 'fetch_timeout'
    case 'content_too_large':
      return 'content_too_large'
    case 'ssrf_blocked':
      return 'invalid_url'
    case 'too_many_redirects':
      return 'fetch_timeout' // treat as timeout-like behavior
    case 'invalid_content_type':
      return 'unsupported_content'
    case 'fetch_failed':
    default:
      return 'server_error'
  }
}

/**
 * Maps ContentExtractError codes to API error codes.
 */
const mapContentErrorCode = (code: string): RecipeUrlIngredientsErrorCode => {
  switch (code) {
    case 'parse_failed':
    case 'no_content':
      return 'unsupported_content'
    default:
      return 'server_error'
  }
}

/**
 * Maps AnthropicClientError codes to API error codes.
 */
const mapAnthropicErrorCode = (code: string): RecipeUrlIngredientsErrorCode => {
  switch (code) {
    case 'rate_limit_error':
      return 'rate_limited'
    case 'timeout_error':
      return 'fetch_timeout'
    case 'authentication_error':
    case 'api_error':
    case 'invalid_request_error':
    case 'unknown_error':
    default:
      return 'server_error'
  }
}

/**
 * Lazy-initialized Anthropic client.
 * Created on first request to avoid config loading at import time.
 */
let anthropicClient: AnthropicClient | null = null

const getAnthropicClient = (): AnthropicClient => {
  if (!anthropicClient) {
    const config = loadConfig()
    anthropicClient = createAnthropicClient({
      apiKey: config.anthropicApiKey,
      model: config.anthropicModel,
      // The mobile client caps a parse at 60s. With the default 30s Anthropic
      // timeout, 2 retries could burn ~90s on the AI step alone and guarantee a
      // client-side timeout. Cap at a single retry so fetch + extract + AI stays
      // within the client budget.
      maxRetries: 1,
    })
  }
  return anthropicClient
}

/**
 * Lazy-initialized Jev categorizer. Null when TYPESAFE_API_KEY isn't configured
 * (or the fast path is disabled), in which case every import uses the LLM.
 */
let jevCategorizer: JevCategorizer | null | undefined

const getJevCategorizer = (): JevCategorizer | null => {
  if (jevCategorizer === undefined) {
    const config = loadConfig()
    jevCategorizer = config.typesafeApiKey
      ? createJevCategorizer({ apiKey: config.typesafeApiKey, model: config.typesafeModel })
      : null
  }
  return jevCategorizer
}

type RequestMetrics = {
  urlHost: string | null
  fetchLatencyMs: number | null
  contentLatencyMs: number | null
  aiLatencyMs: number | null
  extractionPath: 'fast' | 'llm' | null
  structuredSource: string | null
  fastPathFallbackReason: string | null
  categorizeLatencyMs: number | null
  categorizeMinConfidence: number | null
  tokenUsage: { input: number; output: number } | null
}

const buildLogEntry = (
  req: Request,
  metrics: RequestMetrics,
  status: 'success' | 'error',
  errorCode: string | null
): RequestLogEntry => {
  const { requestId, userId, startTime } = getRequestContext(req)
  return {
    requestId,
    userId,
    ...metrics,
    totalLatencyMs: Date.now() - startTime,
    status,
    errorCode,
  }
}

/**
 * Helper to build and log error responses with metrics.
 * Used for domain-specific errors where we have rich context.
 */
const createErrorSender = (req: Request, metrics: RequestMetrics) => {
  return (errorCode: RecipeUrlIngredientsErrorCode, message: string) => {
    logRequest(buildLogEntry(req, metrics, 'error', errorCode))
    // Throw to centralized error handler
    throw new RecipeUrlIngredientsError(errorCode, message)
  }
}

/**
 * Fast path: parse structured ingredient lines in code and categorize with Jev.
 * Returns null (and records why) whenever it can't be confident, so the caller
 * falls back to the full LLM extraction. Never throws.
 */
const tryFastPath = async (
  recipe: StructuredRecipe,
  categories: RecipeCategory[],
  metrics: RequestMetrics
): Promise<AIExtraction | null> => {
  const categorizer = getJevCategorizer()
  if (!categorizer) {
    metrics.fastPathFallbackReason = 'fast_path_disabled'
    return null
  }

  const parsed = parseIngredientLines(recipe.ingredientLines)
  if (!parsed.ok) {
    metrics.fastPathFallbackReason = 'parse_failed'
    return null
  }

  const timer = startTimer()
  try {
    const result = await categorizer.categorize(parsed.ingredients, {
      categories,
      recipeName: recipe.name,
    })
    metrics.categorizeLatencyMs = result.latencyMs
    metrics.categorizeMinConfidence = result.minConfidence
    return {
      recipeName: recipe.name,
      servings: recipe.servings,
      ingredients: parsed.ingredients.map((ingredient, index) => ({
        ...ingredient,
        category: result.categories[index],
      })),
    }
  } catch {
    metrics.categorizeLatencyMs = timer.elapsed()
    metrics.fastPathFallbackReason = 'categorize_failed'
    return null
  }
}

/**
 * Main route handler for extracting ingredients from a recipe URL.
 * Wrapped with asyncHandler to ensure errors propagate to Express error middleware.
 */
const extractIngredientsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { requestId } = getRequestContext(req)

  // Track metrics for logging
  const metrics: RequestMetrics = {
    urlHost: null,
    fetchLatencyMs: null,
    contentLatencyMs: null,
    aiLatencyMs: null,
    extractionPath: null,
    structuredSource: null,
    fastPathFallbackReason: null,
    categorizeLatencyMs: null,
    categorizeMinConfidence: null,
    tokenUsage: null,
  }

  // Error helper that logs metrics then throws to centralized handler
  const sendError = createErrorSender(req, metrics)

  // The mobile client aborts on its own timeout and on every retry, but the
  // HTTP request keeps running here with no way to cancel an in-flight fetch or
  // a synchronous JSDOM parse. On a single-CPU machine those abandoned requests
  // stack up and starve the event loop, which is how a trivial request ends up
  // logging 100s+ of total latency. Track disconnects so we can bail out before
  // starting the next expensive step instead of piling on more work.
  let clientGone = false
  req.on('close', () => {
    if (!res.writableEnded) clientGone = true
  })
  const bailIfClientGone = (): boolean => {
    if (!clientGone) return false
    logRequest(buildLogEntry(req, metrics, 'error', 'client_disconnected'))
    return true
  }

  // Parse and validate request body
  let parsedRequest
  try {
    parsedRequest = parseRecipeUrlIngredientsRequest(req.body)
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map((e) => e.message).join('; ')
      sendError('invalid_url', message)
      return
    }
    sendError('invalid_url', 'Invalid request body')
    return
  }

  const { url: rawUrl, categories } = parsedRequest
  metrics.urlHost = extractUrlHost(rawUrl)

  // Validate URL structure
  const urlResult = validateUrl(rawUrl)
  if (!urlResult.valid) {
    sendError('invalid_url', urlResult.reason)
    return
  }
  const url = urlResult.url

  // Fetch HTML from URL
  const fetchTimer = startTimer()
  const fetchResult = await fetchHtml(url)
  metrics.fetchLatencyMs = fetchTimer.elapsed()

  if (!fetchResult.ok) {
    const fetchError = fetchResult as HtmlFetchError
    const errorCode = mapFetchErrorCode(fetchError.code)
    sendError(errorCode, fetchError.message)
    return
  }

  if (bailIfClientGone()) return

  // Extract main content from HTML. This step runs a synchronous JSDOM parse
  // for pages without structured recipe data, which blocks the event loop, so
  // we always time it: an unlogged multi-second parse here was the hidden cost
  // behind imports that blew past the mobile client's timeout.
  const contentTimer = startTimer()
  const contentResult = await extractContent(fetchResult.html, fetchResult.finalUrl)
  metrics.contentLatencyMs = contentTimer.elapsed()
  if (!contentResult.ok) {
    const contentError = contentResult as ContentExtractError
    const errorCode = mapContentErrorCode(contentError.code)
    sendError(errorCode, contentError.message)
    return
  }

  if (bailIfClientGone()) return

  // Fast path: structured ingredient lines + deterministic parse + Jev.
  let extraction: AIExtraction | null = null
  if (contentResult.recipe) {
    metrics.structuredSource = contentResult.recipe.source
    extraction = await tryFastPath(contentResult.recipe, categories, metrics)
    if (extraction) metrics.extractionPath = 'fast'
    else if (bailIfClientGone()) return
  }

  if (!extraction) {
    metrics.extractionPath = 'llm'

    // Call AI to extract ingredients
    let aiResult
    try {
      const client = getAnthropicClient()
      aiResult = await client.extractIngredients(contentResult.content, {
        requestId,
        categories,
      })
      metrics.aiLatencyMs = aiResult.latencyMs
      metrics.tokenUsage = {
        input: aiResult.usage.inputTokens,
        output: aiResult.usage.outputTokens,
      }
    } catch (error) {
      if (error instanceof AnthropicClientError) {
        const errorCode = mapAnthropicErrorCode(error.code)
        sendError(errorCode, error.message)
        return
      }
      sendError('server_error', 'AI extraction failed')
      return
    }

    // Parse and validate AI response
    try {
      extraction = parseAIResponse(aiResult).extraction
    } catch (error) {
      if (error instanceof AIExtractError) {
        sendError('parse_failed', error.message)
        return
      }
      sendError('parse_failed', 'Failed to parse AI response')
      return
    }
  }

  // Check if we got any ingredients
  if (!hasIngredients(extraction)) {
    sendError('unsupported_content', 'No ingredients found in page')
    return
  }

  // Normalize the extraction to final response format
  const response: RecipeUrlIngredientsResponse = normalizeExtraction(
    extraction,
    rawUrl,
    categories
  )

  logRequest(buildLogEntry(req, metrics, 'success', null))

  res.status(200).json(response)
})

/**
 * Creates the middleware stack and handler for the recipe URL ingredients endpoint.
 * Returns an array of handlers to be used with app.post().
 */
export const createRecipeUrlIngredientsRoute = (): RequestHandler[] => {
  const config = loadConfig()

  return [
    createLoggingMiddleware(),
    ...createClerkAuthMiddleware({ authBypass: config.authBypass }),
    createRateLimitMiddleware(),
    extractIngredientsHandler,
  ]
}
