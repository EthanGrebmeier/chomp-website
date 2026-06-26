import { init } from '@instantdb/admin'
import type { GroceryListShare, InstantAccountProvider, InstantUser } from './types.js'

type InstantAdminDb = ReturnType<typeof init>

type InstantUserQueryResult = {
  $users?: InstantUser[]
}

type GroceryListSharesQueryResult = {
  grocery_list_shares?: GroceryListShare[]
}

const createDeleteChunks = (db: InstantAdminDb, shares: GroceryListShare[]) =>
  shares.map((share) => db.tx.grocery_list_shares[share.id].delete())

export const createInstantAccountProvider = (
  appId: string,
  adminToken: string
): InstantAccountProvider => {
  const db = init({ appId, adminToken })

  return {
    async findUserByEmail(email: string): Promise<InstantUser | null> {
      const result = (await db.query({
        $users: {
          $: {
            where: { email },
          },
        },
      })) as InstantUserQueryResult

      return result.$users?.[0] ?? null
    },

    async deleteMemberShares(instantUserId: string): Promise<void> {
      const result = (await db.query({
        grocery_list_shares: {
          $: {
            where: { user_id: instantUserId },
          },
        },
      })) as GroceryListSharesQueryResult

      const shares = result.grocery_list_shares ?? []
      if (shares.length === 0) {
        return
      }

      await db.transact(createDeleteChunks(db, shares))
    },

    async deleteUser(instantUserId: string): Promise<InstantUser | null> {
      return db.auth.deleteUser({ id: instantUserId }) as Promise<InstantUser | null>
    },
  }
}
