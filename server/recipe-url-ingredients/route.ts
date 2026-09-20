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
import { parseAIResponse, AIExtractError, hasIngredients } from './aiExtract.js'
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
 * Helper to build and log error responses with metrics.
 * Used for domain-specific errors where we have rich context.
 */
const createErrorSender = (
  req: Request,
  res: Response,
  metrics: {
    urlHost: string | null
    fetchLatencyMs: number | null
    contentLatencyMs: number | null
    aiLatencyMs: number | null
    tokenUsage: { input: number; output: number } | null
  }
) => {
  const ctx = getRequestContext(req)
  const { requestId, userId, startTime } = ctx

  return (errorCode: RecipeUrlIngredientsErrorCode, message: string) => {
    const totalLatencyMs = Date.now() - startTime
    const logEntry: RequestLogEntry = {
      requestId,
      userId,
      urlHost: metrics.urlHost,
      fetchLatencyMs: metrics.fetchLatencyMs,
      contentLatencyMs: metrics.contentLatencyMs,
      aiLatencyMs: metrics.aiLatencyMs,
      tokenUsage: metrics.tokenUsage,
      totalLatencyMs,
      status: 'error',
      errorCode,
    }
    logRequest(logEntry)
    // Throw to centralized error handler
    throw new RecipeUrlIngredientsError(errorCode, message)
  }
}

/**
 * Main route handler for extracting ingredients from a recipe URL.
 * Wrapped with asyncHandler to ensure errors propagate to Express error middleware.
 */
const extractIngredientsHandler = asyncHandler(async (req: Request, res: Response) => {
  const ctx = getRequestContext(req)
  const { requestId, userId } = ctx

  // Track metrics for logging
  const metrics = {
    urlHost: null as string | null,
    fetchLatencyMs: null as number | null,
    contentLatencyMs: null as number | null,
    aiLatencyMs: null as number | null,
    tokenUsage: null as { input: number; output: number } | null,
  }

  // Error helper that logs metrics then throws to centralized handler
  const sendError = createErrorSender(req, res, metrics)

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
    const logEntry: RequestLogEntry = {
      requestId,
      userId,
      urlHost: metrics.urlHost,
      fetchLatencyMs: metrics.fetchLatencyMs,
      contentLatencyMs: metrics.contentLatencyMs,
      aiLatencyMs: metrics.aiLatencyMs,
      tokenUsage: metrics.tokenUsage,
      totalLatencyMs: Date.now() - ctx.startTime,
      status: 'error',
      errorCode: 'client_disconnected',
    }
    logRequest(logEntry)
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

  const { url: rawUrl } = parsedRequest
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
  // for pages without JSON-LD, which blocks the event loop, so we always time
  // it: an unlogged multi-second parse here was the hidden cost behind imports
  // that blew past the mobile client's timeout.
  const contentTimer = startTimer()
  const contentResult = await extractContent(fetchResult.html, fetchResult.finalUrl)
  metrics.contentLatencyMs = contentTimer.elapsed()
  if (!contentResult.ok) {
    const contentError = contentResult as ContentExtractError
    const errorCode = mapContentErrorCode(contentError.code)
    sendError(errorCode, contentError.message)
    return
  }

  // Skip the most expensive step (the AI round-trip) if the client already left.
  if (bailIfClientGone()) return

  // Call AI to extract ingredients
  let aiResult
  try {
    const client = getAnthropicClient()
    aiResult = await client.extractIngredients(contentResult.content, { requestId })
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
  let parsedExtraction
  try {
    parsedExtraction = parseAIResponse(aiResult)
  } catch (error) {
    if (error instanceof AIExtractError) {
      sendError('parse_failed', error.message)
      return
    }
    sendError('parse_failed', 'Failed to parse AI response')
    return
  }

  // Check if we got any ingredients
  if (!hasIngredients(parsedExtraction.extraction)) {
    sendError('unsupported_content', 'No ingredients found in page')
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
    urlHost: metrics.urlHost,
    fetchLatencyMs: metrics.fetchLatencyMs,
    contentLatencyMs: metrics.contentLatencyMs,
    aiLatencyMs: metrics.aiLatencyMs,
    tokenUsage: metrics.tokenUsage,
    totalLatencyMs,
    status: 'success',
    errorCode: null,
  }
  logRequest(logEntry)

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
