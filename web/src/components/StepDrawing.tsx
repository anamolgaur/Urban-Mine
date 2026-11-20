/** Simple line drawings for each dismantling step. The amber part is where the hands go. */
const S = { fill: 'none', stroke: '#14171A', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const A = { ...S, stroke: '#F2A20C', strokeWidth: 3.5 } as const

function Scene({ kind }: { kind: string }) {
  switch (kind) {
    case 'unplug':
      return (<g><rect x="30" y="40" width="40" height="30" {...S} /><path d="M70 55h30" {...S} /><path d="M100 45v20M112 48v14M100 55h-0" {...S} /><path d="M120 55h30" {...A} /><path d="M104 30l22 50M126 30l-22 50" stroke="#B3261E" strokeWidth="3" strokeLinecap="round" /></g>)
    case 'battery':
      return (<g><rect x="25" y="25" width="110" height="60" {...S} /><rect x="45" y="38" width="70" height="34" {...A} /><path d="M115 55h12" {...S} /><path d="M52 50h10M52 60h10" {...S} /><path d="M140 20l16-8" {...S} /></g>)
    case 'ram':
      return (<g><rect x="20" y="30" width="120" height="20" {...A} /><path d="M30 50v8M44 50v8M58 50v8M72 50v8M86 50v8M100 50v8M114 50v8M128 50v8" {...S} /><rect x="32" y="34" width="14" height="12" {...S} /><rect x="54" y="34" width="14" height="12" {...S} /><rect x="76" y="34" width="14" height="12" {...S} /><path d="M146 40h12M146 40l6-6M146 40l6 6" {...S} /><rect x="20" y="70" width="120" height="14" {...S} /></g>)
    case 'sim':
      return (<g><rect x="45" y="20" width="60" height="70" rx="6" {...S} /><rect x="105" y="42" width="44" height="26" {...A} /><path d="M118 42v26M105 55h44" {...S} /></g>)
    case 'case':
      return (<g><rect x="25" y="25" width="110" height="65" {...S} /><circle cx="35" cy="35" r="3" {...A} /><circle cx="125" cy="35" r="3" {...A} /><circle cx="35" cy="80" r="3" {...A} /><circle cx="125" cy="80" r="3" {...A} /><path d="M60 55h40" {...S} /><path d="M140 30l14-10" {...S} /></g>)
    case 'board':
      return (<g><rect x="25" y="22" width="110" height="68" {...S} /><rect x="38" y="34" width="24" height="18" {...A} /><rect x="74" y="34" width="14" height="14" {...S} /><path d="M38 66h52M38 76h30M104 40h20M104 54h20M104 68h20" {...S} /><circle cx="127" cy="80" r="3" {...S} /></g>)
    case 'sort':
      return (<g><path d="M20 45h38l-4 42H24z" {...S} /><path d="M62 45h38l-4 42H66z" {...S} /><path d="M104 45h38l-4 42h-30z" {...S} /><path d="M39 28v12M39 40l-5-5M39 40l5-5" {...A} /><path d="M32 66h14M74 66h18M116 66h18" {...S} /></g>)
    default:
      return (<g><rect x="30" y="25" width="100" height="65" {...S} /><path d="M50 55h60" {...A} /></g>)
  }
}

export default function StepDrawing({ id }: { id: string }) {
  const kind = id.split('-').pop() ?? ''
  return (
    <svg viewBox="0 0 170 110" className="w-full border border-ink bg-white" role="img" aria-label={`Drawing: ${kind}`}>
      <Scene kind={kind} />
    </svg>
  )
}
