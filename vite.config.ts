import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/join-list': 'http://localhost:3001',
      '/recipes/share': 'http://localhost:3001',
      '/.well-known': 'http://localhost:3001',
    },
  },
})
