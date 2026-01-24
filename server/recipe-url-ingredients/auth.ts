import type { RequestHandler } from 'express'
import { verifyToken } from '@clerk/backend'
import type { RecipeUrlIngredientsErrorResponse } from './types.js'

type ClerkAuthMiddlewareOptions = {
  clerkSecretKey: string
}

const buildUnauthorizedResponse = (): RecipeUrlIngredientsErrorResponse => ({
  error: {
    code: 'unauthorized',
    message: 'Missing or invalid authentication token.',
  },
})

const extractBearerToken = (headerValue: string | undefined): string | null => {
  if (!headerValue) {
    return null
  }
  const [scheme, ...rest] = headerValue.trim().split(/\s+/)
  if (!scheme || scheme.toLowerCase() !== 'bearer') {
    return null
  }
  const token = rest.join(' ').trim()
  return token.length > 0 ? token : null
}

export const createClerkAuthMiddleware = ({
  clerkSecretKey,
}: ClerkAuthMiddlewareOptions): RequestHandler => {
  return async (req, res, next) => {
    const token = extractBearerToken(req.header('authorization'))

    if (!token) {
      res.status(401).json(buildUnauthorizedResponse())
      return
    }

    try {
      const verifiedToken = await verifyToken(token, { secretKey: clerkSecretKey })
      const userId = verifiedToken?.sub

      if (!userId) {
        res.status(401).json(buildUnauthorizedResponse())
        return
      }

      res.locals.auth = {
        userId,
        sessionId: verifiedToken.sid ?? null,
      }

      next()
    } catch {
      res.status(401).json(buildUnauthorizedResponse())
    }
  }
}
