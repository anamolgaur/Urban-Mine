import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useFlow } from '../../lib/flow.tsx'
import { useSession } from '../../lib/session.tsx'
import { useApi } from '../../lib/useApi.ts'
import { packFor } from '../../lib/devices.ts'
import { inr, dateShort } from '../../lib/format.ts'
import type { Estimate, ModelRef, RepairComparison } from '../../lib/types.ts'
import { Screen, H2, Btn, Banner, SampleTag, Tag, ErrorNote } from '../../components/ui.tsx'
import { Skeleton, Rail } from '../../components/kit.tsx'
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
  const updated = e ? Object.values(e.rates).map((r) => r.updated_at).sort().pop() : null

  return (
    <Screen title={t('result_title')} tabs={false}>
      <div className="pb-28">
        <Rail items={['rail_photos', 'rail_check', 'rail_confirm', 'rail_price'].map((k, i) => ({ label: t(k), state: i < 3 ? 'done' : 'now' }))} />

        <div className="mt-5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xl font-bold leading-tight"><Icon name={flow.type} size={26} />{model ? `${model.brand} ${model.model}` : t('type.' + flow.type)}</p>
            <p className="mt-2 flex flex-wrap gap-1"><Tag>{t('type.' + flow.type)}</Tag><Tag tone={model ? 'ok' : 'plain'}>{model ? t('model_confirmed') : t('type_only_tag')}</Tag></p>
          </div>
          <SampleTag />
        </div>

        {est.error && <ErrorNote message={est.error} />}
        {est.loading && <Skeleton rows={4} />}
        {e && (
          <>
            <section className="mt-5 border-2 border-ink bg-white" aria-label={t('price_estimate')}>
              <div className="p-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-mute">{t('price_range')} · {t('for_items', { n: qty })}</p>
                <p className="num mt-1 text-4xl font-semibold leading-tight">
                  <span className="border-b-4 border-amber">{inr(e.low * qty)}</span><span className="px-1 text-mute">–</span><span className="border-b-4 border-amber">{inr(e.high * qty)}</span>
                </p>
                <p className="mt-2 text-base leading-snug text-mute">{e.basis === 'model' ? t('range_model') : t('range_type')} {t('not_an_offer')}</p>
                {updated && <p className="mt-1 flex items-center gap-1 text-sm text-mute"><Icon name="clock" size={14} />{t('rates_updated', { date: dateShort(updated) })}</p>}
              </div>
              <div className="flex items-center justify-between border-t border-hair px-4 py-2">
                <span className="text-base font-semibold">{t('how_many')}</span>
                <span className="flex items-center">
                  <button aria-label={t('less')} onClick={() => patch({ qty: Math.max(1, qty - 1) })} className="min-h-11 min-w-11 border border-ink text-xl font-bold">−</button>
                  <span className="num min-w-12 border-y border-ink bg-white py-2.5 text-center text-lg font-semibold" aria-live="polite">{qty}</span>
                  <button aria-label={t('more')} onClick={() => patch({ qty: Math.min(99, qty + 1) })} className="min-h-11 min-w-11 border border-ink text-xl font-bold">+</button>
                </span>
              </div>
            </section>

            <details className="mt-2 border border-hair bg-white">
              <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-base font-semibold"><Icon name="info" size={18} />{t('calc_title')}</summary>
              <p className="px-3 pb-3 text-base leading-snug text-mute">{t('calc_body')}</p>
            </details>

            <H2>{t('whats_inside')}</H2>
            <Composition est={e} qty={qty} />
            <p className="mt-2 text-sm text-mute">{t('rates_for', { city })}</p>
          </>
        )}

        <H2>{t('verdict_title')}</H2>
        <p className="mb-2 text-base font-semibold">{t('repair_q')}</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('repair_q')}>
          {[true, false].map((v) => (
            <button key={String(v)} role="radio" aria-checked={flow.works === v} onClick={() => patch({ works: v })}
              className={`min-h-12 border border-ink px-3 text-base font-semibold ${flow.works === v ? 'bg-ink text-paper' : 'bg-white'}`}>
              {flow.works === v && <Icon name="check" size={16} className="mr-1 inline" />}{v ? t('yes_works') : t('no_dead')}
            </button>
          ))}
        </div>
        {flow.works === null && <p className="mt-2 text-sm text-mute">{t('verdict_ask')}</p>}
        {flow.works === false && <p className="mt-2 text-base text-mute">{t('dead_note')}</p>}
        {flow.works && dec.data && (
          <div className="mt-3 border-2 border-ink bg-white">
            <p className={`flex items-center gap-2 p-3 text-lg font-bold ${dec.data.recommend === 'repair' ? 'bg-amber/30' : ''}`}>
              <Icon name={dec.data.recommend === 'repair' ? 'repair' : 'lots'} />{dec.data.recommend === 'repair' ? t('repair_instead') : t('recycling_better')}
            </p>
            <table className="w-full text-base">
              <thead>
                <tr className="border-y border-ink text-left font-mono text-sm uppercase"><th className="px-3 py-1" /><th className="px-3 py-1 text-right">{t('col_repair')}</th><th className="px-3 py-1 text-right">{t('col_recycle')}</th></tr>
              </thead>
              <tbody>
                <tr className="border-b border-hair"><td className="px-3 py-2">{t('cmp_repair_cost')}</td><td className="num px-3 py-2 whitespace-nowrap text-right">−{' '}{inr(dec.data.repair_cost)}</td><td className="num px-3 py-2 text-right">–</td></tr>
                <tr className="border-b border-hair"><td className="px-3 py-2">{t('cmp_value')}</td><td className="num px-3 py-2 text-right">{inr(dec.data.resale_if_repaired)}</td><td className="num px-3 py-2 text-right">{inr(dec.data.recycle_value * qty)}</td></tr>
                <tr><td className="px-3 py-2 font-bold">{t('cmp_net')}</td><td className="num px-3 py-2 text-right font-bold">{inr(dec.data.net_if_repaired)}</td><td className="num px-3 py-2 text-right font-bold">{inr(dec.data.recycle_value * qty)}</td></tr>
              </tbody>
            </table>
            <p className="flex flex-wrap items-center gap-2 border-t border-hair p-3 text-sm text-mute"><SampleTag />{t('verdict_repair_note')}</p>
            {dec.data.recommend === 'repair' && <div className="px-3 pb-3"><Btn variant="secondary" onClick={() => nav('/repair')} icon="repair">{t('see_repair')}</Btn></div>}
          </div>
        )}

        {!hasPack && <div className="mt-4"><Banner icon="info">{t('no_pack')}</Banner></div>}
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-ink bg-paper p-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Btn onClick={() => nav(hasPack ? '/safety' : '/sell')} disabled={!e} icon={hasPack ? 'shield' : 'lots'}>{hasPack ? t('dismantle_cta') : t('sell_whole_cta')}</Btn>
          <Btn variant="secondary" full={false} aria-label={t('scan_another')} onClick={() => { reset(); nav('/scan') }} icon="scan" className="px-3"><span className="sr-only">{t('scan_another')}</span></Btn>
        </div>
      </div>
    </Screen>
  )
}
