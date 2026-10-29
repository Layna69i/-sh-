/**
 * Cadre des interfaces : un parchemin sombre qui se déroule, avec baguettes
 * de bois, ornements d'angle et calligraphie du titre.
 */
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { IconClose } from './icons'

export function PanelFrame({
  title,
  kanji,
  subtitle,
  onClose,
  children,
  width = 'lg',
  align = 'right',
  footer,
  mobileSheet = false,
}: {
  title: string
  kanji?: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  width?: 'md' | 'lg' | 'xl' | 'full'
  align?: 'right' | 'center' | 'left'
  footer?: ReactNode
  /** Sur mobile : feuille basse laissant voir la scène (ex. plateau de shogi). */
  mobileSheet?: boolean
}) {
  const w = { md: 'md:w-[min(560px,92vw)]', lg: 'md:w-[min(780px,62vw)]', xl: 'md:w-[min(1180px,94vw)]', full: 'md:w-[96vw]' }[width]
  const pos = align === 'center' ? 'md:left-1/2 md:-translate-x-1/2' : align === 'left' ? 'md:left-6' : 'md:right-6'
  return (
    <motion.section
      className={`pointer-events-auto fixed inset-x-0 ${mobileSheet ? 'top-[52vh]' : 'top-0'} bottom-0 z-30 flex md:top-6 md:bottom-6 md:inset-x-auto ${w} ${pos}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.25 } }}
      role="dialog"
      aria-label={title}
    >
      <motion.div
        className="scroll-panel flex h-full w-full flex-col md:rounded-[2px]"
        initial={{ clipPath: 'inset(0 0 100% 0)' }}
        animate={{ clipPath: 'inset(0 0 0% 0)', transition: { duration: 0.75, ease: [0.22, 0.8, 0.3, 1] } }}
        exit={{ clipPath: 'inset(0 0 100% 0)', transition: { duration: 0.35, ease: 'easeIn' } }}
      >
        <div className="scroll-rod top-[-7px] hidden md:block" />
        <span className="corner-orn tl" />
        <span className="corner-orn tr" />
        <span className="corner-orn bl" />
        <span className="corner-orn br" />
        <header className="relative flex items-start gap-4 px-6 pt-7 pb-4 md:px-9">
          {kanji && (
            <motion.div
              className="font-jp text-4xl leading-none text-amber/90 [writing-mode:vertical-rl] md:text-5xl"
              initial={{ opacity: 0, filter: 'blur(8px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)', transition: { delay: 0.35, duration: 0.9 } }}
            >
              {kanji}
            </motion.div>
          )}
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="font-serif text-2xl font-medium tracking-wide text-paper md:text-3xl">{title}</h2>
            {subtitle && <p className="mt-1 font-serif text-base italic text-paper-2">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-ink ghost -mt-1 -mr-2 h-10 w-10 !p-0" aria-label="Fermer (Échap)" title="Fermer (Échap)">
            <IconClose />
          </button>
        </header>
        <div className="hairline mx-6 md:mx-9" />
        <div className="ink-scroll selectable relative min-h-0 flex-1 overflow-y-auto px-6 py-5 font-serif text-[1.05rem] leading-relaxed text-paper/90 md:px-9">{children}</div>
        {footer && (
          <>
            <div className="hairline mx-6 md:mx-9" />
            <div className="px-6 py-4 md:px-9">{footer}</div>
          </>
        )}
        <div className="scroll-rod bottom-[-7px] hidden md:block" />
      </motion.div>
    </motion.section>
  )
}
