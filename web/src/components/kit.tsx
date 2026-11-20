import type { ReactNode } from 'react'
import Icon from './Icon.tsx'
import Illustration, { type Art } from './Illustration.tsx'
import { Tag } from './ui.tsx'
import { useLang } from '../lib/i18n.tsx'
import type { LotStatus } from '../lib/types.ts'

/** Lot status as an icon plus text (never colour alone). */
export function StatusChip({ status }: { status: LotStatus }) {
  const { t } = useLang()
  const cfg = { open: ['box', 'plain'], listed: ['clock', 'amber'], sold: ['check', 'ok'], held: ['lock', 'bad'] } as const
  const [icon, tone] = cfg[status]
  const tones = { plain: 'border-ink text-ink', amber: 'border-ink bg-amber text-ink', ok: 'border-ok text-ok', bad: 'border-bad text-bad' }
  return (
    <span className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-sm font-semibold uppercase leading-tight ${tones[tone]}`}>
      <Icon name={icon} size={14} />{t('status.' + status)}
    </span>
  )
}

/** A big number with a small label: the basic unit for money, weight and counts. */
export function Stat({ label, value, note, size = 'md' }: { label: string; value: ReactNode; note?: ReactNode; size?: 'md' | 'lg' }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-mute">{label}</p>
      <p className={`num font-semibold leading-tight ${size === 'lg' ? 'text-4xl' : 'text-2xl'}`}>{value}</p>
      {note && <p className="text-sm text-mute">{note}</p>}
    </div>
  )
}

/** Horizontal meter, used for confidence and progress. Exposes its value to screen readers. */
export function Meter({ value, label, valueText, tone = 'ink' }: { value: number; label: string; valueText?: string; tone?: 'ink' | 'amber' | 'ok' }) {
  const v = Math.max(0, Math.min(1, value))
  const fill = { ink: 'bg-ink', amber: 'bg-amber', ok: 'bg-ok' }[tone]
  return (
    <div>
      <div className="h-3 w-full border border-ink bg-white" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-valuetext={valueText}>
        <div className={`h-full ${fill} transition-[width] duration-500`} style={{ width: `${v * 100}%` }} />
      </div>
    </div>
  )
}

export type RailItem = { label: string; state: 'done' | 'now' | 'todo' }
/** Numbered progress rail: finished steps show a tick, the current step is amber. */
export function Rail({ items }: { items: RailItem[] }) {
  return (
    <ol className="flex items-start">
      {items.map((it, i) => (
        <li key={i} className="flex flex-1 flex-col items-center text-center" aria-current={it.state === 'now' ? 'step' : undefined}>
          <div className="flex w-full items-center">
            <span className={`h-0.5 flex-1 ${i === 0 ? 'bg-transparent' : it.state === 'todo' ? 'bg-hair' : 'bg-ink'}`} />
            <span className={`num flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink text-sm font-bold ${it.state === 'done' ? 'bg-ink text-paper' : it.state === 'now' ? 'bg-amber' : 'bg-white text-mute'}`}>
              {it.state === 'done' ? <Icon name="check" size={16} /> : i + 1}
            </span>
            <span className={`h-0.5 flex-1 ${i === items.length - 1 ? 'bg-transparent' : it.state === 'done' ? 'bg-ink' : 'bg-hair'}`} />
          </div>
          <span className={`mt-1 text-sm leading-tight ${it.state === 'now' ? 'font-bold' : 'text-mute'}`}>{it.label}</span>
        </li>
      ))}
    </ol>
  )
}

export function EmptyState({ art, title, body, action }: { art: Art; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center border border-dashed border-ink bg-white px-4 py-8 text-center">
      <Illustration art={art} className="h-24 w-36" />
      <p className="mt-2 text-lg font-bold">{title}</p>
      {body && <p className="mt-1 max-w-xs text-sm text-mute">{body}</p>}
      {action && <div className="mt-4 w-full max-w-xs">{action}</div>}
    </div>
  )
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  const { t } = useLang()
  return (
    <div role="status" aria-label={t('loading')} className="animate-pulse space-y-3 py-4">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-12 border border-hair bg-sunk" style={{ width: `${100 - i * 8}%` }} />)}
      <span className="sr-only">{t('loading')}</span>
    </div>
  )
}

/** Compact label/value row for ruled definition lists. */
export function KV({ k, v, mono = false }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-2 text-base">
      <dt className="shrink-0 text-mute">{k}</dt>
      <dd className={`text-right font-semibold ${mono ? 'num' : ''}`}>{v}</dd>
    </div>
  )
}

/** The always-visible draft notice for safety content. Text comes from the safety pack so it is translated. */
export function DraftRibbon({ text }: { text: string }) {
  return (
    <div role="note" className="flex items-center gap-2 border-y-2 border-bad bg-white px-3 py-2 text-sm font-bold uppercase leading-snug text-bad">
      <Icon name="alert" size={20} className="shrink-0" />
      <span>{text}</span>
    </div>
  )
}

export { Tag }
