import express from 'express'
import request from 'supertest'
import { afterEach, expect, it, vi } from 'vitest'
import { createCollectionInvitationRoutes } from './collectionInvitations.js'
const app = () => express().use(createCollectionInvitationRoutes())
afterEach(() => vi.unstubAllEnvs())
it('opens experimental Chomp without exposing metadata or sending users to the old App Store build', async () => {
  vi.stubEnv('CHOMP_COLLECTION_APP', '')
  const response = await request(app()).get('/join/2345-abcd-efgh')
  expect(response.status).toBe(200)
  expect(response.headers['cache-control']).toBe('no-store')
  expect(response.headers['referrer-policy']).toBe('no-referrer')
  expect(response.text).toContain('chomp-sync-lab://join/2345ABCDEFGH')
  expect(response.text).toContain('2345-ABCD-EFGH')
  expect(response.text).not.toContain('apps.apple.com')
})
it('rejects invalid and injectable codes', async () => {
  expect((await request(app()).get('/join/%22%3E%3Cscript%3E')).status).toBe(404)
})
it('allows the explicitly configured production cutover', async () => {
  vi.stubEnv('CHOMP_COLLECTION_APP', 'production')
  const response = await request(app()).get('/join/2345ABCDEFGH')
  expect(response.text).toContain('chomp://join/2345ABCDEFGH')
  expect(response.text).toContain('id6754225714')
})

it('serves the actual Apple association as JSON while preserving the original app routes', async () => {
  vi.stubEnv('AUTH_BYPASS', 'true')
  vi.stubEnv('ANTHROPIC_API_KEY', 'test')
  const { createApp } = await import('./app.js')
  const response = await request(createApp()).get('/.well-known/apple-app-site-association')
  expect(response.status).toBe(200)
  expect(response.headers['content-type']).toContain('application/json')
  expect(response.body.applinks.details).toContainEqual({ appID: 'K8MV5DQ32C.dev.chomp.sync-lab', paths: ['/join/*'] })
  expect(response.body.applinks.details.find((entry: { appID: string }) => entry.appID === 'K8MV5DQ32C.com.ethangrebmeier.chomp').paths).toContain('/join-list/*')
})
