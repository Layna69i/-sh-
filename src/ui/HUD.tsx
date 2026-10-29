/**
 * Interface d'exploration : nom de la salle, réticule, invite d'interaction,
 * boutons (plan, son, réglages, compte), aide des contrôles, pause.
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useGame } from '../store/game'
import { useSettings, isTouchDevice } from '../store/settings'
import { useSession } from '../data/session'
import { zoneMeta } from '../world/layout'
import { IconMap, IconSound, IconGear, IconSeal, IconQuestion } from './icons'
import { audio } from '../audio/engine'
import { triggerInteraction } from '../interaction/InteractionSystem'

function HudButton({ label, onClick, children, k }: { label: string; onClick: () => void; children: React.ReactNode; k?: string }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => audio.ui('hover')}
      title={label}
      aria-label={label}
      className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-amber/25 bg-ink/70 text-paper-2 backdrop-blur-sm transition hover:border-amber/70 hover:text-paper"
    >
      {children}
      {k && <span className="absolute -right-1 -bottom-1 rounded bg-amber px-1 font-serif text-[10px] leading-4 font-semibold text-ink">{k}</span>}
      <span className="pointer-events-none absolute top-full mt-2 hidden rounded bg-ink/90 px-2 py-1 font-serif text-xs whitespace-nowrap text-paper group-hover:block">{label}</span>
    </button>
  )
}

export function openUiPanel(id: Parameters<ReturnType<typeof useGame.getState>['openPanel']>[0]) {
  if (document.pointerLockElement) document.exitPointerLock()
  useGame.getState().openPanel(id)
  audio.ui('open')
}

function ZoneTitle() {
  const zone = useGame((s) => s.zone)
  const meta = zoneMeta(zone)
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={zone}
        className="pointer-events-none flex items-center gap-3"
        initial={{ opacity: 0, x: -14, filter: 'blur(6px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.9 } }}
        exit={{ opacity: 0, x: 8, transition: { duration: 0.4 } }}
      >
        <span className="seal h-10 w-10 text-lg">{meta.ordinal}</span>
        <div className="leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          <div className="font-jp text-xs tracking-[0.4em] text-amber/90">{meta.kanji}</div>
          <div className="font-serif text-lg text-paper">{meta.name}</div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function Prompt() {
  const hover = useGame((s) => s.hover)
  const touch = isTouchDevice()
  return (
    <AnimatePresence>
      {hover && (
        <motion.div
          key={hover.id}
          className="pointer-events-none absolute bottom-[18%] left-1/2 flex -translate-x-1/2 flex-col items-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.25 } }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          <div className="mb-1 font-jp text-[11px] tracking-[0.35em] text-amber/80 drop-shadow-[0_1px_6px_rgba(0,0,0,1)]">{hover.verb}</div>
          <div className="flex items-center gap-2 rounded-sm border border-amber/30 bg-ink/75 px-4 py-2 font-serif text-lg text-paper shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-sm">
            {!touch && <span className="key-cap">E</span>}
            <span>{hover.label}</span>
          </div>
          {touch && (
            <button className="btn-ink primary pointer-events-auto mt-3 px-6" onClick={() => triggerInteraction()}>
              Interagir
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Crosshair() {
  const hover = useGame((s) => !!s.hover)
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      <div
        className="rounded-full transition-all duration-200"
        style={{
          width: hover ? 14 : 5,
          height: hover ? 14 : 5,
          background: hover ? 'transparent' : 'rgba(220,212,191,0.75)',
          border: hover ? '1.5px solid rgba(211,161,91,0.95)' : '0',
          boxShadow: '0 0 6px rgba(0,0,0,0.9)',
        }}
      />
    </div>
  )
}

function ControlsHint() {
  const hints = useSettings((s) => s.hints)
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setShow(false), 16000)
    return () => window.clearTimeout(t)
  }, [])
  if (!hints || isTouchDevice()) return null
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="pointer-events-none absolute bottom-5 left-5 rounded-sm border border-amber/15 bg-ink/60 px-4 py-3 font-serif text-sm text-paper-2 backdrop-blur-sm" exit={{ opacity: 0 }}>
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
            <span>
              <span className="key-cap">Z</span>
              <span className="key-cap ml-0.5">Q</span>
              <span className="key-cap ml-0.5">S</span>
              <span className="key-cap ml-0.5">D</span>
            </span>
            <span>Marcher (ou WASD / flèches)</span>
            <span className="key-cap w-fit">Maj</span>
            <span>Presser le pas</span>
            <span className="key-cap w-fit">E</span>
            <span>Interagir · ouvrir les portes</span>
            <span className="key-cap w-fit">M</span>
            <span>Plan de l'école</span>
            <span className="key-cap w-fit">Échap</span>
            <span>Libérer la souris / fermer</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PauseVeil() {
  const locked = useGame((s) => s.pointerLocked)
  const panel = useGame((s) => s.panel)
  const [grace, setGrace] = useState(true)
  useEffect(() => {
    setGrace(true)
    const t = window.setTimeout(() => setGrace(false), 900)
    return () => window.clearTimeout(t)
  }, [locked, panel])
  if (locked || panel || isTouchDevice() || grace) return null
  return (
    <button
      className="absolute inset-0 flex cursor-pointer items-center justify-center bg-ink/25"
      onClick={() => {
        const canvas = document.querySelector('canvas')
        const req = canvas?.requestPointerLock?.() as unknown as Promise<void> | undefined
        req?.catch?.(() => undefined)
      }}
    >
      <div className="rounded-sm border border-amber/30 bg-ink/80 px-6 py-4 text-center font-serif backdrop-blur-sm">
        <div className="font-jp text-xs tracking-[0.5em] text-amber/80">休</div>
        <div className="mt-1 text-lg text-paper">Cliquez pour reprendre l'exploration</div>
        <div className="mt-1 text-sm text-paper-3">Vous pouvez aussi maintenir le clic et glisser pour regarder.</div>
      </div>
    </button>
  )
}

export function HUD() {
  const phase = useGame((s) => s.phase)
  const panel = useGame((s) => s.panel)
  const muted = useSettings((s) => s.muted)
  const setS = useSettings((s) => s.set)
  const session = useSession((s) => s.session)
  if (phase !== 'playing') return null
  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      <AnimatePresence>
        {!panel && (
          <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute top-[4.6rem] left-4 sm:top-5 sm:left-5">
              <ZoneTitle />
            </div>
            <Crosshair />
            <Prompt />
            <ControlsHint />
            <PauseVeil />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="pointer-events-auto absolute top-4 right-4 flex items-center gap-1.5 sm:top-5 sm:right-5 sm:gap-2">
        <button
          onClick={() => openUiPanel('auth')}
          className="flex h-11 items-center gap-2 rounded-full border border-amber/25 bg-ink/70 pr-4 pl-1.5 font-serif text-sm text-paper-2 backdrop-blur-sm transition hover:border-amber/70 hover:text-paper"
        >
          <span className="seal h-8 w-8 rounded-full text-sm">{session.member ? session.rank?.kanji ?? '歩' : '客'}</span>
          <span className="hidden max-w-[150px] truncate sm:inline">{session.member ? session.member.name : 'Visiteur'}</span>
        </button>
        <HudButton label="Plan de l'école" k="M" onClick={() => openUiPanel('map')}>
          <IconMap />
        </HudButton>
        <HudButton
          label={muted ? 'Activer le son' : 'Couper le son'}
          onClick={() => {
            setS({ muted: !muted })
          }}
        >
          <IconSound muted={muted} />
        </HudButton>
        <HudButton label="Réglages" onClick={() => openUiPanel('settings')}>
          <IconGear />
        </HudButton>
        <HudButton label="Aide" onClick={() => openUiPanel('help')}>
          <IconQuestion />
        </HudButton>
      </div>
      {!panel && (
        <div className="absolute top-[4.6rem] right-5 hidden">
          <IconSeal />
        </div>
      )}
    </div>
  )
}
