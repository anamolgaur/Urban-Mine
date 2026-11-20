/** One consistent line-drawing language for empty states and guidance. Ink strokes, one amber accent per drawing. */
const S = { fill: 'none', stroke: '#14171A', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const A = { ...S, stroke: '#F2A20C', strokeWidth: 3.5 } as const

export type Art = 'lots' | 'device' | 'board' | 'recycle' | 'tools' | 'scan' | 'offers' | 'shield'

function Shapes({ art }: { art: Art }) {
  switch (art) {
    case 'lots':
      return (<g><path d="M60 14l40 18-40 18-40-18z" {...S} /><path d="M20 44l40 18 40-18" {...S} /><path d="M20 56l40 18 40-18" {...S} /><circle cx="60" cy="32" r="4" {...A} /></g>)
    case 'device':
      return (<g><rect x="14" y="30" width="46" height="32" {...S} /><path d="M8 66h58" {...S} /><rect x="78" y="14" width="28" height="52" rx="3" {...S} /><path d="M88 60h8" {...A} /></g>)
    case 'board':
      return (<g><rect x="16" y="14" width="88" height="52" {...S} /><rect x="28" y="26" width="24" height="18" {...A} /><rect x="64" y="26" width="12" height="12" {...S} /><path d="M28 54h48M84 28h12M84 40h12M84 52h12" {...S} /><circle cx="22" cy="20" r="2" {...S} /><circle cx="98" cy="60" r="2" {...S} /></g>)
    case 'recycle':
      return (<g><path d="M44 22h32l-8-10M76 22l-8 10" {...S} /><path d="M84 40l16 28H76l8 10M76 68h24" {...S} /><path d="M20 68l16-28 8 14M20 68h26l-8 10" {...S} /><circle cx="60" cy="48" r="5" {...A} /></g>)
    case 'tools':
      return (<g><path d="M30 64l32-32" {...S} /><path d="M56 26a10 10 0 0 1 14 -10l-7 7 6 6 7-7a10 10 0 0 1-10 14z" {...S} /><path d="M80 66l-30-30" {...A} /><rect x="76" y="62" width="12" height="8" transform="rotate(45 82 66)" {...S} /></g>)
    case 'scan':
      return (<g><path d="M18 28V16h12M90 16h12v12M102 54v12H90M30 66H18V54" {...A} /><rect x="38" y="26" width="44" height="28" rx="2" {...S} /><circle cx="60" cy="40" r="7" {...S} /></g>)
    case 'offers':
      return (<g><rect x="22" y="18" width="76" height="44" {...S} /><path d="M22 30h76" {...S} /><path d="M34 46h22M34 54h14" {...S} /><circle cx="82" cy="48" r="8" {...A} /></g>)
    case 'shield':
      return (<g><path d="M60 12l34 12v22c0 18-14 28-34 34-20-6-34-16-34-34V24z" {...S} /><path d="M46 44l10 10 20-20" {...A} /></g>)
  }
}

export default function Illustration({ art, className = '' }: { art: Art; className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden="true">
      <Shapes art={art} />
    </svg>
  )
}
