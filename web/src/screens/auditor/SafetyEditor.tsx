import { useEffect, useState } from 'react'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import type { SafetyPack, Lang } from '../../lib/types.ts'
import { Tag, Btn, Loading, ErrorNote, Banner, Field, inputCls } from '../../components/ui.tsx'

export default function SafetyEditor() {
  const { t } = useLang()
  const types = useApi<{ types: string[] }>('/api/safety')
  const [type, setType] = useState('phone')
  const [lang, setLang] = useState<Lang>('hi')
  const pack = useApi<SafetyPack>(`/api/safety/${type}?lang=${lang}`)
  const [edits, setEdits] = useState<Record<string, { title: string; instruction: string }>>({})
  const [reviewer, setReviewer] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const p = pack.data

  useEffect(() => {
    if (p) { setEdits(Object.fromEntries(p.steps.map((s) => [s.id, { title: s.title, instruction: s.instruction }]))); setReviewer(p.reviewed_by ?? '') }
  }, [p])

  async function save() {
    setBusy(true); setErr(null); setMsg(null)
    try {
      await api(`/api/safety/${type}/${lang}`, { method: 'PUT', body: { steps: Object.entries(edits).map(([id, v]) => ({ id, ...v })), reviewed_by: reviewer || null } })
      setMsg(t('saved_ok')); pack.reload()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <>
      <Banner tone="bad" icon="alert">{t('safety_editor_note')}</Banner>
      <div className="mt-3 flex flex-wrap gap-2">
        <select aria-label={t('device_type')} className={`${inputCls} max-w-56`} value={type} onChange={(e) => setType(e.target.value)}>
          {(types.data?.types ?? ['phone']).map((x) => <option key={x} value={x}>{t('type.' + x)}</option>)}
        </select>
        <select aria-label={t('language')} className={`${inputCls} max-w-40`} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
          <option value="hi">हिन्दी</option><option value="en">English</option>
        </select>
        {p && <span className="flex items-center gap-1"><Tag>{p.version}</Tag>{p.draft ? <Tag tone="bad">{t('draft_tag')}</Tag> : <Tag tone="ok">✓ {t('reviewed_by')} {p.reviewed_by}</Tag>}</span>}
      </div>
      {pack.error && <ErrorNote message={pack.error} />}
      {pack.loading && <Loading />}
      {p && (
        <div className="mt-4 space-y-4">
          {p.steps.map((s, i) => (
            <div key={s.id} className="border border-ink bg-white p-3">
              <p className="num mb-2 text-sm text-mute">{i + 1}. {s.id} {s.photo_required && <Tag tone="bad">{t('photo_required')}</Tag>}</p>
              <Field label={t('step_title')}><input className={inputCls} value={edits[s.id]?.title ?? ''} onChange={(e) => setEdits({ ...edits, [s.id]: { ...edits[s.id], title: e.target.value } })} /></Field>
              <Field label={t('step_instruction')}><textarea className={`${inputCls} min-h-20 py-2`} value={edits[s.id]?.instruction ?? ''} onChange={(e) => setEdits({ ...edits, [s.id]: { ...edits[s.id], instruction: e.target.value } })} /></Field>
            </div>
          ))}
          <Field label={t('reviewer_name')} hint={t('reviewer_hint')}><input className={inputCls} value={reviewer} onChange={(e) => setReviewer(e.target.value)} /></Field>
          {err && <ErrorNote message={err} />}
          {msg && <Banner tone="ok" icon="check">{msg}</Banner>}
          <Btn full={false} disabled={busy} onClick={save} icon="check">{t('save')}</Btn>
        </div>
      )}
    </>
  )
}
