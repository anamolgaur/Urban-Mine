import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon.tsx'
import { useLang } from '../lib/i18n.tsx'

/** Square mono tag. `tone` never carries meaning alone: every tag has text. */
export function Tag({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'ok' | 'bad' | 'amber' | 'ink' }) {
  const tones = {
    plain: 'border-ink text-ink',
    ok: 'border-ok text-ok',
    bad: 'border-bad text-bad',
    amber: 'border-ink bg-amber text-ink',
    ink: 'border-ink bg-ink text-paper',
  }
  return <span className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-sm font-semibold uppercase leading-tight tracking-wide ${tones[tone]}`}>{children}</span>
}

export function SampleTag() {
  const { t } = useLang()
  return <Tag tone="amber">{t('sample')}</Tag>
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'amber' | 'danger' | 'ghost'; full?: boolean; icon?: string }
export function Btn({ variant = 'primary', full = true, icon, className = '', children, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-ink text-paper border border-ink',
    secondary: 'bg-transparent text-ink border border-ink',
    amber: 'bg-amber text-ink border border-ink',
    danger: 'bg-transparent text-bad border border-bad',
    ghost: 'bg-transparent text-ink underline underline-offset-4',
  }[variant]
  return (
    <button {...rest} className={`inline-flex min-h-12 items-center justify-center gap-2 px-4 py-2 text-base font-semibold active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 ${v} ${full ? 'w-full' : ''} ${className}`}>
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  )
}

export function LangToggle() {
  const { lang, setLang, t } = useLang()
  return (
    <button onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')} aria-label={t('switch_lang')}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 border border-ink px-2 font-mono text-sm font-semibold">
      <Icon name="globe" size={18} />
      <span className={lang === 'hi' ? 'bg-ink px-1 text-paper' : 'px-1'}>हि</span>
      <span className={lang === 'en' ? 'bg-ink px-1 text-paper' : 'px-1'}>EN</span>
    </button>
  )
}

/** Header present on every screen: back, title, language switch. */
export function Header({ title, back = true, brand = false }: { title: string; back?: boolean | string; brand?: boolean }) {
  const nav = useNavigate()
  const { t } = useLang()
  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center gap-2 border-b border-hair bg-paper px-3">
      {back ? (
        <button onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} aria-label={t('back')} className="-ml-1 inline-flex min-h-11 min-w-11 items-center justify-center">
          <Icon name="chevL" />
        </button>
      ) : brand ? (
        <span className="inline-flex h-8 w-8 items-center justify-center bg-ink"><Icon name="lots" size={18} className="text-amber" /></span>
      ) : null}
      <h1 className="flex-1 truncate font-cond text-xl font-bold uppercase tracking-wide">{title}</h1>
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
    <div className="mb-2 mt-6 flex items-end justify-between gap-2 border-b border-ink pb-1">
      <h2 className="font-cond text-base font-bold uppercase tracking-wider">{children}</h2>
      {right}
    </div>
  )
}

export function Banner({ tone = 'plain', icon = 'info', children }: { tone?: 'plain' | 'bad' | 'amber' | 'ok'; icon?: string; children: ReactNode }) {
  const c = { plain: 'border-ink', bad: 'border-bad text-bad', amber: 'border-ink bg-amber/25', ok: 'border-ok text-ok' }[tone]
  return (
    <div role={tone === 'bad' ? 'alert' : 'note'} className={`flex gap-2 border-2 px-3 py-2.5 text-base font-medium leading-snug ${c}`}>
      <Icon name={icon} size={20} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export const Rule = ({ children }: { children: ReactNode }) => <ul className="divide-y divide-hair border-y border-hair">{children}</ul>

export function Loading() {
  const { t } = useLang()
  return (
    <div role="status" className="animate-pulse space-y-3 py-6">
      {[100, 92, 84].map((w) => <div key={w} className="h-12 border border-hair bg-sunk" style={{ width: `${w}%` }} />)}
      <span className="sr-only">{t('loading')}</span>
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="my-4"><Banner tone="bad" icon="alert">{message}</Banner></div>
}

export function EmergencyLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 border-2 border-bad bg-bad px-3 py-2 text-sm font-semibold text-white" role="note">
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
export const inputCls = 'min-h-12 w-full border border-ink bg-white px-3 text-base'
