import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { randomUUID } from 'node:crypto'

/**
 * Request context for logging and tracing.
 * Attached to Express request object by logging middleware.
 */
export type RequestContext = {
  requestId: string
  userId: string | null
  startTime: number
}

/**
 * Structured log entry for recipe URL ingredient requests.
 * Follows spec: log request id, user id, URL host, fetch latency, AI latency, token usage.
 * Does NOT log full URL query strings or page content.
 */
export type RequestLogEntry = {
  requestId: string
  userId: string | null
  urlHost: string | null
  fetchLatencyMs: number | null
  aiLatencyMs: number | null
  tokenUsage: {
    input: number
    output: number
  } | null
  totalLatencyMs: number
  status: 'success' | 'error'
  errorCode: string | null
}

/**
 * Timing helper to measure operation duration.
 */
export const startTimer = (): { elapsed: () => number } => {
  const start = Date.now()
  return {
    elapsed: () => Date.now() - start,
  }
}

/**
 * Extracts host from URL, stripping query strings and sensitive data.
 */
export const extractUrlHost = (url: string): string | null => {
  try {
    const parsed = new URL(url)
    return parsed.host
  } catch {
    return null
  }
}

/**
 * Logger for recipe URL ingredient API requests.
 * Outputs structured JSON logs to console.
 */
export const logRequest = (entry: RequestLogEntry): void => {
  const logLine = {
    timestamp: new Date().toISOString(),
    type: 'recipe_url_ingredients',
    ...entry,
  }
  console.log(JSON.stringify(logLine))
}

/**
 * Logs an error event with request context.
 */
export const logError = (
  requestId: string,
  errorCode: string,
  message: string,
  metadata?: Record<string, unknown>
): void => {
  const logLine = {
    timestamp: new Date().toISOString(),
    type: 'recipe_url_ingredients_error',
    level: 'error',
    requestId,
    errorCode,
    message,
    ...metadata,
  }
  console.error(JSON.stringify(logLine))
}

// Extend Express Request type to include our context
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctx?: RequestContext
    }
  }
}

/**
 * Middleware that attaches request context (requestId, timing) to the request.
 * Should be added before auth middleware.
 */
export const createLoggingMiddleware = (): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.ctx = {
      requestId: randomUUID(),
      userId: null, // Will be set by auth middleware
      startTime: Date.now(),
    }
    next()
  }
}

/**
 * Gets request context from request, with fallback for missing context.
 */
export const getRequestContext = (req: Request): RequestContext => {
  return (
    req.ctx ?? {
      requestId: randomUUID(),
      userId: null,
      startTime: Date.now(),
    }
  )
}
