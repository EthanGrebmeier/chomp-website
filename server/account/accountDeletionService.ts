import { AccountDeletionError } from './errors.js'
import type { ClerkAccountProvider, InstantAccountProvider } from './types.js'

export type AccountDeletionProviders = {
  clerk: ClerkAccountProvider
  instant: InstantAccountProvider
}

export const deleteAuthenticatedAccount = async (
  clerkUserId: string,
  providers: AccountDeletionProviders
): Promise<void> => {
  const account = await providers.clerk.getAuthenticatedAccount(clerkUserId)

  if (!account) {
    throw new AccountDeletionError('not_found', 'We could not find an account to delete.')
  }

  const instantUser = await providers.instant.findUserByEmail(account.email)

  if (instantUser) {
    // Membership shares reference users by string id, so they do not cascade from $users.
    await providers.instant.deleteMemberShares(instantUser.id)
    await providers.instant.deleteUser(instantUser.id)
  }

  await providers.clerk.deleteUser(account.clerkUserId)
}
