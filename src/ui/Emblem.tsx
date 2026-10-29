import { useId, type SVGProps } from 'react'
import { EMBLEM_PATH } from '../core/emblem'

/** Symbole du clan Nara (même tracé que dans le monde 3D). `animated` le révèle d'un balayage circulaire. */
export function Emblem({ color = 'currentColor', animated = false, ...p }: SVGProps<SVGSVGElement> & { color?: string; animated?: boolean }) {
  const mask = `emb-reveal-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 100 100" {...p}>
      {animated && (
        <defs>
          <mask id={mask}>
            {/* disque de rayon 25 tracé d'un trait de 50 : son tiret couvre tout l'emblème en tournant */}
            <circle className="emb-sweep" cx="50" cy="50" r="25" fill="none" stroke="#fff" strokeWidth="51" transform="rotate(-90 50 50)" />
          </mask>
          <style>{`
            .emb-sweep { stroke-dasharray: 158; stroke-dashoffset: 158; animation: embSweep 2.4s 0.2s cubic-bezier(.6,.05,.3,1) forwards; }
            @keyframes embSweep { to { stroke-dashoffset: 0; } }
            @media (prefers-reduced-motion: reduce) { .emb-sweep { animation: none; stroke-dashoffset: 0; } }
          `}</style>
        </defs>
      )}
      <path d={EMBLEM_PATH} fill={color} fillRule="evenodd" mask={animated ? `url(#${mask})` : undefined} />
    </svg>
  )
}
