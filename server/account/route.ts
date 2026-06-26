import type { RequestHandler } from 'express'
import { loadConfig } from '../config.js'
import { createClerkAuthMiddleware } from '../recipe-url-ingredients/auth.js'
import { asyncHandler } from '../recipe-url-ingredients/errors.js'
import { createLoggingMiddleware } from '../recipe-url-ingredients/logging.js'
import { AccountDeletionError } from './errors.js'
import { deleteAuthenticatedAccount, type AccountDeletionProviders } from './accountDeletionService.js'
import { createClerkAccountProvider } from './clerkClient.js'
import { createInstantAccountProvider } from './instantClient.js'

type AccountDeletionRouteOptions = {
  providers?: AccountDeletionProviders
}

const getAuthenticatedClerkUserId = (res: Parameters<RequestHandler>[1]): string => {
  const userId = res.locals.auth?.userId

  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new AccountDeletionError('unauthorized', 'Missing or invalid authentication token.')
  }

  return userId
}

export const createAccountDeletionRoute = (
  options: AccountDeletionRouteOptions = {}
): RequestHandler[] => {
  const config = loadConfig()
  const providers =
    options.providers ??
    (config.authBypass
      ? null
      : {
          clerk: createClerkAccountProvider(config.clerkSecretKey),
          instant: createInstantAccountProvider(config.instantAppId, config.instantAdminToken),
        })

  const deleteAccountHandler = asyncHandler(async (_req, res) => {
    if (!providers) {
      throw new AccountDeletionError(
        'server_error',
        'Account deletion is not available in this environment.'
      )
    }

    await deleteAuthenticatedAccount(getAuthenticatedClerkUserId(res), providers)
    res.status(204).end()
  })

  return [
    createLoggingMiddleware(),
    ...createClerkAuthMiddleware({ authBypass: config.authBypass }),
    deleteAccountHandler,
  ]
}
