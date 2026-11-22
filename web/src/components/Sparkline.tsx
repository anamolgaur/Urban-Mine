/** A tiny trend line for a list of numbers (oldest first). Decorative: the numbers next to it carry the meaning. */
export default function Sparkline({ values, width = 88, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 3 - ((v - min) / span) * (height - 6)}`)
  const up = values[values.length - 1] >= values[0]
  const last = pts[pts.length - 1].split(',')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
      <polyline points={pts.join(' ')} fill="none" stroke={up ? 'var(--color-ok)' : 'var(--color-bad)'} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={up ? 'var(--color-ok)' : 'var(--color-bad)'} />
    </svg>
  )
}
