import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import PrivacyPolicy from './PrivacyPolicy'
import './index.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found')
}

const path = window.location.pathname.replace(/\/+$/, '')
const Page = path === '/privacy' ? PrivacyPolicy : App

createRoot(root).render(
  <StrictMode>
    <Page />
  </StrictMode>,
)
