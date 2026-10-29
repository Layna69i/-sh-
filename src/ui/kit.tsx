/** Petits composants d'interface communs aux panneaux (style encre et papier). */
import { useState, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { motion } from 'motion/react'
import { CLEARANCES } from '../data/types'
import { audio } from '../audio/engine'
import { rng } from '../core/math'

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; kanji?: string; hidden?: boolean }[] }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-amber/15" role="tablist">
      {items
        .filter((i) => !i.hidden)
        .map((it) => (
          <button
            key={it.id}
            role="tab"
            aria-selected={value === it.id}
            onClick={() => {
              onChange(it.id)
              audio.ui('tab')
            }}
            className={`relative -mb-px flex items-center gap-2 px-3 py-2 font-serif text-base transition ${value === it.id ? 'text-paper' : 'text-paper-3 hover:text-paper-2'}`}
          >
            {it.kanji && <span className="font-jp text-sm text-amber/80">{it.kanji}</span>}
            {it.label}
            {value === it.id && <motion.span layoutId={`tab-${items.map((i) => i.id).join()}`} className="absolute inset-x-1 bottom-0 h-[2px] bg-amber" />}
          </button>
        ))}
    </div>
  )
}

export function DemoBadge({ show = true }: { show?: boolean }) {
  if (!show) return null
  return (
    <span className="inline-flex items-center rounded-sm border border-amber/40 bg-amber/10 px-1.5 py-0.5 font-serif text-[11px] tracking-wider text-amber uppercase" title="Contenu fictif de démonstration, à remplacer par de véritables informations RP">
      Démo · fictif
    </span>
  )
}

export function ClearanceBadge({ level }: { level: number }) {
  const c = CLEARANCES[Math.max(0, Math.min(4, level))]
  const tone = ['border-paper-3/40 text-paper-2', 'border-forest/70 text-[#9fb8a8]', 'border-amber/50 text-amber', 'border-blood/70 text-[#e39a8c]', 'border-blood bg-blood/20 text-[#f3c2b6]'][c.level]
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-serif text-[11px] tracking-wide uppercase ${tone}`}>
      <span className="font-jp">{c.jp}</span>
      {c.label}
    </span>
  )
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'amber' }) {
  const t = { neutral: 'border-paper-3/40 text-paper-2', ok: 'border-forest/80 text-[#a9c4b3]', warn: 'border-amber/60 text-amber', bad: 'border-blood/80 text-[#e9a597]', amber: 'border-amber/60 bg-amber/10 text-amber' }[tone]
  return <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-serif text-xs tracking-wide ${t}`}>{children}</span>
}

export function Field({ label, hint, children, error }: { label: string; hint?: string; children: ReactNode; error?: string | null }) {
  return (
    <label className="block">
      <span className="mb-1 block font-serif text-sm tracking-wide text-paper-2">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-paper-3">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-[#e9a597]">{error}</span>}
    </label>
  )
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`field ${p.className ?? ''}`} />
export const TextArea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={4} {...p} className={`field resize-y ${p.className ?? ''}`} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`field ${p.className ?? ''}`} />

export function Loading({ label = 'Lecture des archives…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-8 text-paper-2 italic" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber/30 border-t-amber" />
      {label}
    </div>
  )
}

export function Empty({ kanji = '無', children }: { kanji?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-paper-3">
      <span className="font-jp text-4xl text-paper-3/60">{kanji}</span>
      <div className="max-w-sm italic">{children}</div>
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div role="alert" className="my-3 flex items-start gap-3 rounded-sm border border-blood/60 bg-blood/10 px-4 py-3 text-sm text-paper">
      <span className="font-jp text-lg text-[#e9a597]">否</span>
      <div>{children}</div>
    </div>
  )
}

export function SuccessNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div role="status" className="my-3 flex items-start gap-3 rounded-sm border border-forest/70 bg-forest/15 px-4 py-3 text-sm text-paper">
      <span className="font-jp text-lg text-[#a9c4b3]">可</span>
      <div>{children}</div>
    </div>
  )
}

export function Denied({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="seal h-14 w-14 text-2xl">禁</span>
      <div className="font-serif text-lg text-paper">Accès refusé</div>
      <div className="max-w-sm text-sm text-paper-2 italic">{children ?? 'Votre grade ne vous donne pas accès à cet espace.'}</div>
    </div>
  )
}

export function SectionTitle({ children, kanji, right }: { children: ReactNode; kanji?: string; right?: ReactNode }) {
  return (
    <div className="mt-6 mb-3 flex items-center gap-3 first:mt-0">
      {kanji && <span className="font-jp text-lg text-amber/80">{kanji}</span>}
      <h3 className="font-serif text-xl text-paper">{children}</h3>
      <div className="hairline flex-1" />
      {right}
    </div>
  )
}

export function ConfirmButton({ onConfirm, children, className = '' }: { onConfirm: () => void; children: ReactNode; className?: string }) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      className={`btn-ink danger ${className}`}
      onClick={() => {
        if (armed) {
          onConfirm()
          setArmed(false)
        } else {
          setArmed(true)
          window.setTimeout(() => setArmed(false), 3000)
        }
      }}
    >
      {armed ? 'Confirmer ?' : children}
    </button>
  )
}

export const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

/** Portrait à l'encre généré à partir d'une graine (en l'absence d'image fournie). */
export function InkAvatar({ seed, size = 64, kanji, url }: { seed: number; size?: number; kanji?: string; url?: string }) {
  if (url) return <img src={url} alt="" width={size} height={size} className="rounded-sm border border-amber/30 object-cover" style={{ width: size, height: size }} />
  const r = rng(seed * 97 + 13)
  const hair = Math.floor(r() * 4)
  const tint = ['#2a3a34', '#3a2a28', '#2a2f3d', '#3b3326'][Math.floor(r() * 4)]
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="rounded-sm border border-amber/30" aria-hidden>
      <rect width="64" height="64" fill="#d6cbb0" />
      <circle cx={20 + r() * 24} cy={18 + r() * 10} r={14 + r() * 8} fill={tint} opacity="0.25" />
      <path d="M8 64c2-14 12-20 24-20s22 6 24 20z" fill="#141414" />
      <ellipse cx="32" cy="30" rx="10.5" ry="12.5" fill="#141414" />
      {hair === 0 && <path d="M20 26c0-12 24-14 24 2 2-4 1-12-12-14-10 0-14 6-12 12z" fill="#141414" />}
      {hair === 1 && <path d="M21 28c-2-10 4-16 11-16s14 6 11 16l2-10c-2-8-24-10-24 10z M42 22l8 14-6-4z" fill="#141414" />}
      {hair === 2 && <path d="M20 24c4-12 20-12 24 0 2 6 0 14-2 18l-2-14c-4-6-14-6-18 0l-2 14c-2-4-2-12 0-18z" fill="#141414" />}
      {hair === 3 && <path d="M22 22c6-9 16-9 22 0l-2 4c-6-4-12-4-18 0z M44 18l10-6-6 10z" fill="#141414" />}
      <rect x="21" y="24" width="22" height="4" fill="#8a7f6a" />
      {kanji && (
        <>
          <rect x="46" y="46" width="14" height="14" fill="#9a3326" />
          <text x="53" y="57" textAnchor="middle" fontSize="10" fill="#f4e4d0" fontFamily="Shippori Mincho, serif" fontWeight="800">
            {kanji}
          </text>
        </>
      )}
    </svg>
  )
}
