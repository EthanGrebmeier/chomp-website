import type { RequestHandler } from 'express'
import { clerkMiddleware, getAuth } from '@clerk/express'
import type { RecipeUrlIngredientsErrorResponse } from './types.js'

const buildUnauthorizedResponse = (): RecipeUrlIngredientsErrorResponse => ({
  error: {
    code: 'unauthorized',
    message: 'Missing or invalid authentication token.',
  },
})

export const createClerkAuthMiddleware = (): RequestHandler[] => [
  clerkMiddleware(),
  (req, res, next) => {
    const { isAuthenticated, userId, sessionId } = getAuth(req)

    if (!isAuthenticated || !userId) {
      res.status(401).json(buildUnauthorizedResponse())
      return
    }

    res.locals.auth = {
      userId,
      sessionId: sessionId ?? null,
    }

    // Update request context with authenticated user ID for logging
    if (req.ctx) {
      req.ctx.userId = userId
    }

    next()
  },
]
