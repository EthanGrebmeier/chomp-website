import type { RequestHandler } from 'express'
import type { RecipeUrlIngredientsErrorResponse } from './types.js'

type RateLimitStore = {
  increment: (key: string) => Promise<{ count: number; resetAt: number }>
  reset: (key: string) => Promise<void>
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

/**
 * In-memory rate limit store. Suitable for single-instance deployments.
 * Replace with Redis store for multi-instance deployments.
 */
export const createMemoryStore = (): RateLimitStore => {
  const entries = new Map<string, RateLimitEntry>()

  // Cleanup expired entries periodically to prevent memory leaks
  const cleanupInterval = setInterval(
    () => {
      const now = Date.now()
      for (const [key, entry] of entries) {
        if (entry.resetAt <= now) {
          entries.delete(key)
        }
      }
    },
    60 * 1000 // Run cleanup every minute
  )
  cleanupInterval.unref() // Allow process to exit if this is the only timer

  return {
    increment: async (key: string) => {
      const now = Date.now()
      const existing = entries.get(key)

      if (!existing || existing.resetAt <= now) {
        // Start a new window
        const entry: RateLimitEntry = {
          count: 1,
          resetAt: now + 60 * 1000, // 1 minute window
        }
        entries.set(key, entry)
        return entry
      }

      // Increment existing window
      existing.count += 1
      return existing
    },
    reset: async (key: string) => {
      entries.delete(key)
    },
  }
}

type RateLimitConfig = {
  maxRequests: number
  windowMs: number
  store: RateLimitStore
}

const defaultConfig: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minute
  store: createMemoryStore(),
}

const buildRateLimitedResponse = (): RecipeUrlIngredientsErrorResponse => ({
  error: {
    code: 'rate_limited',
    message: 'Too many requests. Please try again later.',
  },
})

/**
 * Creates rate limiting middleware that limits requests per authenticated user.
 * Expects `res.locals.auth.userId` to be set by auth middleware.
 */
export const createRateLimitMiddleware = (
  config: Partial<RateLimitConfig> = {}
): RequestHandler => {
  const { maxRequests, store } = { ...defaultConfig, ...config }

  return async (req, res, next) => {
    const userId = res.locals.auth?.userId as string | undefined

    if (!userId) {
      // If no userId, skip rate limiting (auth middleware should handle this)
      next()
      return
    }

    const key = `rate_limit:${userId}`

    try {
      const { count, resetAt } = await store.increment(key)
      const remaining = Math.max(0, maxRequests - count)
      const resetSeconds = Math.ceil((resetAt - Date.now()) / 1000)

      // Set rate limit headers
      res.set('X-RateLimit-Limit', String(maxRequests))
      res.set('X-RateLimit-Remaining', String(remaining))
      res.set('X-RateLimit-Reset', String(resetSeconds))

      if (count > maxRequests) {
        res.set('Retry-After', String(resetSeconds))
        res.status(429).json(buildRateLimitedResponse())
        return
      }

      next()
    } catch {
      // On store error, allow request through (fail open)
      // In production, consider fail-closed with alerting
      next()
    }
  }
}
