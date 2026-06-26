export type ServerConfig = {
  port: number
  clerkSecretKey: string
  anthropicApiKey: string
  instantAppId: string
  instantAdminToken: string
  authBypass: boolean
}

const readRequiredEnv = (name: string, missing: string[]) => {
  const value = process.env[name]?.trim()
  if (!value) {
    missing.push(name)
    return ''
  }
  return value
}

const parsePort = (value: string | undefined, errors: string[]) => {
  if (value === undefined || value.trim() === '') {
    return 3000
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    errors.push('PORT must be a positive number')
  }
  return parsed
}

export const loadConfig = (): ServerConfig => {
  const errors: string[] = []
  const missing: string[] = []

  const authBypass = process.env.AUTH_BYPASS === 'true'

  // Clerk secret key is only required when auth bypass is disabled
  const clerkSecretKey = authBypass
    ? (process.env.CLERK_SECRET_KEY?.trim() ?? '')
    : readRequiredEnv('CLERK_SECRET_KEY', missing)
  const anthropicApiKey = readRequiredEnv('ANTHROPIC_API_KEY', missing)
  // Instant credentials are only used by the real account deletion route.
  const instantAppId = authBypass
    ? (process.env.INSTANT_APP_ID?.trim() ?? '')
    : readRequiredEnv('INSTANT_APP_ID', missing)
  const instantAdminToken = authBypass
    ? (process.env.INSTANT_ADMIN_TOKEN?.trim() ?? '')
    : readRequiredEnv('INSTANT_ADMIN_TOKEN', missing)
  const port = parsePort(process.env.PORT, errors)

  if (missing.length > 0) {
    errors.push(`Missing required environment variables: ${missing.join(', ')}`)
  }

  if (errors.length > 0) {
    throw new Error(`Configuration error:\n${errors.map((error) => `- ${error}`).join('\n')}`)
  }

  return {
    port,
    clerkSecretKey,
    anthropicApiKey,
    instantAppId,
    instantAdminToken,
    authBypass,
  }
}
