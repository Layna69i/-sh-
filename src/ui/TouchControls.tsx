/** Contrôles tactiles : joystick de déplacement, zone de regard, course, plan. */
import { useRef, useState } from 'react'
import { useGame } from '../store/game'
import { isTouchDevice } from '../store/settings'
import { input } from '../player/input'
import { IconRun, IconMap } from './icons'
import { openUiPanel } from './HUD'

export function TouchControls() {
  const phase = useGame((s) => s.phase)
  const panel = useGame((s) => s.panel)
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null)
  const [run, setRun] = useState(false)
  const base = useRef<{ x: number; y: number; id: number } | null>(null)
  const look = useRef<{ x: number; y: number; id: number } | null>(null)
  if (!isTouchDevice() || phase !== 'playing' || panel) return null
  const R = 56

  return (
    <div className="fixed inset-0 z-[21] touch-none select-none">
      {/* zone de regard (moitié droite) */}
      <div
        className="absolute inset-y-0 right-0 w-[60%]"
        onPointerDown={(e) => {
          look.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const l = look.current
          if (!l || l.id !== e.pointerId) return
          input.lookDX += (e.clientX - l.x) * 1.6
          input.lookDY += (e.clientY - l.y) * 1.6
          l.x = e.clientX
          l.y = e.clientY
        }}
        onPointerUp={() => (look.current = null)}
        onPointerCancel={() => (look.current = null)}
      />
      {/* joystick (moitié gauche) */}
      <div
        className="absolute inset-y-0 left-0 w-[40%]"
        onPointerDown={(e) => {
          base.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
          setKnob({ x: 0, y: 0 })
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const b = base.current
          if (!b || b.id !== e.pointerId) return
          let dx = e.clientX - b.x
          let dy = e.clientY - b.y
          const l = Math.hypot(dx, dy)
          if (l > R) {
            dx = (dx / l) * R
            dy = (dy / l) * R
          }
          input.moveX = dx / R
          input.moveY = -dy / R
          setKnob({ x: dx, y: dy })
        }}
        onPointerUp={() => {
          base.current = null
          input.moveX = input.moveY = 0
          setKnob(null)
        }}
        onPointerCancel={() => {
          base.current = null
          input.moveX = input.moveY = 0
          setKnob(null)
        }}
      >
        {knob && base.current && (
          <div className="pointer-events-none absolute" style={{ left: base.current.x - R, top: base.current.y - R }}>
            <div className="h-28 w-28 rounded-full border border-amber/40 bg-ink/30 backdrop-blur-sm" />
            <div
              className="absolute top-1/2 left-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber/70 bg-amber/30"
              style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
            />
          </div>
        )}
        {!knob && <div className="pointer-events-none absolute bottom-10 left-8 font-serif text-xs text-paper-3">Glisser pour marcher</div>}
      </div>
      <div className="absolute right-5 bottom-8 flex flex-col gap-3">
        <button
          className={`flex h-14 w-14 items-center justify-center rounded-full border ${run ? 'border-amber bg-amber/30' : 'border-amber/30 bg-ink/60'} text-paper`}
          onClick={() => {
            input.touchRun = !run
            setRun(!run)
          }}
          aria-label="Presser le pas"
        >
          <IconRun />
        </button>
        <button className="flex h-14 w-14 items-center justify-center rounded-full border border-amber/30 bg-ink/60 text-paper" onClick={() => openUiPanel('map')} aria-label="Plan">
          <IconMap />
        </button>
      </div>
    </div>
  )
}
