import { createClerkClient } from '@clerk/backend'
import type { ClerkAccountProvider, AuthenticatedAccount } from './types.js'

type ClerkUserLike = {
  id: string
  primaryEmailAddress?: {
    emailAddress?: string | null
  } | null
  emailAddresses?: Array<{
    id?: string
    emailAddress?: string | null
  }>
  primaryEmailAddressId?: string | null
}

const getPrimaryEmail = (user: ClerkUserLike): string | null => {
  const primaryEmail = user.primaryEmailAddress?.emailAddress?.trim()
  if (primaryEmail) {
    return primaryEmail
  }

  const primaryEmailById = user.emailAddresses?.find(
    (email) => email.id && email.id === user.primaryEmailAddressId
  )?.emailAddress
  if (primaryEmailById?.trim()) {
    return primaryEmailById.trim()
  }

  return user.emailAddresses?.find((email) => email.emailAddress?.trim())?.emailAddress?.trim() ?? null
}

const isMissingProviderUserError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false
  }

  const maybeStatus = error as {
    status?: unknown
    statusCode?: unknown
    errors?: Array<{ code?: string }>
  }

  return (
    maybeStatus.status === 404 ||
    maybeStatus.statusCode === 404 ||
    maybeStatus.errors?.some((entry) => entry.code === 'resource_not_found') === true
  )
}

export const createClerkAccountProvider = (secretKey: string): ClerkAccountProvider => {
  const client = createClerkClient({ secretKey })

  return {
    async getAuthenticatedAccount(clerkUserId: string): Promise<AuthenticatedAccount | null> {
      try {
        const user = (await client.users.getUser(clerkUserId)) as ClerkUserLike
        const email = getPrimaryEmail(user)

        if (!email) {
          return null
        }

        return {
          clerkUserId: user.id,
          email,
        }
      } catch (error) {
        if (isMissingProviderUserError(error)) {
          return null
        }
        throw error
      }
    },

    async deleteUser(clerkUserId: string): Promise<void> {
      try {
        await client.users.deleteUser(clerkUserId)
      } catch (error) {
        if (isMissingProviderUserError(error)) {
          return
        }
        throw error
      }
    },
  }
}
