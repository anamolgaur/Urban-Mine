import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon.tsx'
import { useLang, LANGS } from '../lib/i18n.tsx'
import type { Lang } from '../lib/types.ts'

/** Square mono tag. `tone` never carries meaning alone: every tag has text. */
export function Tag({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'ok' | 'bad' | 'amber' | 'ink' }) {
  const tones = {
    plain: 'bg-sunk text-ink',
    ok: 'bg-brand-soft text-brand',
    bad: 'bg-bad/10 text-bad',
    amber: 'bg-gold-soft text-gold-ink',
    ink: 'bg-brand text-onbrand',
  }
  return <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-semibold leading-snug ${tones[tone]}`}>{children}</span>
}

export function SampleTag() {
  const { t } = useLang()
  return <Tag tone="amber">{t('sample')}</Tag>
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'amber' | 'danger' | 'ghost'; full?: boolean; icon?: string }
export function Btn({ variant = 'primary', full = true, icon, className = '', children, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-brand text-onbrand border border-brand shadow-card',
    secondary: 'bg-white text-ink border border-hair shadow-card',
    amber: 'bg-amber text-ink border border-amber',
    danger: 'bg-white text-bad border border-bad/40',
    ghost: 'bg-transparent text-brand underline underline-offset-4',
  }[variant]
  return (
    <button {...rest} className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-5 py-2 text-lg font-semibold active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${v} ${full ? 'w-full' : ''} ${className}`}>
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  )
}

export function LangToggle() {
  const { lang, setLang, t } = useLang()
  return (
    <label data-tour="lang" className="relative inline-flex min-h-11 items-center rounded-full border border-hair bg-white">
      <span className="pointer-events-none absolute left-2"><Icon name="globe" size={18} /></span>
      <select aria-label={t('switch_lang')} value={lang} onChange={(e) => setLang(e.target.value as Lang)}
        className="min-h-11 appearance-none rounded-full bg-transparent py-0 pl-8 pr-3 text-base font-semibold">
        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </label>
  )
}

/** Header present on every screen: back, title, language switch. */
export function Header({ title, back = true, brand = false }: { title: string; back?: boolean | string; brand?: boolean }) {
  const nav = useNavigate()
  const { t } = useLang()
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center gap-2 bg-paper/95 px-3 backdrop-blur">
      {back ? (
        <button onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} aria-label={t('back')} className="-ml-1 inline-flex min-h-12 min-w-12 items-center justify-center rounded-full hover:bg-sunk">
          <Icon name="chevL" />
        </button>
      ) : brand ? (
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand"><Icon name="lots" size={20} className="text-amber" /></span>
      ) : null}
      <h1 className="flex-1 truncate text-xl font-bold">{title}</h1>
      <LangToggle />
    </header>
  )
}

export function Screen({ title, back = true, brand = false, children, tabs = true }: { title: string; back?: boolean | string; brand?: boolean; children: ReactNode; tabs?: boolean }) {
  return (
    <div className={tabs ? 'pb-24' : 'pb-8'}>
      <Header title={title} back={back} brand={brand} />
      <main id="main" className="screen-enter px-4 pt-4">{children}</main>
    </div>
  )
}

export function H2({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-end justify-between gap-2">
      <h2 className="text-lg font-bold">{children}</h2>
      {right}
    </div>
  )
}

export function Banner({ tone = 'plain', icon = 'info', children }: { tone?: 'plain' | 'bad' | 'amber' | 'ok'; icon?: string; children: ReactNode }) {
  const c = { plain: 'bg-white text-ink border border-hair', bad: 'bg-bad-soft text-bad', amber: 'bg-gold-soft text-ink', ok: 'bg-brand-soft text-brand' }[tone]
  return (
    <div role={tone === 'bad' ? 'alert' : 'note'} className={`flex gap-3 rounded-2xl px-4 py-3 text-base leading-snug ${c}`}>
      <Icon name={icon} size={20} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export const Rule = ({ children }: { children: ReactNode }) => <ul className="divide-y divide-hair overflow-hidden rounded-3xl bg-white px-4 shadow-card">{children}</ul>

export function Loading() {
  const { t } = useLang()
  return (
    <div role="status" className="animate-pulse space-y-3 py-6">
      {[100, 92, 84].map((w) => <div key={w} className="h-14 rounded-2xl bg-sunk" style={{ width: `${w}%` }} />)}
      <span className="sr-only">{t('loading')}</span>
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="my-4"><Banner tone="bad" icon="alert">{message}</Banner></div>
}

export function EmergencyLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-bad-soft px-4 py-3 text-base font-semibold text-bad" role="note">
      <Icon name="alert" size={20} className="shrink-0" />
      <span>{text}</span>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-mute">{hint}</span>}
    </label>
  )
}
export const inputCls = 'min-h-14 w-full rounded-2xl border border-hair px-4 text-lg focus:border-brand'
