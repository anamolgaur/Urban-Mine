import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useFlow } from '../../lib/flow.tsx'
import { useSession } from '../../lib/session.tsx'
import { useApi } from '../../lib/useApi.ts'
import { packFor } from '../../lib/devices.ts'
import { inr, dateShort } from '../../lib/format.ts'
import { speak, stopSpeaking, useVoiceAvailable } from '../../lib/speech.ts'
import type { Estimate, ModelRef, RepairComparison, ResaleModel } from '../../lib/types.ts'
import { Screen, H2, Btn, Banner, SampleTag, Tag, ErrorNote, inputCls } from '../../components/ui.tsx'
import { Skeleton, Rail } from '../../components/kit.tsx'
import Icon from '../../components/Icon.tsx'
import Composition from '../../components/Composition.tsx'
import PhotoCheck from '../../components/PhotoCheck.tsx'

export default function Result() {
  const { t, lang } = useLang()
  const nav = useNavigate()
  const [saying, setSaying] = useState(false)
  const hasVoice = useVoiceAvailable(lang)
  useEffect(() => () => stopSpeaking(), [])
  const { me } = useSession()
  const { flow, patch, reset } = useFlow()
  const city = me?.city ?? 'Delhi'
  const q = flow.type ? `city=${encodeURIComponent(city)}&type=${flow.type}${flow.modelId ? `&modelId=${flow.modelId}` : ''}` : null
  // A working device is priced by second-hand value once the worker has picked its model (or typed a price); otherwise by scrap.
  const resaleQ = flow.works && (flow.resaleId || flow.customPrice) ? `&works=true&condition=${flow.wear}${flow.resaleId ? `&resaleId=${flow.resaleId}` : `&custom=${flow.customPrice}`}` : ''
  const est = useApi<Estimate>(me && q && flow.works !== null ? `/api/estimate?${q}${flow.condition ? `&grade=${flow.condition.grade}` : ''}${resaleQ}` : null)
  const resale = useApi<ResaleModel[]>(flow.type && flow.works ? `/api/resale?type=${flow.type}` : null)
  // exact model from how it looks (on-device). Offered for phones and laptops; picked for you only when fairly sure and no label text matched.
  const typeLooks = (flow.type && !Array.isArray(flow.looks) ? flow.looks?.[flow.type] : null) ?? []
  const looks = typeLooks.filter((l) => (resale.data ?? []).some((m) => m.id === l.id))
  const lookTop = looks.filter((l) => l.p >= 0.08).slice(0, 3)
  const lookPick = looks[0] && looks[0].p >= 0.5 ? looks[0] : null
  const lookBrand = looks.length ? (() => { const by: Record<string, number> = {}; for (const l of typeLooks) by[l.brand] = (by[l.brand] ?? 0) + l.p; return Object.entries(by).sort((a, b) => b[1] - a[1])[0]?.[0] })() : undefined
  useEffect(() => { // the model list arrived after "yes, it works": apply the best guess then
    if (flow.works && !flow.resaleId && !flow.customPrice && resale.data) {
      const id = flow.scan?.resale?.id ?? lookPick?.id
      if (id) patch({ resaleId: id })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.works, resale.data])
  const nameOf = (id: string) => { const m = (resale.data ?? []).find((r) => r.id === id); return m ? `${m.brand} ${m.model}` : id }
  const [search, setSearch] = useState('')
  const [ownPrice, setOwnPrice] = useState('')
  const dec = useApi<RepairComparison>(me && q && flow.works !== null ? `/api/repair/decision?${q}&works=${flow.works}` : null)
  const models = useApi<ModelRef[]>('/api/models')

  useEffect(() => { if (est.data) patch({ estimate: est.data }) }, [est.data, patch])
  if (!flow.scan || !flow.type) return <Navigate to="/scan" replace />

  const model = models.data?.find((m) => m.id === flow.modelId)
  const e = est.data
  const qty = flow.qty
  const hasPack = packFor(flow.type) !== null
  // the one number shown by default: the middle of the range (so it already includes any condition grade)
  const baseline = e ? ((e.low + e.high) / 2) * qty : 0
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

        {/* First question: a working device is worth far more than its metal. */}
        <section className="mt-5 rounded-3xl bg-white shadow-card p-3" aria-label={t('repair_q')}>
          <p className="mb-2 text-lg font-bold">{t('works_q')}</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('works_q')}>
            {[true, false].map((v) => (
              <button key={String(v)} role="radio" aria-checked={flow.works === v} onClick={() => patch({ works: v, ...(v ? (!flow.resaleId && !flow.customPrice ? (flow.scan?.resale ? { resaleId: flow.scan.resale.id } : lookPick ? { resaleId: lookPick.id } : {}) : {}) : { resaleId: null, customPrice: null }) })}
                className={`min-h-14 rounded-2xl border border-hair px-3 text-base font-semibold ${flow.works === v ? 'bg-brand text-onbrand' : 'bg-white'}`}>
                {flow.works === v && <Icon name="check" size={16} className="mr-1 inline" />}{v ? t('yes_works') : t('no_dead')}
              </button>
            ))}
          </div>
          {flow.works === null && <p className="mt-2 text-sm text-mute">{t('works_why')}</p>}
        </section>

        {flow.works && (
          <section className="mt-3 rounded-2xl border border-hair bg-white p-3" aria-label={t('which_model')}>
            <p className="text-base font-bold">{t('which_model')}</p>
            {flow.scan?.resale && flow.resaleId === flow.scan.resale.id && (
              <div className="mt-2"><Banner tone="ok" icon="check">{t('model_from_photo', { model: `${flow.scan.resale.brand} ${flow.scan.resale.model}` })}</Banner></div>
            )}
            {!flow.scan?.resale && lookPick && flow.resaleId === lookPick.id && (
              <div className="mt-2"><Banner icon="info">{t('model_from_looks', { model: nameOf(lookPick.id) })}</Banner></div>
            )}
            {/* the likeliest models from how the phone looks: one tap to pick */}
            {lookTop.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-semibold text-mute">{t('looks_like')}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {lookTop.map((m) => (
                    <button key={m.id} onClick={() => patch({ resaleId: m.id, customPrice: null })} aria-pressed={flow.resaleId === m.id}
                      className={`min-h-11 rounded-full border px-3 text-sm font-semibold ${flow.resaleId === m.id ? 'border-brand bg-brand text-onbrand' : 'border-hair bg-white'}`}>
                      {nameOf(m.id)} <span className="num font-normal opacity-75">{Math.round(m.p * 100)}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <input className={`${inputCls} mt-2`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('model_search')} aria-label={t('model_search')} />
            <ul className="mt-2 max-h-72 overflow-y-auto">
              {(resale.data ?? []).filter((m) => `${m.brand} ${m.model}`.toLowerCase().includes(search.trim().toLowerCase()))
                .sort((a, b) => Number(b.brand === lookBrand) - Number(a.brand === lookBrand)) // the brand it looks like first
                .map((m) => (
                <li key={m.id}>
                  <button onClick={() => patch({ resaleId: m.id, customPrice: null })} aria-pressed={flow.resaleId === m.id}
                    className={`flex min-h-12 w-full items-center justify-between gap-2 border-b border-hair px-2 text-left text-base ${flow.resaleId === m.id ? 'bg-gold-soft font-bold' : ''}`}>
                    <span>{m.brand} {m.model}</span>{flow.resaleId === m.id && <Icon name="check" size={18} />}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm font-semibold">{t('not_in_list')}</p>
            <div className="mt-1 flex gap-2">
              <input className={`${inputCls} num`} inputMode="numeric" value={ownPrice} onChange={(e) => setOwnPrice(e.target.value.replace(/\D/g, ''))} placeholder={t('own_price')} aria-label={t('own_price')} />
              <Btn full={false} variant="secondary" disabled={!(Number(ownPrice) > 0)} onClick={() => patch({ resaleId: null, customPrice: Number(ownPrice) })}>{t('use_price')}</Btn>
            </div>
            <p className="mb-2 mt-4 text-base font-bold">{t('wear_q')}</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('wear_q')}>
              {(['good', 'fair', 'poor'] as const).map((w) => (
                <button key={w} role="radio" aria-checked={flow.wear === w} onClick={() => patch({ wear: w })}
                  className={`min-h-14 rounded-2xl border border-hair px-2 text-sm font-semibold leading-tight ${flow.wear === w ? 'bg-brand text-onbrand' : 'bg-white'}`}>{t('wear_' + w)}</button>
              ))}
            </div>
            {!flow.resaleId && !flow.customPrice && <p className="mt-2 text-sm text-mute">{t('pick_for_price')}</p>}
          </section>
        )}

        {est.error && <ErrorNote message={est.error} />}
        {est.loading && <Skeleton rows={4} />}
        {e && (
          <>
            {/* One number, big, and it can be read aloud: for people who do not read much. */}
            <section className="mt-5 rounded-3xl bg-white shadow-card" aria-label={t('baseline_title')}>
              <div className="p-4 text-center">
                <p className="text-sm font-medium text-mute">{t('baseline_title')} · {t('for_items', { n: qty })}</p>
                <p className="num mt-2 text-6xl font-semibold leading-none"><span className="inline-block border-b-4 border-amber/70 px-1 pb-2">{inr(baseline)}</span></p>
                <p className="mt-3 text-base leading-snug text-mute">{t('baseline_note')}</p>
                <div className="mt-3">
                  <button onClick={() => { if (saying) { stopSpeaking(); setSaying(false) } else { setSaying(true); speak(t('baseline_say', { amount: Math.round(baseline) }), lang, () => setSaying(false)) } }}
                    aria-pressed={saying} className={`flex min-h-14 w-full items-center justify-center gap-2 border-2 border-brand px-3 text-base font-bold ${saying ? 'bg-brand text-onbrand' : 'bg-white'}`}>
                    <Icon name="volume" size={24} />{saying ? t('stop_audio') : t('listen')}
                  </button>
                  {!hasVoice && <p className="mt-1 text-sm text-mute">{t('no_voice')}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-hair px-4 py-2">
                <span className="text-base font-semibold">{t('how_many')}</span>
                <span className="flex items-center">
                  <button aria-label={t('less')} onClick={() => patch({ qty: Math.max(1, qty - 1) })} className="min-h-11 min-w-11 rounded-xl border border-hair bg-white text-xl font-bold">−</button>
                  <span className="num min-w-12 border-y border-hair bg-white py-2.5 text-center text-lg font-semibold" aria-live="polite">{qty}</span>
                  <button aria-label={t('more')} onClick={() => patch({ qty: Math.min(99, qty + 1) })} className="min-h-11 min-w-11 rounded-xl border border-hair bg-white text-xl font-bold">+</button>
                </span>
              </div>
            </section>

            <details className="mt-3 rounded-2xl border border-hair bg-white">
              <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-3 text-base font-semibold"><Icon name="info" size={18} />{t('details_show')}</summary>
              <div className="px-3 pb-4">
            <section aria-label={t('price_estimate')} className="mt-2 rounded-2xl border border-hair bg-white p-3">
              <p className="text-sm font-medium text-mute">{t('price_range')} · {t('for_items', { n: qty })}</p>
              <p className="num mt-1 text-3xl font-semibold leading-tight">
                <span className="inline-block border-b-4 border-amber/70 pb-1">{inr(e.low * qty)}</span><span className="px-1 text-mute">–</span><span className="inline-block border-b-4 border-amber/70 pb-1">{inr(e.high * qty)}</span>
              </p>
              <p className="mt-2 text-base leading-snug text-mute">{e.basis === 'resale' ? t('range_resale') : e.basis === 'model' ? t('range_model') : t('range_type')} {t('not_an_offer')}</p>
              {updated && <p className="mt-1 flex items-center gap-1 text-sm text-mute"><Icon name="clock" size={14} />{t('rates_updated', { date: dateShort(updated) })}</p>}
            </section>

            <p className="mt-3 text-base leading-snug text-mute"><span className="font-semibold">{t('calc_title')}.</span> {t('calc_body')}</p>

            {e.basis !== 'resale' && <PhotoCheck factor={e.condition?.factor} />}

            <H2>{t('whats_inside')}</H2>
            {e.basis === 'resale' ? <p className="text-base text-mute">{t('resale_basis', { src: e.resale?.model?.source ?? t('your_price') })}</p> : <Composition est={e} qty={qty} />}
            <p className="mt-2 text-sm text-mute">{t('rates_for', { city })}</p>

        <H2>{t('verdict_title')}</H2>
{flow.works === false && <p className="mt-2 text-base text-mute">{t('dead_note')}</p>}
        {flow.works && dec.data && (
          <div className="mt-3 rounded-3xl bg-white shadow-card">
            <p className={`flex items-center gap-2 p-3 text-lg font-bold ${dec.data.recommend === 'repair' ? 'bg-gold-soft' : ''}`}>
              <Icon name={dec.data.recommend === 'repair' ? 'repair' : 'lots'} />{dec.data.recommend === 'repair' ? t('repair_instead') : t('recycling_better')}
            </p>
            <table className="w-full text-base">
              <thead>
                <tr className="border-y border-hair text-left text-sm"><th className="px-3 py-1" /><th className="px-3 py-1 text-right">{t('col_repair')}</th><th className="px-3 py-1 text-right">{t('col_recycle')}</th></tr>
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

              </div>
            </details>
          </>
        )}

        {!hasPack && <div className="mt-4"><Banner icon="info">{t('no_pack')}</Banner></div>}
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-hair bg-paper p-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Btn onClick={() => nav(hasPack && !flow.works ? '/safety' : '/sell')} disabled={!e} icon={hasPack && !flow.works ? 'shield' : 'lots'}>{hasPack && !flow.works ? t('dismantle_cta') : t('sell_whole_cta')}</Btn>
          <Btn variant="secondary" full={false} aria-label={t('scan_another')} onClick={() => { reset(); nav('/scan') }} icon="scan" className="px-3"><span className="sr-only">{t('scan_another')}</span></Btn>
        </div>
      </div>
    </Screen>
  )
}
