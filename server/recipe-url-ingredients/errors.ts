import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express'
import type {
  RecipeUrlIngredientsErrorCode,
  RecipeUrlIngredientsErrorResponse,
} from './types.js'
import { getRequestContext, logError } from './logging.js'

/**
 * HTTP status codes mapped to error codes.
 */
const errorCodeToStatusCode: Record<RecipeUrlIngredientsErrorCode, number> = {
  invalid_url: 400,
  unsupported_content: 400,
  unauthorized: 401,
  not_found: 404,
  fetch_timeout: 408,
  content_too_large: 413,
  parse_failed: 422,
  rate_limited: 429,
  server_error: 500,
}

/**
 * Custom error class for recipe URL ingredients API errors.
 * Can be thrown from anywhere in the handler chain and will be caught
 * by the centralized error middleware.
 */
export class RecipeUrlIngredientsError extends Error {
  readonly code: RecipeUrlIngredientsErrorCode
  readonly statusCode: number

  constructor(code: RecipeUrlIngredientsErrorCode, message: string) {
    super(message)
    this.name = 'RecipeUrlIngredientsError'
    this.code = code
    this.statusCode = errorCodeToStatusCode[code]

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RecipeUrlIngredientsError)
    }
  }
}

/**
 * Gets the HTTP status code for an error code.
 */
export const getStatusCodeForError = (code: RecipeUrlIngredientsErrorCode): number => {
  return errorCodeToStatusCode[code]
}

/**
 * Builds a standardized error response object.
 */
export const buildErrorResponse = (
  code: RecipeUrlIngredientsErrorCode,
  message: string
): RecipeUrlIngredientsErrorResponse => ({
  error: { code, message },
})

/**
 * Express error handling middleware for recipe URL ingredients API errors.
 *
 * This middleware catches:
 * 1. RecipeUrlIngredientsError - domain-specific errors with proper codes
 * 2. Any other Error - treated as server_error
 *
 * Usage: Add this middleware AFTER all routes.
 * ```ts
 * app.post('/api/recipes/ingredients-from-url', ...handlers)
 * app.use('/api/recipes', recipeUrlIngredientsErrorHandler)
 * ```
 */
export const recipeUrlIngredientsErrorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Try to get request context for logging (may not exist if error happened before logging middleware)
  let requestId = 'unknown'
  try {
    const ctx = getRequestContext(req)
    requestId = ctx.requestId
  } catch {
    // Context not available, use unknown
  }

  if (err instanceof RecipeUrlIngredientsError) {
    // Domain-specific error with known code
    logError(requestId, err.code, err.message)
    res.status(err.statusCode).json(buildErrorResponse(err.code, err.message))
    return
  }

  // Unknown error - treat as server error
  // Log the actual error for debugging but return generic message to client
  logError(requestId, 'server_error', err.message, { stack: err.stack })
  res.status(500).json(buildErrorResponse('server_error', 'An unexpected error occurred'))
}

/**
 * Wraps an async request handler to catch errors and pass them to Express error middleware.
 * This allows using throw instead of try/catch in handlers.
 *
 * Usage:
 * ```ts
 * const handler = asyncHandler(async (req, res) => {
 *   throw new RecipeUrlIngredientsError('invalid_url', 'Bad URL')
 * })
 * ```
 */
export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
