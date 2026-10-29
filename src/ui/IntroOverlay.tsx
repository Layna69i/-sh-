import { AnimatePresence, motion } from 'motion/react'
import { useGame } from '../store/game'
import { useSettings } from '../store/settings'
import { intro } from '../world/IntroCamera'
import { audio } from '../audio/engine'
import { isTouchDevice } from '../store/settings'

export function enterSchool() {
  const g = useGame.getState()
  if (g.phase !== 'intro') return
  const s = useSettings.getState()
  void audio.start().then(() => {
    audio.setVolumes({ master: s.volume, ambience: s.ambience, music: s.music, muted: s.muted })
    audio.setZone('exterior', true)
    audio.door('gate', true)
  })
  g.setDoor('gate', true)
  g.setPhase('entering')
  if (!isTouchDevice()) {
    const canvas = document.querySelector('canvas')
    const req = canvas?.requestPointerLock?.() as unknown as Promise<void> | undefined
    req?.catch?.(() => undefined)
  }
}

const ease = [0.22, 0.61, 0.36, 1] as const

/** Contrôles : touches en relief, texte lisible mais secondaire. */
function Controls() {
  if (isTouchDevice())
    return <p className="intro-controls">Joystick à gauche pour marcher · glisser à droite pour regarder</p>
  return (
    <p className="intro-controls">
      <span>
        <kbd>Z Q S D</kbd> marcher
      </span>
      <span>
        <kbd>Souris</kbd> regarder
      </span>
      <span>
        <kbd>E</kbd> interagir
      </span>
      <span>
        <kbd>M</kbd> plan
      </span>
    </p>
  )
}

/**
 * Accueil cinématique. Hiérarchie : 1. le titre (voile sombre derrière lui, tracé ivoire et or,
 * ombre douce), 2. le kanji et le nom du lieu, 3. l'action Entrer (plaque laquée cerclée d'or),
 * 4. les contrôles (discrets mais lisibles). Apparitions échelonnées, sans effet tape-à-l'œil.
 */
export function IntroOverlay() {
  const phase = useGame((s) => s.phase)
  const stage = useGame((s) => s.introStage)
  const ready = useGame((s) => s.worldReady)
  const active = ready && (phase === 'intro' || phase === 'entering')
  return (
    <AnimatePresence>
      {active && (
        <motion.div key="intro" className="pointer-events-none fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 1 } }}>
          {/* bandes cinématiques */}
          <motion.div className="absolute inset-x-0 top-0 bg-black" animate={{ height: phase === 'entering' ? 0 : '9vh' }} transition={{ duration: 1.2, ease: 'easeInOut' }} />
          <motion.div className="absolute inset-x-0 bottom-0 bg-black" animate={{ height: phase === 'entering' ? 0 : '9vh' }} transition={{ duration: 1.2, ease: 'easeInOut' }} />
          {/* assombrissement bas : le bouton et les contrôles se détachent du décor */}
          <motion.div
            className="absolute inset-x-0 bottom-0 h-[46vh] bg-gradient-to-t from-black/80 via-black/35 to-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 'intro' && stage >= 3 ? 1 : 0 }}
            transition={{ duration: 1.4 }}
          />

          <AnimatePresence mode="wait">
            {phase === 'intro' && stage === 1 && (
              <motion.figure
                key="quote"
                className="absolute inset-x-0 top-[30%] flex flex-col items-center px-6 text-center"
                initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 2.2, ease: 'easeOut' } }}
                exit={{ opacity: 0, filter: 'blur(6px)', transition: { duration: 1.2 } }}
              >
                <div aria-hidden className="intro-veil" />
                <div className="mb-5 font-jp text-sm tracking-[0.8em] text-amber">一 手</div>
                <blockquote className="intro-quote max-w-3xl font-serif text-3xl leading-snug italic md:text-5xl">
                  « Si le roi ne bouge pas,
                  <br />
                  ses sujets ne le suivront pas. »
                </blockquote>
                <figcaption className="mt-5 font-serif text-base tracking-[0.3em] text-paper uppercase">Shikae Nara</figcaption>
              </motion.figure>
            )}
            {phase === 'intro' && stage >= 2 && (
              <motion.div
                key="title"
                className="absolute inset-x-0 top-[12vh] flex flex-col items-center px-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.8 } }}
                exit={{ opacity: 0, transition: { duration: 0.8 } }}
              >
                <div aria-hidden className="intro-veil" />
                <motion.div
                  className="font-jp text-xl tracking-[0.55em] text-amber md:text-2xl"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 1.6, ease } }}
                >
                  王 将
                </motion.div>
                <motion.h1
                  className="intro-title mt-3 font-serif font-medium uppercase"
                  initial={{ opacity: 0, y: 10, filter: 'blur(10px)', letterSpacing: '0.24em' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)', letterSpacing: '0.13em', transition: { duration: 2.4, delay: 0.25, ease } }}
                >
                  L'École des Ombres
                </motion.h1>
                <motion.div className="intro-rule mt-5" initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1, transition: { duration: 1.6, delay: 1.1, ease } }} />
                <motion.div
                  className="mt-4 font-serif text-sm tracking-[0.6em] text-paper-2 uppercase md:text-base"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 1.4, delay: 1.5 } }}
                >
                  Ōshō
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {phase === 'intro' && stage >= 3 && (
            <motion.div
              className="pointer-events-auto absolute inset-x-0 bottom-[calc(9vh+2.2rem)] flex flex-col items-center gap-5"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 1.2, delay: 0.35, ease } }}
            >
              <button className="btn-enter" onClick={enterSchool} autoFocus aria-label="Entrer dans l'école">
                <span aria-hidden className="font-jp text-base text-amber">入</span>
                <span>Entrer</span>
              </button>
              <Controls />
            </motion.div>
          )}

          {phase === 'intro' && stage < 3 && (
            <button className="btn-ink ghost pointer-events-auto absolute right-6 bottom-[calc(9vh+1rem)] text-sm text-paper" onClick={() => (intro.skip = true)}>
              Passer la cinématique ›
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
