/** A tiny trend line for a list of numbers (oldest first). Decorative: the numbers next to it carry the meaning. */
export default function Sparkline({ values, width = 88, height = 28, fluid = false }: { values: number[]; width?: number; height?: number; fluid?: boolean }) {
  if (values.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 3 - ((v - min) / span) * (height - 6)}`)
  const up = values[values.length - 1] >= values[0]
  const last = pts[pts.length - 1].split(',')
  return (
    <svg width={fluid ? '100%' : width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio={fluid ? 'none' : undefined} aria-hidden="true" className={fluid ? 'min-w-0 flex-1' : 'shrink-0'}>
      <polyline points={pts.join(' ')} fill="none" stroke={up ? 'var(--color-ok)' : 'var(--color-bad)'} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {!fluid && <circle cx={last[0]} cy={last[1]} r="2.6" fill={up ? 'var(--color-ok)' : 'var(--color-bad)'} />}
    </svg>
  )
}
