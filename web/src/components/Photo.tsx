import { useState } from 'react'
import { useLang } from '../lib/i18n.tsx'

/** A stored photo by hash. Demo lots have no image file, so it falls back to a labelled placeholder. */
export default function Photo({ hash, className = '' }: { hash: string; className?: string }) {
  const { t } = useLang()
  const [bad, setBad] = useState(false)
  if (bad) {
    return (
      <div className={`flex aspect-[4/3] flex-col items-center justify-center border border-dashed border-ink bg-sunk p-1 text-center ${className}`}>
        <span className="text-sm font-semibold">{t('no_image')}</span>
        <span className="num text-sm text-mute">{hash.slice(0, 8)}</span>
      </div>
    )
  }
  return <img src={`/uploads/${hash}.jpg`} alt={`${t('photo')} ${hash.slice(0, 8)}`} onError={() => setBad(true)} className={`aspect-[4/3] w-full border border-ink object-cover ${className}`} />
}
