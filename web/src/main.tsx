import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { LangProvider } from './lib/i18n.tsx'
import { SessionProvider } from './lib/session.tsx'
import { FlowProvider } from './lib/flow.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LangProvider>
        <SessionProvider>
          <FlowProvider>
            <App />
          </FlowProvider>
        </SessionProvider>
      </LangProvider>
    </BrowserRouter>
  </StrictMode>,
)
