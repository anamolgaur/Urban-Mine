import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useFlow } from '../../lib/flow.tsx'
import { useSession } from '../../lib/session.tsx'
import { useApi } from '../../lib/useApi.ts'
import { packFor } from '../../lib/devices.ts'
import { inr } from '../../lib/format.ts'
import type { Estimate, ModelRef, RepairComparison } from '../../lib/types.ts'
import { Screen, H2, Btn, Banner, SampleTag, Tag, Loading, ErrorNote } from '../../components/ui.tsx'
import Icon from '../../components/Icon.tsx'
import Composition from '../../components/Composition.tsx'

export default function Result() {
  const { t } = useLang()
  const nav = useNavigate()
  const { me } = useSession()
  const { flow, patch, reset } = useFlow()
  const city = me?.city ?? 'Delhi'
  const q = flow.type ? `city=${encodeURIComponent(city)}&type=${flow.type}${flow.modelId ? `&modelId=${flow.modelId}` : ''}` : null
  const est = useApi<Estimate>(me && q ? `/api/estimate?${q}` : null)
  const dec = useApi<RepairComparison>(me && q && flow.works !== null ? `/api/repair/decision?${q}&works=${flow.works}` : null)
  const models = useApi<ModelRef[]>('/api/models')

  useEffect(() => { if (est.data) patch({ estimate: est.data }) }, [est.data, patch])
  if (!flow.scan || !flow.type) return <Navigate to="/scan" replace />

  const model = models.data?.find((m) => m.id === flow.modelId)
  const e = est.data
  const qty = flow.qty
  const hasPack = packFor(flow.type) !== null

  return (
    <Screen title={t('result_title')} tabs={false}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-lg font-bold"><Icon name={flow.type} />{model ? `${model.brand} ${model.model}` : t('type.' + flow.type)}</p>
          <p className="mt-1 flex flex-wrap gap-1"><Tag>{t('type.' + flow.type)}</Tag><Tag tone={model ? 'ok' : 'plain'}>{model ? t('model_confirmed') : t('type_only_tag')}</Tag></p>
        </div>
        <SampleTag />
      </div>

      {est.error && <ErrorNote message={est.error} />}
      {est.loading && <Loading />}
      {e && (
        <>
          <H2>{t('price_estimate')}</H2>
          <div className="border-2 border-ink bg-white p-4">
            <p className="text-sm font-semibold uppercase text-mute">{t('price_range')}</p>
            <p className="num mt-1 text-3xl font-semibold leading-tight">
              <span className="border-b-4 border-amber">{inr(e.low * qty)}</span> – <span className="border-b-4 border-amber">{inr(e.high * qty)}</span>
            </p>
            <p className="mt-2 text-sm text-mute">{e.basis === 'model' ? t('range_model') : t('range_type')} {t('not_an_offer')}</p>
            <div className="mt-3 flex items-center justify-between border-t border-hair pt-3">
              <span className="text-sm font-semibold">{t('how_many')}</span>
              <span className="flex items-center">
                <button aria-label={t('less')} onClick={() => patch({ qty: Math.max(1, qty - 1) })} className="min-h-11 min-w-11 border border-ink text-xl font-bold">−</button>
                <span className="num min-w-12 border-y border-ink bg-white py-2.5 text-center font-semibold" aria-live="polite">{qty}</span>
                <button aria-label={t('more')} onClick={() => patch({ qty: Math.min(99, qty + 1) })} className="min-h-11 min-w-11 border border-ink text-xl font-bold">+</button>
              </span>
            </div>
          </div>

          <H2>{t('whats_inside')}</H2>
          <Composition est={e} qty={qty} />
          <p className="mt-2 text-sm text-mute">{t('rates_for', { city })}</p>
        </>
      )}

      <H2>{t('repair_q')}</H2>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('repair_q')}>
        {[true, false].map((v) => (
          <button key={String(v)} role="radio" aria-checked={flow.works === v} onClick={() => patch({ works: v })}
            className={`min-h-12 border border-ink px-3 font-semibold ${flow.works === v ? 'bg-ink text-paper' : 'bg-white'}`}>
            {flow.works === v && <Icon name="check" size={16} className="mr-1 inline" />}{v ? t('yes_works') : t('no_dead')}
          </button>
        ))}
      </div>
      {flow.works === false && <p className="mt-2 text-sm text-mute">{t('dead_note')}</p>}
      {flow.works !== null && dec.data && flow.works && (
        <div className={`mt-3 border-2 p-3 ${dec.data.recommend === 'repair' ? 'border-ink bg-amber/25' : 'border-ink bg-white'}`}>
          <p className="flex items-center gap-2 font-bold"><Icon name={dec.data.recommend === 'repair' ? 'repair' : 'lots'} />{dec.data.recommend === 'repair' ? t('repair_instead') : t('recycling_better')}</p>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {([['cmp_repair_cost', dec.data.repair_cost], ['cmp_resale', dec.data.resale_if_repaired], ['cmp_recycle', dec.data.recycle_value * qty], ['cmp_net', dec.data.net_if_repaired]] as const).map(([k, v]) => (
                <tr key={k} className="border-b border-hair"><td className="py-1.5">{t(k)}</td><td className="num py-1.5 text-right font-semibold">{inr(v)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 flex items-center gap-2 text-sm"><SampleTag />{t('cmp_note')}</p>
          {dec.data.recommend === 'repair' && <div className="mt-3"><Btn variant="secondary" onClick={() => nav('/repair')} icon="repair">{t('see_repair')}</Btn></div>}
        </div>
      )}

      <div className="mt-6 space-y-2">
        {!hasPack && <Banner icon="info">{t('no_pack')}</Banner>}
        <Btn onClick={() => nav(hasPack ? '/safety' : '/sell')} disabled={!e} icon={hasPack ? 'shield' : 'lots'}>{hasPack ? t('dismantle_cta') : t('sell_whole_cta')}</Btn>
        <Btn variant="secondary" onClick={() => { reset(); nav('/scan') }} icon="scan">{t('scan_another')}</Btn>
      </div>
    </Screen>
  )
}
