import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express'
import type { AccountDeletionErrorCode, AccountDeletionErrorResponse } from './types.js'
import { getRequestContext, logError } from '../recipe-url-ingredients/logging.js'

const errorCodeToStatusCode: Record<AccountDeletionErrorCode, number> = {
  unauthorized: 401,
  not_found: 404,
  server_error: 500,
}

export class AccountDeletionError extends Error {
  readonly code: AccountDeletionErrorCode
  readonly statusCode: number

  constructor(code: AccountDeletionErrorCode, message: string) {
    super(message)
    this.name = 'AccountDeletionError'
    this.code = code
    this.statusCode = errorCodeToStatusCode[code]

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AccountDeletionError)
    }
  }
}

export const buildAccountDeletionErrorResponse = (
  code: AccountDeletionErrorCode,
  message: string
): AccountDeletionErrorResponse => ({
  error: { code, message },
})

export const accountDeletionErrorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  void next

  const { requestId } = getRequestContext(req)

  if (err instanceof AccountDeletionError) {
    logError(requestId, err.code, err.message, { route: 'account_deletion' })
    res.status(err.statusCode).json(buildAccountDeletionErrorResponse(err.code, err.message))
    return
  }

  logError(requestId, 'server_error', err.message, {
    route: 'account_deletion',
    stack: err.stack,
  })
  res
    .status(500)
    .json(
      buildAccountDeletionErrorResponse(
        'server_error',
        'We could not delete your account. Please try again.'
      )
    )
}
