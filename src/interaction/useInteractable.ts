import { useEffect } from 'react'
import { registerInteractable, type Interactable } from './registry'
import { useGame, type FocusPose, type PanelId, type PanelState } from '../store/game'
import { audio } from '../audio/engine'

export function useInteractable(make: () => Interactable | null, deps: unknown[] = []) {
  useEffect(() => {
    const it = make()
    if (!it) return
    return registerInteractable(it)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Ouvre un panneau après un rapprochement de caméra vers l'objet. */
export function openPanel(panel: PanelId, focus?: FocusPose | null, params?: PanelState['params']) {
  if (document.pointerLockElement) document.exitPointerLock()
  useGame.getState().openPanel(panel, params, focus ?? null)
  audio.ui('open')
}
