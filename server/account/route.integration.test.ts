import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express, { type Express } from 'express'
import request from 'supertest'
import type { AccountDeletionProviders } from './accountDeletionService.js'

vi.mock('../config.js', () => ({
  loadConfig: () => ({
    anthropicApiKey: 'test-api-key',
    clerkSecretKey: 'test-clerk-key',
    instantAppId: 'test-instant-app-id',
    instantAdminToken: 'test-instant-admin-token',
    authBypass: false,
    port: 3000,
  }),
}))

let mockIsAuthenticated = true
let mockUserId: string | null = 'clerk-user-123'

vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
  getAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    userId: mockUserId,
    sessionId: mockUserId ? 'test-session-456' : null,
  }),
}))

const createMockProviders = (): AccountDeletionProviders => ({
  clerk: {
    getAuthenticatedAccount: vi.fn(async (clerkUserId: string) => ({
      clerkUserId,
      email: 'user@example.com',
    })),
    deleteUser: vi.fn(async () => undefined),
  },
  instant: {
    findUserByEmail: vi.fn(async () => ({ id: 'instant-user-123', email: 'user@example.com' })),
    deleteMemberShares: vi.fn(async () => undefined),
    deleteUser: vi.fn(async () => ({ id: 'instant-user-123', email: 'user@example.com' })),
  },
})

describe('DELETE /api/account', () => {
  let app: Express
  let providers: AccountDeletionProviders

  beforeEach(async () => {
    mockIsAuthenticated = true
    mockUserId = 'clerk-user-123'
    providers = createMockProviders()

    vi.resetModules()

    const { createAccountDeletionRoute } = await import('./route.js')
    const { accountDeletionErrorHandler } = await import('./errors.js')

    app = express()
    app.use(express.json())
    app.delete('/api/account', ...createAccountDeletionRoute({ providers }))
    app.use('/api/account', accountDeletionErrorHandler)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns 204 after deleting Instant data and the Clerk user', async () => {
    const response = await request(app)
      .delete('/api/account')
      .set('Authorization', 'Bearer valid-token')
      .send({ userId: 'attacker-controlled-id' })

    expect(response.status).toBe(204)
    expect(response.text).toBe('')
    expect(providers.clerk.getAuthenticatedAccount).toHaveBeenCalledWith('clerk-user-123')
    expect(providers.instant.findUserByEmail).toHaveBeenCalledWith('user@example.com')
    expect(providers.instant.deleteMemberShares).toHaveBeenCalledWith('instant-user-123')
    expect(providers.instant.deleteUser).toHaveBeenCalledWith('instant-user-123')
    expect(providers.clerk.deleteUser).toHaveBeenCalledWith('clerk-user-123')
  })

  it('deletes member shares before deleting the Instant user', async () => {
    await request(app).delete('/api/account').set('Authorization', 'Bearer valid-token')

    const shareCleanupOrder = vi.mocked(providers.instant.deleteMemberShares).mock.invocationCallOrder[0]
    const instantDeleteOrder = vi.mocked(providers.instant.deleteUser).mock.invocationCallOrder[0]
    const clerkDeleteOrder = vi.mocked(providers.clerk.deleteUser).mock.invocationCallOrder[0]

    expect(shareCleanupOrder).toBeLessThan(instantDeleteOrder)
    expect(instantDeleteOrder).toBeLessThan(clerkDeleteOrder)
  })

  it('returns unauthorized when the Clerk token is missing or invalid', async () => {
    mockIsAuthenticated = false
    mockUserId = null

    const response = await request(app).delete('/api/account')

    expect(response.status).toBe(401)
    expect(response.body).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Missing or invalid authentication token.',
      },
    })
    expect(providers.clerk.getAuthenticatedAccount).not.toHaveBeenCalled()
  })

  it('returns not_found when the authenticated Clerk identity has no account', async () => {
    vi.mocked(providers.clerk.getAuthenticatedAccount).mockResolvedValueOnce(null)

    const response = await request(app)
      .delete('/api/account')
      .set('Authorization', 'Bearer valid-token')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({
      error: {
        code: 'not_found',
        message: 'We could not find an account to delete.',
      },
    })
    expect(providers.instant.findUserByEmail).not.toHaveBeenCalled()
    expect(providers.clerk.deleteUser).not.toHaveBeenCalled()
  })

  it('converges to success when the Instant user is already deleted', async () => {
    vi.mocked(providers.instant.findUserByEmail).mockResolvedValueOnce(null)

    const response = await request(app)
      .delete('/api/account')
      .set('Authorization', 'Bearer valid-token')

    expect(response.status).toBe(204)
    expect(providers.instant.deleteMemberShares).not.toHaveBeenCalled()
    expect(providers.instant.deleteUser).not.toHaveBeenCalled()
    expect(providers.clerk.deleteUser).toHaveBeenCalledWith('clerk-user-123')
  })

  it('returns server_error without exposing provider internals on unexpected failures', async () => {
    vi.mocked(providers.instant.deleteMemberShares).mockRejectedValueOnce(
      new Error('database credentials leaked detail')
    )

    const response = await request(app)
      .delete('/api/account')
      .set('Authorization', 'Bearer valid-token')

    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      error: {
        code: 'server_error',
        message: 'We could not delete your account. Please try again.',
      },
    })
    expect(JSON.stringify(response.body)).not.toContain('database credentials')
    expect(providers.clerk.deleteUser).not.toHaveBeenCalled()
  })
})
