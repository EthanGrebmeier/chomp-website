import 'dotenv/config'
import { loadConfig } from './config.js'
import { createApp } from './app.js'

let port = 3001
let authBypass = false
try {
  const config = loadConfig()
  port = config.port
  authBypass = config.authBypass
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
}

const app = createApp()

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
  if (authBypass) {
    console.warn('⚠️  AUTH_BYPASS is enabled - authentication is disabled!')
  }
})
