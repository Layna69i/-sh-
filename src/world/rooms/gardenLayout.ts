/**
 * Plan du Jardin du Silence, partagé par le sable ratissé (qui contourne chaque objet),
 * les pierres, les arbres, les collisions et les interactions.
 */
import { rng } from '../../core/math'

export const POND = { x: 3.6, z: -36.8, rx: 3.0, rz: 2.1 }
/** Niveau de l'eau du bassin. */
export const POND_Y = 0.07
/** Contour du bassin (ondulation douce) au paramètre a ∈ [0, 2π[. */
export const pondEdge = (a: number, k = 1) => {
  const w = (1 + 0.12 * Math.sin(a * 3)) * k
  return [POND.x + Math.cos(a) * POND.rx * w, POND.z + Math.sin(a) * POND.rz * w] as const
}

/** Grandes pierres : x, z, taille, graine, forme (tate = dressée, hira = plate, fuse = couchée). */
export interface GardenRock {
  x: number
  z: number
  s: number
  seed: number
  kind: 'tate' | 'hira' | 'fuse'
  ry: number
}
export const ROCKS: GardenRock[] = [
  // pierre dressée et sa pierre couchée, en retrait du chemin de pas japonais (≥ 0,7 m)
  { x: -5.0, z: -33.0, s: 1.15, seed: 7, kind: 'tate', ry: 0.4 },
  { x: -6.2, z: -33.9, s: 0.6, seed: 8, kind: 'fuse', ry: 2.1 },
  { x: -6.2, z: -40.2, s: 0.95, seed: 9, kind: 'fuse', ry: 4.0 },
  { x: -2.6, z: -41.6, s: 0.7, seed: 10, kind: 'hira', ry: 1.2 },
  { x: -5.2, z: -41.2, s: 0.45, seed: 11, kind: 'tate', ry: 5.3 },
]

/** Pas japonais (tobi-ishi) le long des allées. */
export interface PathStone {
  x: number
  z: number
  r: number
  ry: number
  seed: number
}
export const PATH: PathStone[] = (() => {
  const r = rng(909)
  const out: PathStone[] = []
  const add = (pts: [number, number][]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[i + 1]
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.72)
      for (let k = 0; k < n; k++)
        out.push({
          x: ax + ((bx - ax) * k) / n + (r() - 0.5) * 0.16,
          z: az + ((bz - az) * k) / n + (r() - 0.5) * 0.16,
          r: 0.3 + r() * 0.08,
          ry: r() * 6.28,
          seed: 300 + out.length,
        })
    }
  }
  add([[-6.6, -28.0], [-4.8, -30.5], [-1.6, -34.0], [-0.6, -38.5], [0, -44.0]])
  add([[6.6, -28.0], [5.6, -31.0], [0.8, -33.2], [-1.6, -34.0]])
  add([[-1.6, -34.0], [-5.0, -36.1], [-8.4, -36.0]])
  add([[-0.6, -38.5], [2.0, -40.6], [6.0, -40.4], [8.4, -36.0]])
  return out
})()

/** Érables : x, z, échelle, graine. Le premier est l'arbre « héros » de la cour. */
export const MAPLES: { x: number; z: number; s: number; seed: number }[] = [
  { x: 6.9, z: -30.4, s: 1, seed: 21 },
  { x: -7.6, z: -43.4, s: 0.9, seed: 22 },
  { x: 7.4, z: -44.0, s: 0.72, seed: 23 },
]

export const LANTERNS: { p: [number, number, number]; s: number }[] = [
  { p: [-1.2, 0, -31.4], s: 0.85 },
  { p: [7.2, 0, -40.6], s: 0.9 },
  { p: [-7.4, 0, -29.6], s: 0.8 },
]

export const STELE = { x: -1.9, z: -30.6, ry: 0.3 }
export const TSUKUBAI = { x: 6.6, z: -38.2 }
/** bec tourné vers le bassin, talon et pierre de frappe à l'écart du tsukubai */
export const SHISHI = { x: 6.25, z: -37.6, ry: -3.04 }
export const BENCH = { x: -3.2, z: -44.0 }

/** Étendue du sable (entre les engawa) et carré couvert par la carte de ratissage. */
export const SAND = { x0: -8.55, x1: 8.55, z0: -46, z1: -27.5 }
export const RAKE_AREA = { x0: -9.3, z0: -46, size: 18.6 }
