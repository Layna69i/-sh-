/**
 * État d'entrée partagé (clavier, souris, tactile). Les touches sont lues via
 * `KeyboardEvent.code` (position physique) : ZQSD sur AZERTY et WASD sur QWERTY
 * fonctionnent donc sans configuration.
 */
export const input = {
  keys: new Set<string>(),
  lookDX: 0,
  lookDY: 0,
  moveX: 0, // tactile : -1..1
  moveY: 0,
  touchRun: false,
  interactQueued: false,
}

export function consumeLook() {
  const dx = input.lookDX
  const dy = input.lookDY
  input.lookDX = 0
  input.lookDY = 0
  return [dx, dy] as const
}

export function moveAxes() {
  const k = input.keys
  let x = 0
  let y = 0
  if (k.has('KeyW') || k.has('ArrowUp')) y += 1
  if (k.has('KeyS') || k.has('ArrowDown')) y -= 1
  if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1
  if (k.has('KeyD') || k.has('ArrowRight')) x += 1
  x += input.moveX
  y += input.moveY
  const l = Math.hypot(x, y)
  if (l > 1) {
    x /= l
    y /= l
  }
  return { x, y, run: k.has('ShiftLeft') || k.has('ShiftRight') || input.touchRun }
}

const typingTarget = (e: Event) => {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

export function installKeyboard(onKey: (code: string, e: KeyboardEvent) => void) {
  const down = (e: KeyboardEvent) => {
    if (typingTarget(e)) return
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault()
    if (!input.keys.has(e.code)) onKey(e.code, e)
    input.keys.add(e.code)
  }
  const up = (e: KeyboardEvent) => input.keys.delete(e.code)
  const blur = () => input.keys.clear()
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
  }
}
