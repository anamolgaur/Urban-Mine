import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useFlow } from '../../lib/flow.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { pct } from '../../lib/format.ts'
import type { ModelRef } from '../../lib/types.ts'
import { Screen, H2, Btn, Banner, Tag, Rule } from '../../components/ui.tsx'
import { Rail, Meter, Skeleton } from '../../components/kit.tsx'
import Icon from '../../components/Icon.tsx'
import { TypeGrid } from './Scan.tsx'

type Mode = 'ask' | 'pickModel' | 'pickType'

function Confidence({ value }: { value: number }) {
  const { t } = useLang()
  const level = value < 0.6 ? 'low' : value < 0.8 ? 'mid' : 'high'
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium text-mute">{t('confidence')}</span>
        <span className="num text-base font-semibold">{pct(value)}, {t('conf_' + level)}</span>
      </div>
      <Meter value={value} label={t('confidence')} valueText={`${pct(value)}, ${t('conf_' + level)}`} tone={level === 'high' ? 'ok' : 'amber'} />
      <p className="mt-1 text-sm text-mute">{t('not_certain')}</p>
    </div>
  )
}

export default function Confirm() {
  const { t } = useLang()
  const nav = useNavigate()
  const { flow, patch } = useFlow()
  const scan = flow.scan
  const [mode, setMode] = useState<Mode>(flow.type ? 'ask' : 'pickType')
  const [changedType, setChangedType] = useState(false)
  const models = useApi<ModelRef[]>('/api/models')
  if (!scan) return <Navigate to="/scan" replace />

  const log = (field: 'type' | 'model', predicted: string | null, corrected: string | null) => {
    api(`/api/scan/${scan.scanId}/feedback`, { body: { field, predicted, corrected } }).catch(() => {})
  }
  const modelMatch = scan.match.kind === 'model' && !changedType ? scan.match.best : null
  const go = () => nav('/scan/result')
  const rail = <Rail items={['rail_photos', 'rail_check', 'rail_confirm', 'rail_price'].map((k, i) => ({ label: t(k), state: i < 2 ? 'done' : i === 2 ? 'now' : 'todo' }))} />
  const photo = flow.images.find(Boolean)

  if (mode === 'pickType') {
    return (
      <Screen title={t('confirm_title')} tabs={false}>
        {rail}
        <H2>{t('pick_type')}</H2>
        <TypeGrid value={flow.type} onPick={(ty) => {
          if (!ty) return
          if (scan.type !== ty) log('type', scan.type === 'unknown' ? null : scan.type, ty)
          patch({ type: ty, modelId: null })
          setChangedType(true)
          setMode('ask')
        }} />
      </Screen>
    )
  }

  if (mode === 'pickModel') {
    const list = (models.data ?? []).filter((m) => !flow.type || m.type === flow.type)
    return (
      <Screen title={t('confirm_title')} tabs={false}>
        {rail}
        <H2>{t('pick_model')}</H2>
        {models.loading ? <Skeleton rows={4} /> : (
          <Rule>
            {list.map((m) => (
              <li key={m.id}>
                <button onClick={() => { log('model', modelMatch?.model.id ?? null, m.id); patch({ modelId: m.id, type: m.type }); go() }}
                  className="flex min-h-14 w-full items-center justify-between gap-2 py-2 text-left text-base font-semibold">
                  <span className="flex items-center gap-3"><Icon name={m.type} size={22} />{m.brand} {m.model}</span><Icon name="chevR" size={20} />
                </button>
              </li>
            ))}
          </Rule>
        )}
        <div className="mt-4"><Btn variant="secondary" onClick={() => { log('model', modelMatch?.model.id ?? null, null); patch({ modelId: null }); go() }}>{t('not_listed')}</Btn></div>
      </Screen>
    )
  }

  return (
    <Screen title={t('confirm_title')} tabs={false}>
      {rail}

      <div className="mt-5 rounded-3xl bg-white shadow-card">
        <div className="flex gap-3 p-3">
          {photo ? <img src={photo} alt="" className="h-20 w-20 shrink-0 border border-hair object-cover" /> : <span className="inline-flex h-20 w-20 shrink-0 items-center justify-center border border-hair"><Icon name={flow.type ?? 'box'} size={36} /></span>}
          <div className="min-w-0">
            <p className="text-sm font-medium text-mute">{modelMatch ? t('is_your_device') : t('type_only_q')}</p>
            <p className="mt-0.5 text-xl font-bold leading-tight">{modelMatch ? `${modelMatch.model.brand} ${modelMatch.model.model}` : flow.type ? t('type.' + flow.type) : '-'}</p>
            <p className="mt-1 flex flex-wrap gap-1"><Tag>{t('category')}: {flow.type ? t('type.' + flow.type) : '-'}</Tag></p>
          </div>
        </div>
        <div className="border-t border-hair p-3">
          <Confidence value={modelMatch ? modelMatch.confidence : changedType ? 1 : scan.typeConfidence} />
        </div>
      </div>

      {scan.ocrText.trim() && (
        <p className="mt-3 text-sm text-mute">{t('we_read')}: <span className="num font-semibold text-ink">{scan.ocrText.trim().slice(0, 80)}</span></p>
      )}

      {scan.resale
        ? <div className="mt-3"><Banner tone="ok" icon="check">{t('model_from_photo', { model: `${scan.resale.brand} ${scan.resale.model}` })}</Banner></div>
        : !modelMatch && <div className="mt-3"><Banner icon="info">{t('model_unreadable')}</Banner></div>}

      <p className="mt-4 text-center text-base font-bold">{t('confirm_required')}</p>
      <div className="mt-2 space-y-2">
        {modelMatch ? (
          <Btn onClick={() => { patch({ modelId: modelMatch.model.id, type: modelMatch.model.type }); go() }} icon="check">{t('yes_correct')}</Btn>
        ) : (
          <Btn onClick={go} disabled={!flow.type} icon="check">{t('yes_category')}</Btn>
        )}
        <Btn variant="secondary" icon="swap" onClick={() => { if (modelMatch) log('model', modelMatch.model.id, null); setMode('pickModel') }}>{t('choose_another')}</Btn>
        <Btn variant="ghost" onClick={() => setMode('pickType')}>{t('wrong')}</Btn>
      </div>
    </Screen>
  )
}
