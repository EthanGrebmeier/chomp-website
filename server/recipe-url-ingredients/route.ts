import type { RequestHandler } from 'express'
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
import { parseAIResponse, AIExtractError, hasIngredients } from './aiExtract.js'
import { normalizeExtraction } from './normalizeIngredients.js'
import {
  createLoggingMiddleware,
  getRequestContext,
  extractUrlHost,
  startTimer,
  logRequest,
  logError,
  type RequestLogEntry,
} from './logging.js'
import type {
  RecipeUrlIngredientsResponse,
  RecipeUrlIngredientsErrorResponse,
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
 * Builds a standardized error response.
 */
const buildErrorResponse = (
  code: RecipeUrlIngredientsErrorCode,
  message: string
): RecipeUrlIngredientsErrorResponse => ({
  error: { code, message },
})

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
    })
  }
  return anthropicClient
}

/**
 * Main route handler for extracting ingredients from a recipe URL.
 */
const extractIngredientsHandler: RequestHandler = async (req, res) => {
  const ctx = getRequestContext(req)
  const { requestId, userId } = ctx

  // Track metrics for logging
  let urlHost: string | null = null
  let fetchLatencyMs: number | null = null
  let aiLatencyMs: number | null = null
  let tokenUsage: { input: number; output: number } | null = null

  /**
   * Helper to log and send error response.
   */
  const sendError = (
    statusCode: number,
    errorCode: RecipeUrlIngredientsErrorCode,
    message: string
  ) => {
    const totalLatencyMs = Date.now() - ctx.startTime
    const logEntry: RequestLogEntry = {
      requestId,
      userId,
      urlHost,
      fetchLatencyMs,
      aiLatencyMs,
      tokenUsage,
      totalLatencyMs,
      status: 'error',
      errorCode,
    }
    logRequest(logEntry)
    logError(requestId, errorCode, message, { urlHost })
    res.status(statusCode).json(buildErrorResponse(errorCode, message))
  }

  // Parse and validate request body
  let parsedRequest
  try {
    parsedRequest = parseRecipeUrlIngredientsRequest(req.body)
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.errors.map((e) => e.message).join('; ')
      sendError(400, 'invalid_url', message)
      return
    }
    sendError(400, 'invalid_url', 'Invalid request body')
    return
  }

  const { url: rawUrl } = parsedRequest
  urlHost = extractUrlHost(rawUrl)

  // Validate URL structure
  const urlResult = validateUrl(rawUrl)
  if (!urlResult.valid) {
    sendError(400, 'invalid_url', urlResult.reason)
    return
  }
  const url = urlResult.url

  // Fetch HTML from URL
  const fetchTimer = startTimer()
  const fetchResult = await fetchHtml(url)
  fetchLatencyMs = fetchTimer.elapsed()

  if (!fetchResult.ok) {
    const fetchError = fetchResult as HtmlFetchError
    const errorCode = mapFetchErrorCode(fetchError.code)
    const statusCode =
      errorCode === 'fetch_timeout' ? 408 : errorCode === 'content_too_large' ? 413 : 400
    sendError(statusCode, errorCode, fetchError.message)
    return
  }

  // Extract main content from HTML
  const contentResult = extractContent(fetchResult.html, fetchResult.finalUrl)
  if (!contentResult.ok) {
    const contentError = contentResult as ContentExtractError
    const errorCode = mapContentErrorCode(contentError.code)
    sendError(400, errorCode, contentError.message)
    return
  }

  // Call AI to extract ingredients
  let aiResult
  try {
    const client = getAnthropicClient()
    aiResult = await client.extractIngredients(contentResult.content, { requestId })
    aiLatencyMs = aiResult.latencyMs
    tokenUsage = {
      input: aiResult.usage.inputTokens,
      output: aiResult.usage.outputTokens,
    }
  } catch (error) {
    if (error instanceof AnthropicClientError) {
      const errorCode = mapAnthropicErrorCode(error.code)
      const statusCode = errorCode === 'rate_limited' ? 429 : 500
      sendError(statusCode, errorCode, error.message)
      return
    }
    sendError(500, 'server_error', 'AI extraction failed')
    return
  }

  // Parse and validate AI response
  let parsedExtraction
  try {
    parsedExtraction = parseAIResponse(aiResult)
  } catch (error) {
    if (error instanceof AIExtractError) {
      sendError(500, 'parse_failed', error.message)
      return
    }
    sendError(500, 'parse_failed', 'Failed to parse AI response')
    return
  }

  // Check if we got any ingredients
  if (!hasIngredients(parsedExtraction.extraction)) {
    sendError(400, 'unsupported_content', 'No ingredients found in page')
    return
  }

  // Normalize the extraction to final response format
  const response: RecipeUrlIngredientsResponse = normalizeExtraction(
    parsedExtraction.extraction,
    rawUrl
  )

  // Log successful request
  const totalLatencyMs = Date.now() - ctx.startTime
  const logEntry: RequestLogEntry = {
    requestId,
    userId,
    urlHost,
    fetchLatencyMs,
    aiLatencyMs,
    tokenUsage,
    totalLatencyMs,
    status: 'success',
    errorCode: null,
  }
  logRequest(logEntry)

  res.status(200).json(response)
}

/**
 * Creates the middleware stack and handler for the recipe URL ingredients endpoint.
 * Returns an array of handlers to be used with app.post().
 */
export const createRecipeUrlIngredientsRoute = (): RequestHandler[] => {
  return [
    createLoggingMiddleware(),
    ...createClerkAuthMiddleware(),
    createRateLimitMiddleware(),
    extractIngredientsHandler,
  ]
}
