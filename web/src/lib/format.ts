const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
export const inr = (n: number) => '₹' + nf.format(Math.round(n))
export const kg = (n: number) => `${Math.round(n * 100) / 100} kg`
export const pct = (n: number) => `${Math.round(n * 100)}%`
export function countdown(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
export const dateShort = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
