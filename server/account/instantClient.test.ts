import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDeleteShareA = vi.fn(() => ({ op: 'delete-share-a' }))
const mockDeleteShareB = vi.fn(() => ({ op: 'delete-share-b' }))
const mockTransact = vi.fn(async () => ({ 'tx-id': 1 }))
const mockQuery = vi.fn()
const mockDeleteUser = vi.fn()

vi.mock('@instantdb/admin', () => ({
  init: vi.fn(() => ({
    query: mockQuery,
    transact: mockTransact,
    auth: {
      deleteUser: mockDeleteUser,
    },
    tx: {
      grocery_list_shares: {
        shareA: {
          delete: mockDeleteShareA,
        },
        shareB: {
          delete: mockDeleteShareB,
        },
      },
    },
  })),
}))

describe('createInstantAccountProvider', () => {
  beforeEach(() => {
    mockQuery.mockReset()
    mockTransact.mockClear()
    mockDeleteUser.mockReset()
    mockDeleteShareA.mockClear()
    mockDeleteShareB.mockClear()
  })

  it('looks up Instant users by email', async () => {
    mockQuery.mockResolvedValueOnce({
      $users: [{ id: 'instant-user-123', email: 'user@example.com' }],
    })

    const { createInstantAccountProvider } = await import('./instantClient.js')
    const provider = createInstantAccountProvider('app-id', 'admin-token')

    await expect(provider.findUserByEmail('user@example.com')).resolves.toEqual({
      id: 'instant-user-123',
      email: 'user@example.com',
    })
    expect(mockQuery).toHaveBeenCalledWith({
      $users: {
        $: {
          where: { email: 'user@example.com' },
        },
      },
    })
  })

  it('deletes grocery_list_shares rows where user_id is the deleted user id', async () => {
    mockQuery.mockResolvedValueOnce({
      grocery_list_shares: [{ id: 'shareA' }, { id: 'shareB' }],
    })

    const { createInstantAccountProvider } = await import('./instantClient.js')
    const provider = createInstantAccountProvider('app-id', 'admin-token')

    await provider.deleteMemberShares('instant-user-123')

    expect(mockQuery).toHaveBeenCalledWith({
      grocery_list_shares: {
        $: {
          where: { user_id: 'instant-user-123' },
        },
      },
    })
    expect(mockTransact).toHaveBeenCalledWith([{ op: 'delete-share-a' }, { op: 'delete-share-b' }])
  })

  it('skips the share transaction when no membership rows exist', async () => {
    mockQuery.mockResolvedValueOnce({ grocery_list_shares: [] })

    const { createInstantAccountProvider } = await import('./instantClient.js')
    const provider = createInstantAccountProvider('app-id', 'admin-token')

    await provider.deleteMemberShares('instant-user-123')

    expect(mockTransact).not.toHaveBeenCalled()
  })

  it('deletes the Instant auth user by id', async () => {
    mockDeleteUser.mockResolvedValueOnce({ id: 'instant-user-123' })

    const { createInstantAccountProvider } = await import('./instantClient.js')
    const provider = createInstantAccountProvider('app-id', 'admin-token')

    await expect(provider.deleteUser('instant-user-123')).resolves.toEqual({
      id: 'instant-user-123',
    })
    expect(mockDeleteUser).toHaveBeenCalledWith({ id: 'instant-user-123' })
  })
})
