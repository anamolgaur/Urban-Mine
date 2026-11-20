import type { Estimate } from '../lib/types.ts'
import { useLang } from '../lib/i18n.tsx'
import { inr } from '../lib/format.ts'

const SHADES = ['#14171A', '#565A5F', '#8A8E92', '#B5B8BB', '#DAD8D0', '#EDEBE5', '#FFFFFF']

/** Stacked bar of value by material (the most valuable material is amber) plus the exact numbers in a table. */
export default function Composition({ est, qty }: { est: Estimate; qty: number }) {
  const { t } = useLang()
  const lines = [...est.lines].sort((a, b) => b.value - a.value)
  const total = lines.reduce((s, l) => s + l.value, 0) || 1
  return (
    <div>
      <div className="flex h-8 w-full border border-ink" role="img" aria-label={lines.map((l) => `${t('mat.' + l.material)} ${Math.round((100 * l.value) / total)}%`).join(', ')}>
        {lines.map((l, i) => (
          <div key={l.material} style={{ width: `${(100 * l.value) / total}%`, background: i === 0 ? '#F2A20C' : SHADES[Math.min(i, SHADES.length - 1)] }}
            className="border-r border-ink last:border-r-0" />
        ))}
      </div>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b border-ink text-left font-mono text-sm uppercase">
            <th className="py-1 font-semibold">{t('material')}</th>
            <th className="py-1 text-right font-semibold">{t('weight')}</th>
            <th className="py-1 text-right font-semibold">{t('rate_kg')}</th>
            <th className="py-1 text-right font-semibold">{t('value')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const r = est.rates[l.material]
            return (
              <tr key={l.material} className="border-b border-hair">
                <td className="py-2">
                  <span className="mr-2 inline-block h-3 w-3 border border-ink align-middle" style={{ background: i === 0 ? '#F2A20C' : SHADES[Math.min(i, SHADES.length - 1)] }} aria-hidden />
                  {t('mat.' + l.material)}
                </td>
                <td className="num py-2 text-right">{Math.round(l.grams * qty)} g</td>
                <td className="num py-2 text-right">
                  {r ? inr(r.rate) : '-'}
                  {r && r.change !== null && r.change !== 0 && <span className="block text-sm text-mute">{r.change > 0 ? '▲' : '▼'} {Math.abs(r.change)}</span>}
                </td>
                <td className="num py-2 text-right font-semibold">{inr(l.value * qty)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
