export type Theme = 'dark' | 'light'
const KEY = 'um_theme'

/** Dark is the default until the person picks. */
export function getTheme(): Theme {
  try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}
export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#000000' : '#F5F3EE')
  try { localStorage.setItem(KEY, t) } catch { /* ignore */ }
}

/** First-run setup (language, theme, tour). Kept per device. */
const SETUP = 'um_setup'
export const setupStage = (): 'setup' | 'tour' | 'done' => {
  try { const v = localStorage.getItem(SETUP); return v === 'tour' || v === 'done' ? v : 'setup' } catch { return 'done' }
}
export const setSetupStage = (s: 'setup' | 'tour' | 'done') => { try { localStorage.setItem(SETUP, s) } catch { /* ignore */ } }
