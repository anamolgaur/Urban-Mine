// Fonts are served by the app itself: they work offline and no visit is reported to Google.
// Hind covers Hindi, Marathi and English; Noto covers Bangla, Tamil, Telugu and Gujarati.
import '@fontsource/hind/400.css'
import '@fontsource/hind/500.css'
import '@fontsource/hind/600.css'
import '@fontsource/hind/700.css'
import '@fontsource/noto-sans-bengali/400.css'
import '@fontsource/noto-sans-bengali/600.css'
import '@fontsource/noto-sans-bengali/700.css'
import '@fontsource/noto-sans-tamil/400.css'
import '@fontsource/noto-sans-tamil/600.css'
import '@fontsource/noto-sans-tamil/700.css'
import '@fontsource/noto-sans-telugu/400.css'
import '@fontsource/noto-sans-telugu/600.css'
import '@fontsource/noto-sans-telugu/700.css'
import '@fontsource/noto-sans-gujarati/400.css'
import '@fontsource/noto-sans-gujarati/600.css'
import '@fontsource/noto-sans-gujarati/700.css'
import { startTableCards } from './lib/tableCards.ts'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { LangProvider } from './lib/i18n.tsx'
import { SessionProvider } from './lib/session.tsx'
import { FlowProvider } from './lib/flow.tsx'
import { applyTextSize, getTextSize } from './lib/prefs.ts'
import { applyTheme, getTheme } from './lib/theme.ts'

applyTextSize(getTextSize())
applyTheme(getTheme())

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

startTableCards()
