import { create } from 'zustand'

export type Quality = 'low' | 'medium' | 'high'

export interface QualityPreset {
  label: string
  /**
   * Échelle de rendu par rapport à la définition native de l'écran [plancher, plafond]. Le moniteur
   * de performance ajuste entre les deux sans jamais passer sous le plancher : en Élevé et en Moyen
   * l'image n'est jamais calculée sous la définition de l'écran puis étirée (source de flou).
   */
  scale: [number, number]
  /** plafond absolu du rapport de pixels (écrans très denses) */
  maxDpr: number
  /** accentuation adaptative au contraste (CAS) après tone mapping ; 0 = aucune */
  sharpen: number
  shadows: boolean
  shadowMap: number
  bloom: boolean
  lights: number
  trees: number
  ferns: number
  mist: boolean
  antialias: boolean
  /** occlusion ambiante en espace écran (ombres de contact) */
  ao: boolean
  /** textures PBR : '2k' (albédo et normale), '1k', ou aucune (procédural léger) */
  textures: '2k' | '1k' | null
}

export const QUALITY: Record<Quality, QualityPreset> = {
  low: { label: 'Bas', scale: [0.85, 1], maxDpr: 1.5, sharpen: 0, shadows: false, shadowMap: 512, bloom: false, lights: 4, trees: 0.45, ferns: 0.35, mist: false, antialias: true, ao: false, textures: null },
  medium: { label: 'Moyen', scale: [1, 1.25], maxDpr: 1.75, sharpen: 0.35, shadows: true, shadowMap: 2048, bloom: true, lights: 6, trees: 0.75, ferns: 0.7, mist: true, antialias: true, ao: false, textures: '1k' },
  high: { label: 'Élevé', scale: [1, 2], maxDpr: 2.5, sharpen: 0.22, shadows: true, shadowMap: 4096, bloom: true, lights: 8, trees: 1, ferns: 1, mist: true, antialias: true, ao: true, textures: '2k' },
}

/** Rapport de pixels du rendu pour un profil, selon la marge de performance  (0 → 1). */
export function renderDpr(q: QualityPreset, factor: number) {
  const native = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const k = q.scale[0] + (q.scale[1] - q.scale[0]) * Math.min(1, Math.max(0, factor))
  return Math.min(q.maxDpr, native * k)
}

export interface Settings {
  quality: Quality
  sensitivity: number
  invertY: boolean
  fov: number
  headBob: boolean
  volume: number
  ambience: number
  music: number
  muted: boolean
  hints: boolean
}

const KEY = 'osho.settings.v1'

export const isTouchDevice = () =>
  typeof window !== 'undefined' && (('ontouchstart' in window && navigator.maxTouchPoints > 0) || window.matchMedia?.('(pointer: coarse)').matches)

function defaults(): Settings {
  const touch = isTouchDevice()
  return {
    quality: touch ? 'low' : 'medium',
    sensitivity: 1,
    invertY: false,
    fov: 68,
    headBob: true,
    volume: 0.8,
    ambience: 0.8,
    music: 0.6,
    muted: false,
    hints: true,
  }
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...defaults(), ...JSON.parse(raw) }
  } catch {
    /* stockage indisponible */
  }
  return defaults()
}

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...load(),
  set: (patch) => {
    set(patch)
    try {
      const { set: _s, ...rest } = { ...get(), ...patch }
      localStorage.setItem(KEY, JSON.stringify(rest))
    } catch {
      /* ignoré */
    }
  },
}))
