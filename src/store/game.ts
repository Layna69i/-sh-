import { create } from 'zustand'
import { DOORS, type ZoneId } from '../world/layout'

export type Phase = 'loading' | 'intro' | 'entering' | 'playing'

export type PanelId =
  | 'presentation'
  | 'announcements'
  | 'map'
  | 'archives'
  | 'shogi'
  | 'courses'
  | 'missions'
  | 'council'
  | 'notebook'
  | 'recruitment'
  | 'garden'
  | 'settings'
  | 'auth'
  | 'help'
  | 'profile'

export interface FocusPose {
  position: [number, number, number]
  target: [number, number, number]
  fov?: number
}

export interface PanelState {
  id: PanelId
  params?: Record<string, string | number | boolean | undefined>
}

export interface HoverInfo {
  id: string
  label: string
  verb: string
}

interface GameStore {
  phase: Phase
  loadProgress: number
  loadLabel: string
  worldReady: boolean
  zone: ZoneId
  doors: Record<string, boolean>
  panel: PanelState | null
  focus: FocusPose | null
  hover: HoverInfo | null
  pointerLocked: boolean
  teleport: { x: number; z: number; yaw: number } | null
  toast: { id: number; text: string; tone: 'info' | 'ok' | 'warn' } | null
  inkPulse: number
  introStage: number
  setIntroStage: (n: number) => void
  setPhase: (p: Phase) => void
  setLoad: (p: number, label: string) => void
  setWorldReady: () => void
  setZone: (z: ZoneId) => void
  setDoor: (id: string, open: boolean) => void
  toggleDoor: (id: string) => void
  openPanel: (id: PanelId, params?: PanelState['params'], focus?: FocusPose | null) => void
  closePanel: () => void
  setHover: (h: HoverInfo | null) => void
  setPointerLocked: (v: boolean) => void
  requestTeleport: (x: number, z: number, yaw: number) => void
  clearTeleport: () => void
  notify: (text: string, tone?: 'info' | 'ok' | 'warn') => void
}

let toastId = 0

export const useGame = create<GameStore>((set, get) => ({
  phase: 'loading',
  loadProgress: 0,
  loadLabel: 'Ouverture des portes',
  worldReady: false,
  zone: 'exterior',
  doors: Object.fromEntries(DOORS.map((d) => [d.id, false])),
  panel: null,
  focus: null,
  hover: null,
  pointerLocked: false,
  teleport: null,
  toast: null,
  inkPulse: 0,
  introStage: 0,
  setIntroStage: (introStage) => set({ introStage }),
  setPhase: (phase) => set({ phase }),
  setLoad: (loadProgress, loadLabel) => set({ loadProgress, loadLabel }),
  setWorldReady: () => set({ worldReady: true }),
  setZone: (zone) => set({ zone }),
  setDoor: (id, open) => set({ doors: { ...get().doors, [id]: open } }),
  toggleDoor: (id) => set({ doors: { ...get().doors, [id]: !get().doors[id] } }),
  openPanel: (id, params, focus = null) => set({ panel: { id, params }, focus, hover: null, inkPulse: get().inkPulse + 1 }),
  closePanel: () => set({ panel: null, focus: null }),
  setHover: (hover) => {
    const h = get().hover
    if (h?.id === hover?.id && h?.label === hover?.label) return
    set({ hover })
  },
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  requestTeleport: (x, z, yaw) => set({ teleport: { x, z, yaw } }),
  clearTeleport: () => set({ teleport: null }),
  notify: (text, tone = 'info') => set({ toast: { id: ++toastId, text, tone } }),
}))
