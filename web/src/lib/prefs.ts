export type TextSize = 'normal' | 'large' | 'xlarge'
const KEY = 'um_text'
const PX: Record<TextSize, number> = { normal: 16, large: 18, xlarge: 20 }

export function getTextSize(): TextSize {
  try { const v = localStorage.getItem(KEY); return v === 'large' || v === 'xlarge' ? v : 'normal' } catch { return 'normal' }
}

/** Scales every rem-based size in the app. */
export function applyTextSize(s: TextSize) {
  document.documentElement.style.fontSize = PX[s] + 'px'
  try { localStorage.setItem(KEY, s) } catch { /* ignore */ }
}
