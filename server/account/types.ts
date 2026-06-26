export type AccountDeletionErrorCode = 'unauthorized' | 'not_found' | 'server_error'

export type AccountDeletionErrorResponse = {
  error: {
    code: AccountDeletionErrorCode
    message: string
  }
}

export type AuthenticatedAccount = {
  clerkUserId: string
  email: string
}

export type InstantUser = {
  id: string
  email?: string
}

export type GroceryListShare = {
  id: string
  user_id?: string
}

export type ClerkAccountProvider = {
  getAuthenticatedAccount: (clerkUserId: string) => Promise<AuthenticatedAccount | null>
  deleteUser: (clerkUserId: string) => Promise<void>
}

export type InstantAccountProvider = {
  findUserByEmail: (email: string) => Promise<InstantUser | null>
  deleteMemberShares: (instantUserId: string) => Promise<void>
  deleteUser: (instantUserId: string) => Promise<InstantUser | null>
}
