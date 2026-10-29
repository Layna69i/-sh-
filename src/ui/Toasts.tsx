import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useGame } from '../store/game'

export function Toasts() {
  const toast = useGame((s) => s.toast)
  const [visible, setVisible] = useState(toast)
  useEffect(() => {
    if (!toast) return
    setVisible(toast)
    const t = window.setTimeout(() => setVisible(null), 4200)
    return () => window.clearTimeout(t)
  }, [toast])
  const tone = visible?.tone === 'ok' ? 'border-forest/80' : visible?.tone === 'warn' ? 'border-blood/70' : 'border-amber/40'
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[8%] z-[60] flex justify-center px-4">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={visible.id}
            role="status"
            className={`max-w-lg rounded-sm border ${tone} bg-ink/90 px-5 py-3 text-center font-serif text-base text-paper shadow-[0_10px_40px_rgba(0,0,0,0.7)] backdrop-blur`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
          >
            {visible.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
