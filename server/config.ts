export type ServerConfig = {
  port: number
  clerkSecretKey: string
  anthropicApiKey: string
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

  const clerkSecretKey = readRequiredEnv('CLERK_SECRET_KEY', missing)
  const anthropicApiKey = readRequiredEnv('ANTHROPIC_API_KEY', missing)
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
  }
}
