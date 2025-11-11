import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexClientProvider } from './lib/convex'
import App from './App'
import './styles/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexClientProvider>
      <App />
    </ConvexClientProvider>
  </StrictMode>
)
