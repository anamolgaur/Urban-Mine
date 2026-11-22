import { useEffect, useRef, useState } from 'react'
import { useLang } from '../lib/i18n.tsx'
import { useFlow } from '../lib/flow.tsx'
import { useApi } from '../lib/useApi.ts'
import { api, ApiError } from '../lib/api.ts'
import type { Grade } from '../lib/types.ts'
import { H2, Btn, Banner, Tag } from './ui.tsx'
import { Skeleton } from './kit.tsx'
import Icon from './Icon.tsx'

const GRADES: Grade[] = ['A', 'B', 'C', 'D']
type Vision = { enabled: boolean; consent: boolean; daily_limit: number; used_today: number }
type Assessed = { available: boolean; grade?: Grade; issues?: string[]; confidence?: number; factor?: number ; resale?: { id: string; brand: string; model: string } | null }

/**
 * Condition grade for the device: chosen by the worker, or suggested from the photos by an AI service once they have agreed.
 * The grade moves the price range. It is always an estimate and always changeable.
 */
export default function PhotoCheck({ factor }: { factor?: number }) {
  const { t } = useLang()
  const { flow, patch } = useFlow()
  const vision = useApi<Vision>('/api/vision')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [declined, setDeclined] = useState(false)
  const tried = useRef<string | null>(null)
  const scan = flow.scan
  const cond = flow.condition

  async function run() {
    if (!scan || !flow.type) return
    setBusy(true); setMsg(null)
    try {
      const r = await api<Assessed>('/api/assess', { body: { hashes: scan.photoHashes.slice(0, 3), type: flow.type, model_id: flow.modelId ?? undefined } })
      if (r.available && r.grade) patch({ condition: { grade: r.grade, issues: r.issues ?? [], confidence: r.confidence ?? 0, source: 'ai', aiGrade: r.grade } })
      // the AI can also recognise the model from how it looks; use it if the worker has not picked one
      if (r.resale && !flow.resaleId) patch({ resaleId: r.resale.id })
      else setMsg('pc_unavailable')
    } catch (e) {
      if (e instanceof ApiError && e.code === 'vision_consent_required') vision.reload()
      setMsg(e instanceof ApiError && e.code === 'vision_limit' ? 'pc_limit' : 'pc_unavailable')
    } finally { setBusy(false) }
  }

  // once they have agreed, check the photos by itself, once per scan
  useEffect(() => {
    if (vision.data?.enabled && vision.data.consent && !cond && scan && tried.current !== scan.scanId) { tried.current = scan.scanId; void run() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vision.data, scan?.scanId])

  async function allow() {
    try { await api('/api/vision/consent', { body: { accepted: true } }); vision.reload() } catch { setMsg('pc_unavailable') }
  }

  function pick(g: Grade) {
    if (cond?.aiGrade && g !== cond.aiGrade && scan) api(`/api/scan/${scan.scanId}/feedback`, { body: { field: 'condition', predicted: cond.aiGrade, corrected: g } }).catch(() => {})
    patch({ condition: { grade: g, issues: cond?.issues ?? [], confidence: cond?.confidence ?? 0, source: 'worker', aiGrade: cond?.aiGrade ?? null } })
  }

  const v = vision.data
  const needsConsent = !!v?.enabled && !v.consent && !declined
  const confTone = !cond ? null : cond.confidence >= 0.75 ? 'conf_high' : cond.confidence >= 0.5 ? 'conf_mid' : 'conf_low'

  return (
    <section aria-label={t('pc_title')}>
      <H2>{t('pc_title')}</H2>
      <p className="mb-3 text-base leading-snug text-mute">{t('pc_sub')}</p>

      {needsConsent && (
        <div className="mb-3 rounded-3xl bg-white shadow-card p-3">
          <p className="flex items-center gap-2 text-lg font-bold"><Icon name="scan" size={22} />{t('pc_consent_title')}</p>
          <p className="mt-2 text-base leading-snug">{t('pc_consent_body')}</p>
          <div className="mt-3 grid gap-2"><Btn icon="check" onClick={allow}>{t('pc_allow')}</Btn><Btn variant="secondary" onClick={() => setDeclined(true)}>{t('pc_skip')}</Btn></div>
        </div>
      )}
      {busy && <div className="mb-3"><Skeleton rows={1} /><p className="text-sm text-mute" role="status">{t('pc_checking')}</p></div>}
      {!busy && v && !v.enabled && <p className="mb-3 flex gap-2 text-sm text-mute"><Icon name="info" size={18} className="mt-0.5 shrink-0" />{t('pc_off')}</p>}
      {!busy && msg && <p className="mb-3 flex gap-2 text-sm text-mute" role="status"><Icon name="info" size={18} className="mt-0.5 shrink-0" />{t(msg)}</p>}

      <div role="radiogroup" aria-label={t('pc_title')} className="grid gap-2">
        {GRADES.map((g) => (
          <button key={g} role="radio" aria-checked={cond?.grade === g} onClick={() => pick(g)}
            className={`flex min-h-12 items-center gap-3 border px-3 py-2 text-left ${cond?.grade === g ? 'border-brand bg-brand text-onbrand' : 'border-hair bg-white'}`}>
            <span className="num inline-flex h-9 w-9 shrink-0 items-center justify-center border border-current text-xl font-bold" aria-hidden>{cond?.grade === g ? '✓' : g}</span>
            <span className="text-base leading-snug"><span className="sr-only">{t('pc_grade', { g })}. </span>{t('pc_desc_' + g)}</span>
          </button>
        ))}
      </div>

      {cond ? (
        <div className="mt-3 space-y-2">
          <p className="flex flex-wrap items-center gap-2">
            <Tag tone={cond.source === 'ai' ? 'amber' : 'plain'}>{t(cond.source === 'ai' ? 'pc_ai_tag' : 'pc_my_tag')}</Tag>
            <span className="text-lg font-bold">{t('pc_grade', { g: cond.grade })}</span>
            {cond.source === 'ai' && confTone && <span className="text-sm text-mute">{t('confidence')}: {t(confTone)}</span>}
          </p>
          {cond.issues.length > 0 && <p className="flex flex-wrap gap-1">{cond.issues.map((i) => <Tag key={i} tone={i === 'swollen_battery' ? 'bad' : 'plain'}>{t('issue.' + i)}</Tag>)}</p>}
          {cond.issues.includes('swollen_battery') && <Banner tone="bad" icon="alert">{t('pc_battery_warn')}</Banner>}
          {factor !== undefined && <p className="text-sm text-mute">{t('pc_effect', { f: factor })}</p>}
        </div>
      ) : <p className="mt-3 text-sm text-mute">{t('pc_not_set')}</p>}

      {v?.enabled && v.consent && !busy && (
        <div className="mt-3"><Btn variant="ghost" onClick={() => { tried.current = scan?.scanId ?? null; void run() }}>{t('pc_retry')}</Btn></div>
      )}
      <p className="mt-3 flex gap-2 text-sm text-mute"><Icon name="info" size={18} className="mt-0.5 shrink-0" />{t('pc_note')}</p>
    </section>
  )
}
