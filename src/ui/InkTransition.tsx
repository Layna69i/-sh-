/** Tache d'encre qui s'étale puis se dissipe à l'ouverture d'un menu. */
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useGame } from '../store/game'

export function InkTransition() {
  const pulse = useGame((s) => s.inkPulse)
  const [show, setShow] = useState<number | null>(null)
  useEffect(() => {
    if (!pulse) return
    setShow(pulse)
    const t = window.setTimeout(() => setShow(null), 650)
    return () => window.clearTimeout(t)
  }, [pulse])
  return (
    <AnimatePresence>
      {show && (
        <motion.svg
          key={show}
          className="pointer-events-none fixed inset-0 z-[29] h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 0.85 }}
          exit={{ opacity: 0, transition: { duration: 0.6 } }}
        >
          <defs>
            <filter id="ink-edge" x="-50%" y="-50%" width="200%" height="200%">
              <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed={show % 50} />
              <feDisplacementMap in="SourceGraphic" scale="9" />
              <feGaussianBlur stdDeviation="0.6" />
            </filter>
            <radialGradient id="ink-fill">
              <stop offset="0%" stopColor="#050506" stopOpacity="0.95" />
              <stop offset="70%" stopColor="#0b0c0f" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#0b0c0f" stopOpacity="0" />
            </radialGradient>
          </defs>
          <motion.circle
            cx="50"
            cy="50"
            fill="url(#ink-fill)"
            filter="url(#ink-edge)"
            initial={{ r: 2 }}
            animate={{ r: 80, transition: { duration: 0.6, ease: [0.2, 0.7, 0.3, 1] } }}
          />
        </motion.svg>
      )}
    </AnimatePresence>
  )
}
