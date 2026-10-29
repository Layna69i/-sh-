import { AnimatePresence, motion } from 'motion/react'
import { useGame } from '../store/game'
import { Emblem } from './Emblem'

export function LoadingScreen({ error }: { error?: string | null }) {
  const ready = useGame((s) => s.worldReady)
  const progress = useGame((s) => s.loadProgress)
  const label = useGame((s) => s.loadLabel)
  return (
    <AnimatePresence>
      {!ready && (
        <motion.div
          key="loading"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-ink"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1.4, ease: 'easeInOut' } }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25"
            style={{ backgroundImage: 'url(/images/concept-exterieur.webp)', filter: 'blur(6px) saturate(0.7)', transform: 'scale(1.08)' }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,19,23,0.35),rgba(7,8,10,0.96)_70%)]" />
          <div className="relative flex flex-col items-center px-6 text-center">
            <Emblem animated color="#d3a15b" className="h-24 w-24 drop-shadow-[0_0_24px_rgba(211,161,91,0.35)]" />
            <div className="mt-8 font-jp text-5xl tracking-[0.35em] text-paper/90">王将</div>
            <div className="mt-3 font-serif text-xl tracking-[0.5em] text-amber/90 uppercase">Ōshō</div>
            <div className="mt-1 font-serif text-sm italic tracking-[0.2em] text-paper-2/70">L'École des Ombres</div>
            <div className="mt-12 w-[min(360px,80vw)]">
              <div className="relative h-[3px] overflow-hidden rounded-full bg-paper/10">
                <motion.div className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-2 via-amber to-paper" animate={{ width: `${Math.round(progress * 100)}%` }} transition={{ ease: 'easeOut', duration: 0.4 }} />
              </div>
              <div className="mt-3 flex justify-between font-serif text-sm text-paper-2/70">
                <span className="italic">{error ? 'Le domaine reste scellé' : label}…</span>
                <span>{Math.round(progress * 100)} %</span>
              </div>
              {error && (
                <p className="mt-4 rounded border border-blood/50 bg-blood/10 p-3 text-left text-sm text-paper">
                  {error}
                </p>
              )}
            </div>
          </div>
          <p className="absolute bottom-6 px-6 text-center font-serif text-xs tracking-wide text-paper-3">
            Univers Naruto RP · domaine de Shikae Nara · expérience 3D — casque ou haut-parleurs recommandés
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
