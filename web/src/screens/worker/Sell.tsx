import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useFlow } from '../../lib/flow.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { packFor } from '../../lib/devices.ts'
import { inr } from '../../lib/format.ts'
import type { Lot, SafetyPack } from '../../lib/types.ts'
import { Screen, H2, Btn, Banner, Field, inputCls, ErrorNote, Tag, SampleTag } from '../../components/ui.tsx'
import { Rail, Meter, KV, StatusChip } from '../../components/kit.tsx'
import Photo from '../../components/Photo.tsx'
import Icon from '../../components/Icon.tsx'

export default function Sell() {
  const { t, contentLang: lang } = useLang()
  const nav = useNavigate()
  const { flow, patch } = useFlow()
  const pack = flow.type ? packFor(flow.type) : null
  const safety = useApi<SafetyPack>(pack ? `/api/safety/${pack}?lang=${lang}` : null)
  const est = flow.estimate
  const [weight, setWeight] = useState<string>(est ? String(Math.round(est.weight_kg * flow.qty * 100) / 100) : '')
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsMsg, setGpsMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!flow.scan || !flow.type || !est) return <Navigate to="/scan" replace />
  const lot = flow.lot
  const stepsTotal = safety.data?.steps.length ?? 0
  const stepsDone = Object.keys(flow.done).length
  const photoHashes = [...new Set([...flow.scan.photoHashes, ...flow.extraHashes])]
  const ready = !pack || safety.data

  function locate() {
    setGpsMsg(null)
    if (!navigator.geolocation) { setGpsMsg(t('gps_unavailable')); return }
    navigator.geolocation.getCurrentPosition(
      (p) => setGps({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGpsMsg(t('gps_denied')),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function create() {
    setBusy(true); setErr(null)
    try {
      const l = await api<Lot>('/api/lots', {
        body: {
          items: [{ model_id: flow.modelId, type: flow.type, qty: flow.qty, ...(flow.condition ? { grade: flow.condition.grade, grade_source: flow.condition.source } : {}) }],
          weight_kg: Number(weight), steps_done: stepsDone, steps_total: stepsTotal, photo_hashes: photoHashes, gps,
        },
      })
      patch({ lot: l })
      window.scrollTo(0, 0)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  async function list() {
    if (!lot) return
    setBusy(true); setErr(null)
    try {
      await api(`/api/lots/${lot.id}/list`, { method: 'POST', body: {} })
      nav(`/offers/${lot.id}`)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const rail = <Rail items={['rail_safety', 'rail_lot', 'rail_sale'].map((k, i) => ({ label: t(k), state: i === 0 ? 'done' : i === 1 ? (lot ? 'done' : 'now') : lot ? 'now' : 'todo' }))} />

  return (
    <Screen title={t('sell_title')} tabs={false}>
      <div className="pb-24">
        {rail}

        {!lot ? (
          <>
            <H2>{t('lot_summary')}</H2>
            <dl className="divide-y divide-hair border-y border-hair">
              <KV k={t('items')} v={`${flow.qty} × ${t('type.' + flow.type)}`} />
              {flow.condition && <KV k={t('pc_title')} v={t('pc_grade', { g: flow.condition.grade })} />}
              <KV k={t('est_value')} v={<>{inr(est.low * flow.qty)} – {inr(est.high * flow.qty)} <SampleTag /></>} mono />
              <div className="py-2">
                <div className="flex justify-between text-base"><dt className="text-mute">{t('safety_done')}</dt><dd className="num font-semibold">{stepsTotal ? `${stepsDone}/${stepsTotal}` : t('none_needed')}</dd></div>
                {stepsTotal > 0 && <div className="mt-1"><Meter value={stepsDone / stepsTotal} label={t('safety_done')} tone="ok" /></div>}
              </div>
            </dl>

            <H2>{t('photo_evidence')}</H2>
            <ul className="grid grid-cols-4 gap-2" aria-label={t('photo_evidence')}>
              {flow.images.filter(Boolean).map((src, i) => <li key={'s' + i}><img src={src!} alt={`${t('photo')} ${i + 1}`} className="aspect-square w-full border border-ink object-cover" /></li>)}
              {flow.extraHashes.map((h) => <li key={h}><Photo hash={h} className="aspect-square" /></li>)}
            </ul>
            <p className="mt-1 text-sm text-mute">{t('photos_count', { n: photoHashes.length })}</p>

            <H2>{t('declared_weight')}</H2>
            <Field label={t('weight_kg_label')} hint={t('weight_hint')}>
              <input className={`${inputCls} num text-lg`} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ''))} />
            </Field>

            <H2 right={<Tag tone={gps ? 'ok' : 'plain'}>{gps ? `✓ ${t('loc_added_ok')}` : t('loc_missing')}</Tag>}>{t('loc_status')}</H2>
            <p className="mb-2 text-base text-mute">{t('gps_why')}</p>
            <Btn variant="secondary" onClick={locate} icon="pin">{gps ? t('location_added') : t('add_location')}</Btn>
            {gps && <p className="num mt-1 text-sm">{gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}</p>}
            {gpsMsg && <p className="mt-1 text-base text-bad">{gpsMsg}</p>}

            <H2>{t('hash_status')}</H2>
            <div className="border border-hair bg-white p-3">
              <p className="flex items-center gap-2 text-base font-semibold"><Icon name="link" size={20} />{t('hash_pending')}</p>
              <p className="mt-2 text-base leading-snug text-mute">{t('hash_explain_simple')}</p>
            </div>
            {err && <ErrorNote message={err} />}
          </>
        ) : (
          <>
            <section className="mt-5 border-2 border-ok bg-white" aria-label={t('lot_created')}>
              <p className="flex items-center gap-2 bg-ok px-3 py-2 text-lg font-bold text-white"><Icon name="check" size={22} />{t('lot_created')}</p>
              <dl className="divide-y divide-hair px-3">
                <KV k={t('lot_id')} v={lot.id.slice(0, 8).toUpperCase()} mono />
                <KV k={t('sale_status')} v={<StatusChip status={lot.status} />} />
                <KV k={t('hash_status')} v={<Tag tone={lot.chain_ok ? 'ok' : 'bad'}>{lot.chain_ok ? `✓ ${t('chain_ok')}` : t('chain_bad')}</Tag>} />
                <KV k={t('loc_status')} v={<Tag tone={lot.gps ? 'ok' : 'plain'}>{lot.gps ? `✓ ${t('loc_added_ok')}` : t('loc_missing')}</Tag>} />
              </dl>
              <div className="border-t border-hair p-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-mute">{t('record_hash')}</p>
                <p className="num break-all text-2xl font-semibold">{lot.short_hash}</p>
                <p className="num mt-1 break-all text-sm text-mute">{lot.hash}</p>
              </div>
            </section>
            <p className="mt-3 text-base leading-snug text-mute">{t('hash_explain_simple')}</p>
            {lot.flags.length > 0 && <div className="mt-3"><Banner icon="info">{t('flag_note')}{' '}{lot.flags.map((f) => t('flag.' + f.kind)).join(', ')}</Banner></div>}
            {err && <ErrorNote message={err} />}
            <p className="mt-3 flex items-center gap-2 text-sm text-mute"><SampleTag /><Tag tone="bad">{t('payout_mocked')}</Tag></p>
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-ink bg-paper p-3">
        {!lot ? (
          <Btn onClick={create} disabled={busy || !ready || !(Number(weight) > 0)} icon="link">{busy ? t('saving') : t('create_lot')}</Btn>
        ) : (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Btn onClick={list} disabled={busy} icon="chevR">{t('put_on_sale')}</Btn>
            <Btn variant="secondary" full={false} onClick={() => nav('/lots')}>{t('keep_for_later')}</Btn>
          </div>
        )}
      </div>
    </Screen>
  )
}
