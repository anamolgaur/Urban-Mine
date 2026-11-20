import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useFlow } from '../../lib/flow.tsx'
import { api } from '../../lib/api.ts'
import { DEVICE_TYPES } from '../../lib/devices.ts'
import { fileToDataUrl } from '../../lib/image.ts'
import type { ScanResult } from '../../lib/types.ts'
import { Screen, H2, Btn, ErrorNote, Banner, inputCls } from '../../components/ui.tsx'
import Icon from '../../components/Icon.tsx'

const SHOTS = ['shot_top', 'shot_under', 'shot_back', 'shot_label']

export function TypeGrid({ value, onPick, allowUnsure = false }: { value: string | null; onPick: (t: string | null) => void; allowUnsure?: boolean }) {
  const { t } = useLang()
  const items = allowUnsure ? [...DEVICE_TYPES, '__unsure'] : DEVICE_TYPES
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('what_is_it')}>
      {items.map((ty) => {
        const sel = ty === '__unsure' ? value === null : value === ty
        return (
          <button key={ty} role="radio" aria-checked={sel} onClick={() => onPick(ty === '__unsure' ? null : ty)}
            className={`flex min-h-14 items-center gap-2 border px-3 text-left text-sm font-semibold ${sel ? 'border-ink bg-ink text-paper' : 'border-ink bg-white'}`}>
            <Icon name={ty === '__unsure' ? 'info' : ty} size={22} />
            <span className="flex-1">{ty === '__unsure' ? t('not_sure') : t('type.' + ty)}</span>
            {sel && <Icon name="check" size={18} />}
          </button>
        )
      })}
    </div>
  )
}

export default function Scan() {
  const { t } = useLang()
  const nav = useNavigate()
  const { flow, patch, setImage } = useFlow()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const taken = flow.images.filter(Boolean).length

  async function onFile(i: number, f: File | undefined) {
    if (!f) return
    try {
      setImage(i, await fileToDataUrl(f))
    } catch (e) { setErr((e as Error).message) }
  }

  async function submit() {
    setBusy(true); setErr(null)
    try {
      const res = await api<ScanResult>('/api/scan', { body: { images: flow.images.filter(Boolean), hint: flow.hint ?? undefined, ocrText: flow.labelText || undefined } })
      patch({ scan: res, type: res.type === 'unknown' ? null : res.type, modelId: null, estimate: null, done: {}, extraHashes: [], lot: null, works: null, qty: 1 })
      nav('/scan/confirm')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Screen title={t('scan_title')} back="/" tabs={false}>
      <H2>1. {t('what_is_it')}</H2>
      <TypeGrid value={flow.hint} onPick={(hint) => patch({ hint })} allowUnsure />

      <H2>2. {t('take_photos')}</H2>
      <p className="mb-2 text-sm text-mute">{t('photos_help')}</p>
      <div className="grid grid-cols-2 gap-2">
        {SHOTS.map((k, i) => {
          const img = flow.images[i]
          return (
            <div key={k}>
              <input ref={(el) => { refs.current[i] = el }} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1}
                onChange={(e) => { void onFile(i, e.target.files?.[0]); e.target.value = '' }} />
              <button onClick={() => refs.current[i]?.click()} aria-label={`${t(k)}${img ? ' ✓' : ''}`}
                className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 overflow-hidden border border-ink bg-white text-sm font-semibold">
                {img ? <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <Icon name="camera" size={28} />}
                <span className={img ? 'absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 bg-ink py-1 text-paper' : ''}>
                  {img && <Icon name="check" size={16} />}{t(k)}
                </span>
              </button>
            </div>
          )
        })}
      </div>

      <H2>3. {t('label_text')}</H2>
      <input className={inputCls} value={flow.labelText} onChange={(e) => patch({ labelText: e.target.value })} placeholder={t('label_placeholder')} aria-label={t('label_text')} />
      <p className="mt-1 text-sm text-mute">{t('label_help')}</p>

      {err && <ErrorNote message={err} />}
      <div className="mt-6 space-y-2">
        {busy && <Banner icon="clock">{t('reading_label')}</Banner>}
        <Btn onClick={submit} disabled={busy || taken === 0} icon="scan">{busy ? t('checking') : t('check_device')}</Btn>
        {taken === 0 && <p className="text-center text-sm text-mute">{t('need_one_photo')}</p>}
      </div>
    </Screen>
  )
}
