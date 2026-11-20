import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useFlow } from '../../lib/flow.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { pct } from '../../lib/format.ts'
import type { ModelRef } from '../../lib/types.ts'
import { Screen, H2, Btn, Banner, Tag, Rule, Loading } from '../../components/ui.tsx'
import Icon from '../../components/Icon.tsx'
import { TypeGrid } from './Scan.tsx'

type Mode = 'ask' | 'pickModel' | 'pickType'

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

  if (mode === 'pickType') {
    return (
      <Screen title={t('confirm_title')} tabs={false}>
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
        <H2>{t('pick_model')}</H2>
        {models.loading ? <Loading /> : (
          <Rule>
            {list.map((m) => (
              <li key={m.id}>
                <button onClick={() => { log('model', modelMatch?.model.id ?? null, m.id); patch({ modelId: m.id, type: m.type }); go() }}
                  className="flex min-h-12 w-full items-center justify-between py-2 text-left font-medium">
                  <span>{m.brand} {m.model}</span><Icon name="chevR" size={20} />
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
      {scan.ocrText.trim() && (
        <>
          <H2>{t('we_read')}</H2>
          <p className="num whitespace-pre-wrap break-words border border-hair bg-white p-2 text-sm">{scan.ocrText.trim().slice(0, 200)}</p>
        </>
      )}

      {modelMatch ? (
        <>
          <H2>{t('model_guess')}</H2>
          <div className="border-2 border-ink bg-white p-4">
            <p className="text-lg font-semibold">{t('probably')} {modelMatch.model.brand} {modelMatch.model.model}.</p>
            <p className="mt-1 text-lg font-semibold">{t('is_right')}</p>
            <p className="mt-2 flex items-center gap-2 text-sm"><Tag>{pct(modelMatch.confidence)} {t('match')}</Tag><span className="text-mute">{t('not_certain')}</span></p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Btn onClick={() => { patch({ modelId: modelMatch.model.id, type: modelMatch.model.type }); go() }} icon="check">{t('yes')}</Btn>
            <Btn variant="secondary" onClick={() => { log('model', modelMatch.model.id, null); setMode('pickModel') }} icon="x">{t('no')}</Btn>
          </div>
        </>
      ) : (
        <>
          <H2>{t('type_only')}</H2>
          <Banner icon="info">{t('model_unreadable')}</Banner>
          <div className="mt-3 flex items-center justify-between border border-ink bg-white p-3">
            <span className="flex items-center gap-2 font-semibold"><Icon name={flow.type ?? 'box'} />{flow.type ? t('type.' + flow.type) : '-'}</span>
            {!changedType && flow.type && <Tag>{pct(scan.typeConfidence)} {t('sure')}</Tag>}
          </div>
          <div className="mt-3 space-y-2">
            <Btn onClick={go} disabled={!flow.type}>{t('continue')}</Btn>
            <Btn variant="secondary" onClick={() => setMode('pickModel')}>{t('pick_model_manual')}</Btn>
          </div>
        </>
      )}

      <div className="mt-4 border-t border-hair pt-3">
        <Btn variant="ghost" full={false} onClick={() => setMode('pickType')}>{t('wrong')}</Btn>
      </div>
    </Screen>
  )
}
