import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n.tsx'
import { photoUrl, forgetPhotoUrl } from '../lib/photoUrls.ts'

/** A stored photo by hash. It is private, so it loads through a signed link. With no image (a sample lot, or not yours to see) a labelled placeholder shows. */
export default function Photo({ hash, className = '' }: { hash: string; className?: string }) {
  const { t } = useLang()
  const [url, setUrl] = useState<string | null | undefined>(undefined) // undefined = still asking
  const [retried, setRetried] = useState(false)

  useEffect(() => {
    let live = true
    setUrl(undefined); setRetried(false)
    photoUrl(hash).then((u) => { if (live) setUrl(u) })
    return () => { live = false }
  }, [hash])

  if (url === undefined) return <div role="status" aria-label={t('loading')} className={`aspect-[4/3] w-full animate-pulse border border-hair bg-sunk ${className}`} />
  if (url === null) {
    return (
      <div className={`flex aspect-[4/3] flex-col items-center justify-center border border-dashed border-ink bg-sunk p-1 text-center ${className}`}>
        <span className="text-sm font-semibold">{t('no_image')}</span>
        <span className="num text-sm text-mute">{hash.slice(0, 8)}</span>
      </div>
    )
  }
  return (
    <img src={url} alt={`${t('photo')} ${hash.slice(0, 8)}`} loading="lazy"
      onError={() => {
        // an expired link: fetch a fresh one once, then give up and show the placeholder
        forgetPhotoUrl(hash)
        if (retried) { setUrl(null); return }
        setRetried(true)
        photoUrl(hash).then(setUrl)
      }}
      className={`aspect-[4/3] w-full border border-ink object-cover ${className}`} />
  )
}
