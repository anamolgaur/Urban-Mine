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
import Icon from '../../components/Icon.tsx'

export default function Sell() {
  const { t, lang } = useLang()
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
          items: [{ model_id: flow.modelId, type: flow.type, qty: flow.qty }],
          weight_kg: Number(weight), steps_done: stepsDone, steps_total: stepsTotal, photo_hashes: photoHashes, gps,
        },
      })
      patch({ lot: l })
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

  return (
    <Screen title={t('sell_title')} tabs={false}>
      {!lot ? (
        <>
          <H2>{t('lot_summary')}</H2>
          <dl className="divide-y divide-hair border-y border-hair text-sm">
            {[
              [t('items'), `${flow.qty} × ${t('type.' + flow.type)}`],
              [t('safety_done'), stepsTotal ? `${stepsDone}/${stepsTotal}` : t('none_needed')],
              [t('photos'), String(photoHashes.length)],
              [t('est_value'), `${inr(est.low * flow.qty)} – ${inr(est.high * flow.qty)}`],
            ].map(([k, v]) => <div key={k} className="flex justify-between py-2"><dt className="text-mute">{k}</dt><dd className="num font-semibold">{v}</dd></div>)}
          </dl>

          <H2>{t('declared_weight')}</H2>
          <Field label={t('weight_kg_label')} hint={t('weight_hint')}>
            <input className={`${inputCls} num`} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ''))} />
          </Field>

          <H2>{t('location')}</H2>
          <p className="mb-2 text-sm text-mute">{t('gps_why')}</p>
          <Btn variant="secondary" onClick={locate} icon="pin">{gps ? t('location_added') : t('add_location')}</Btn>
          {gps && <p className="num mt-1 text-sm">{gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}</p>}
          {gpsMsg && <p className="mt-1 text-sm text-bad">{gpsMsg}</p>}

          {err && <ErrorNote message={err} />}
          <div className="mt-6">
            <Btn onClick={create} disabled={busy || !ready || !(Number(weight) > 0)} icon="link">{busy ? t('saving') : t('create_lot')}</Btn>
          </div>
        </>
      ) : (
        <>
          <div className="border-2 border-ink bg-white p-4">
            <p className="flex items-center gap-2 text-lg font-bold"><Icon name="check" className="text-ok" />{t('lot_created')}</p>
            <p className="mt-2 text-sm text-mute">{t('record_hash')}</p>
            <p className="num mt-1 break-all text-2xl font-semibold">{lot.short_hash}</p>
            <p className="num mt-1 break-all text-[12px] text-mute">{lot.hash}</p>
            <p className="mt-3 border-t border-hair pt-2 text-sm">{t('hash_note')}</p>
          </div>
          {lot.flags.length > 0 && (
            <div className="mt-3">
              <Banner icon="info">{t('flag_note')}{' '}{lot.flags.map((f) => t('flag.' + f.kind)).join(', ')}</Banner>
            </div>
          )}
          {err && <ErrorNote message={err} />}
          <div className="mt-5 space-y-2">
            <Btn onClick={list} disabled={busy} icon="chevR">{t('put_on_sale')}</Btn>
            <Btn variant="secondary" onClick={() => nav('/lots')}>{t('keep_for_later')}</Btn>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm text-mute"><SampleTag /><Tag>{t('payout_mocked')}</Tag></p>
        </>
      )}
    </Screen>
  )
}
