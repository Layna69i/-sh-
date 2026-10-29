/**
 * Géographie du domaine d'Ōshō.
 * Repère : x vers l'est, z vers le sud (l'entrée regarde le sud), y vers le haut.
 * Le plancher du bâtiment est à y = 0 ; la forêt est en contrebas (FOREST_Y).
 */
import { smoothstep, lerp } from '../core/math'
import { worldNoise } from '../core/noise'

export type RoomId =
  | 'hall'
  | 'library'
  | 'shogi'
  | 'dojo'
  | 'missions'
  | 'council'
  | 'office'
  | 'recruitment'
  | 'garden'
export type ZoneId = RoomId | 'exterior'

export interface RoomDef {
  id: RoomId
  name: string
  short: string
  kanji: string
  ordinal: string
  x0: number
  x1: number
  z0: number
  z1: number
  height: number
  open?: boolean
  floor: 'planks' | 'tatami' | 'gravel' | 'polished'
  ambience: 'hall' | 'library' | 'shogi' | 'dojo' | 'office' | 'garden' | 'room'
  fog: [number, number] // [couleur hex, densité]
}

export const FOREST_Y = -2.4
export const EYE_HEIGHT = 1.62
export const WALL_T = 0.3
export const FENCE_H = 1.55

export const ROOMS: RoomDef[] = [
  { id: 'hall', name: 'Le Hall des Ombres', short: 'Hall', kanji: '影の間', ordinal: '壱', x0: -10, x1: 10, z0: -26, z1: 0, height: 9, floor: 'polished', ambience: 'hall', fog: [0x0c0d10, 0.018] },
  { id: 'library', name: 'La Bibliothèque des Secrets', short: 'Bibliothèque', kanji: '秘書庫', ordinal: '弐', x0: -28, x1: -10, z0: -26, z1: -9, height: 8, floor: 'planks', ambience: 'library', fog: [0x0d0c0b, 0.02] },
  { id: 'shogi', name: 'La Chambre du Shogi', short: 'Shogi', kanji: '将棋の間', ordinal: '参', x0: 10, x1: 24, z0: -26, z1: -10, height: 4.6, floor: 'tatami', ambience: 'shogi', fog: [0x070708, 0.03] },
  { id: 'dojo', name: "Le Dojo de l'Éloquence", short: 'Dojo', kanji: '弁論道場', ordinal: '肆', x0: -28, x1: -10, z0: -46, z1: -26, height: 5.5, floor: 'planks', ambience: 'dojo', fog: [0x0e0d0c, 0.016] },
  { id: 'missions', name: 'Le Bureau des Missions', short: 'Missions', kanji: '任務所', ordinal: '伍', x0: 10, x1: 20, z0: -10, z1: 0, height: 4.4, floor: 'planks', ambience: 'room', fog: [0x0d0c0b, 0.02] },
  { id: 'council', name: 'La Salle du Conseil', short: 'Conseil', kanji: '評定の間', ordinal: '陸', x0: 10, x1: 24, z0: -46, z1: -26, height: 5.2, floor: 'tatami', ambience: 'room', fog: [0x0b0b0c, 0.02] },
  { id: 'office', name: 'Le Bureau de Shikae Nara', short: 'Bureau de Shikae', kanji: '書斎', ordinal: '漆', x0: -6, x1: 6, z0: -56, z1: -46, height: 3.8, floor: 'tatami', ambience: 'office', fog: [0x2b2331, 0.014] },
  { id: 'recruitment', name: 'Le Bureau de Recrutement', short: 'Recrutement', kanji: '入門所', ordinal: '捌', x0: -19, x1: -10, z0: -9, z1: 0, height: 4.2, floor: 'tatami', ambience: 'room', fog: [0x0d0c0b, 0.02] },
  { id: 'garden', name: 'Le Jardin du Silence', short: 'Jardin', kanji: '静寂の庭', ordinal: '玖', x0: -10, x1: 10, z0: -46, z1: -26, height: 0, open: true, floor: 'gravel', ambience: 'garden', fog: [0x1d1820, 0.012] },
]

export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r])) as Record<RoomId, RoomDef>

export const EXTERIOR_META = { name: 'La Forêt des Nara', kanji: '奈良の森', ordinal: '森', fog: [0x3a2c40, 0.0082] as [number, number] }

export interface DoorDef {
  id: string
  axis: 'x' | 'z' // 'x' : mur orienté selon x (z constant)
  at: number
  center: number
  width: number
  height: number
  rooms: [ZoneId, ZoneId] // [côté négatif, côté positif]
  kind: 'gate' | 'fusuma' | 'shoji' | 'window'
  label: string
  /** Allège (fenêtres) : hauteur du bas de l'ouverture. */
  sill?: number
}

export const DOORS: DoorDef[] = [
  { id: 'gate', axis: 'x', at: 0, center: 0, width: 4.2, height: 3.7, rooms: ['hall', 'exterior'], kind: 'gate', label: 'la grande porte' },
  { id: 'recruitment', axis: 'z', at: -10, center: -4.5, width: 1.8, height: 2.2, rooms: ['recruitment', 'hall'], kind: 'fusuma', label: 'le Bureau de Recrutement' },
  { id: 'library', axis: 'z', at: -10, center: -17.5, width: 2.6, height: 2.7, rooms: ['library', 'hall'], kind: 'fusuma', label: 'la Bibliothèque des Secrets' },
  { id: 'missions', axis: 'z', at: 10, center: -5, width: 1.8, height: 2.2, rooms: ['hall', 'missions'], kind: 'fusuma', label: 'le Bureau des Missions' },
  { id: 'shogi', axis: 'z', at: 10, center: -18, width: 2.0, height: 2.3, rooms: ['hall', 'shogi'], kind: 'fusuma', label: 'la Chambre du Shogi' },
  { id: 'garden-w', axis: 'x', at: -26, center: -6.6, width: 2.0, height: 2.4, rooms: ['garden', 'hall'], kind: 'shoji', label: 'le Jardin du Silence' },
  { id: 'garden-e', axis: 'x', at: -26, center: 6.6, width: 2.0, height: 2.4, rooms: ['garden', 'hall'], kind: 'shoji', label: 'le Jardin du Silence' },
  { id: 'dojo', axis: 'z', at: -10, center: -36, width: 2.4, height: 2.4, rooms: ['dojo', 'garden'], kind: 'shoji', label: "le Dojo de l'Éloquence" },
  { id: 'council', axis: 'z', at: 10, center: -36, width: 2.2, height: 2.4, rooms: ['garden', 'council'], kind: 'shoji', label: 'la Salle du Conseil' },
  { id: 'office', axis: 'x', at: -46, center: 0, width: 1.8, height: 2.2, rooms: ['office', 'garden'], kind: 'shoji', label: 'le Bureau de Shikae Nara' },
  { id: 'lib-dojo', axis: 'x', at: -26, center: -19, width: 1.8, height: 2.3, rooms: ['dojo', 'library'], kind: 'fusuma', label: 'le passage du Dojo' },
  { id: 'shogi-council', axis: 'x', at: -26, center: 17, width: 1.8, height: 2.3, rooms: ['council', 'shogi'], kind: 'fusuma', label: 'le passage du Conseil' },
  { id: 'office-window', axis: 'x', at: -56, center: 0, width: 3.4, height: 2.45, sill: 0.72, rooms: ['office', 'exterior'], kind: 'window', label: 'la fenêtre sur la forêt' },
]

/** Terrasse (engawa) devant la façade et escalier menant à la forêt. */
export const TERRACE = { x0: -19, x1: 20, z0: 0, z1: 5 }
export const STAIRS = { x0: -3, x1: 3, z0: 5, z1: 11 }

/** Bassin de la cascade, au pied du soubassement, à l'est de l'escalier. */
export const CASCADE = { x: 14.2, z: 8.7, rx: 3.3, rz: 2.2 }

/** Vrai dans le bassin ou dans l'éboulis rocheux qui le relie au mur. */
export function inCascade(x: number, z: number, margin = 0) {
  const dx = (x - CASCADE.x) / (CASCADE.rx + margin)
  const dz = (z - CASCADE.z) / (CASCADE.rz + margin)
  if (dx * dx + dz * dz < 1) return true
  return z > TERRACE.z1 && z < CASCADE.z && Math.abs(x - CASCADE.x) < 2.6 + margin
}

/* ------------------------------------------------------------------ */
/* Génération des murs à partir des pièces                              */
/* ------------------------------------------------------------------ */

export interface WallPiece {
  id: string
  axis: 'x' | 'z'
  at: number
  a: number
  b: number
  y0: number
  y1: number
  neg: ZoneId
  pos: ZoneId
  kind: 'wall' | 'lintel' | 'fence'
  doorId?: string
}

interface Edge {
  axis: 'x' | 'z'
  at: number
  a: number
  b: number
  room: RoomId
  side: 'neg' | 'pos' // côté de la ligne où se trouve la pièce
}

function roomEdges(r: RoomDef): Edge[] {
  return [
    { axis: 'x', at: r.z0, a: r.x0, b: r.x1, room: r.id, side: 'pos' }, // mur nord, la pièce est au sud (z+)
    { axis: 'x', at: r.z1, a: r.x0, b: r.x1, room: r.id, side: 'neg' },
    { axis: 'z', at: r.x0, a: r.z0, b: r.z1, room: r.id, side: 'pos' },
    { axis: 'z', at: r.x1, a: r.z0, b: r.z1, room: r.id, side: 'neg' },
  ]
}

const roomHeight = (z: ZoneId) => (z === 'exterior' ? 0 : ROOM_BY_ID[z].height)

function buildWalls(): WallPiece[] {
  const edges = ROOMS.flatMap(roomEdges)
  const lines = new Map<string, Edge[]>()
  for (const e of edges) {
    const k = `${e.axis}:${e.at}`
    if (!lines.has(k)) lines.set(k, [])
    lines.get(k)!.push(e)
  }
  const pieces: WallPiece[] = []
  let n = 0
  for (const [, es] of lines) {
    const axis = es[0].axis
    const at = es[0].at
    const pts = [...new Set(es.flatMap((e) => [e.a, e.b]))].sort((p, q) => p - q)
    type Seg = { a: number; b: number; neg: ZoneId; pos: ZoneId }
    const segs: Seg[] = []
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const m = (a + b) / 2
      const neg = es.find((e) => e.side === 'neg' && e.a <= m && e.b >= m)?.room ?? 'exterior'
      const pos = es.find((e) => e.side === 'pos' && e.a <= m && e.b >= m)?.room ?? 'exterior'
      if (neg === 'exterior' && pos === 'exterior') continue
      const last = segs[segs.length - 1]
      if (last && last.b === a && last.neg === neg && last.pos === pos) last.b = b
      else segs.push({ a, b, neg, pos })
    }
    for (const s of segs) {
      const isFence =
        (s.neg === 'garden' && s.pos === 'exterior') || (s.pos === 'garden' && s.neg === 'exterior')
      const h = isFence ? FENCE_H : Math.max(roomHeight(s.neg), roomHeight(s.pos))
      const doors = DOORS.filter((d) => d.axis === axis && d.at === at && d.center > s.a && d.center < s.b).sort(
        (p, q) => p.center - q.center,
      )
      let cursor = s.a
      for (const d of doors) {
        const da = d.center - d.width / 2
        const db = d.center + d.width / 2
        if (da > cursor + 0.01) pieces.push({ id: `w${n++}`, axis, at, a: cursor, b: da, y0: 0, y1: h, neg: s.neg, pos: s.pos, kind: isFence ? 'fence' : 'wall' })
        if (d.sill) pieces.push({ id: `w${n++}`, axis, at, a: da, b: db, y0: 0, y1: d.sill, neg: s.neg, pos: s.pos, kind: 'wall', doorId: d.id })
        if (h > d.height + 0.01)
          pieces.push({ id: `w${n++}`, axis, at, a: da, b: db, y0: d.height, y1: h, neg: s.neg, pos: s.pos, kind: 'lintel', doorId: d.id })
        cursor = db
      }
      if (s.b > cursor + 0.01) pieces.push({ id: `w${n++}`, axis, at, a: cursor, b: s.b, y0: 0, y1: h, neg: s.neg, pos: s.pos, kind: isFence ? 'fence' : 'wall' })
    }
  }
  return pieces
}

export const WALLS = buildWalls()

/** Contour extérieur (pour le soubassement de pierre) : rectangles couverts. */
const FOOTPRINT_RECTS = [...ROOMS.map((r) => ({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 })), TERRACE]

export interface OutlineSeg {
  axis: 'x' | 'z'
  at: number
  a: number
  b: number
  outward: 1 | -1 // direction de l'extérieur le long de l'axe normal
}

function buildOutline(): OutlineSeg[] {
  const out: OutlineSeg[] = []
  const covered = (x: number, z: number) => FOOTPRINT_RECTS.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)
  const xs = [...new Set(FOOTPRINT_RECTS.flatMap((r) => [r.x0, r.x1]))].sort((a, b) => a - b)
  const zs = [...new Set(FOOTPRINT_RECTS.flatMap((r) => [r.z0, r.z1]))].sort((a, b) => a - b)
  const eps = 0.01
  // lignes z constantes
  for (const z of zs) {
    let cur: OutlineSeg | null = null
    for (let i = 0; i < xs.length - 1; i++) {
      const m = (xs[i] + xs[i + 1]) / 2
      const n = covered(m, z - eps)
      const s = covered(m, z + eps)
      const outward: 0 | 1 | -1 = n && !s ? 1 : !n && s ? -1 : 0
      if (outward !== 0 && cur && cur.outward === outward && cur.b === xs[i]) cur.b = xs[i + 1]
      else if (outward !== 0) {
        cur = { axis: 'x', at: z, a: xs[i], b: xs[i + 1], outward }
        out.push(cur)
      } else cur = null
    }
  }
  for (const x of xs) {
    let cur: OutlineSeg | null = null
    for (let i = 0; i < zs.length - 1; i++) {
      const m = (zs[i] + zs[i + 1]) / 2
      const w = covered(x - eps, m)
      const e = covered(x + eps, m)
      const outward: 0 | 1 | -1 = w && !e ? 1 : !w && e ? -1 : 0
      if (outward !== 0 && cur && cur.outward === outward && cur.b === zs[i]) cur.b = zs[i + 1]
      else if (outward !== 0) {
        cur = { axis: 'z', at: x, a: zs[i], b: zs[i + 1], outward }
        out.push(cur)
      } else cur = null
    }
  }
  return out
}

export const OUTLINE = buildOutline()

/* ------------------------------------------------------------------ */
/* Zones, visibilité, hauteur du sol                                    */
/* ------------------------------------------------------------------ */

export function zoneAt(x: number, z: number): ZoneId {
  for (const r of ROOMS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.id
  return 'exterior'
}

export const VISIBILITY: Record<ZoneId, ZoneId[]> = {
  exterior: ['exterior', 'hall'],
  hall: ['hall', 'exterior', 'library', 'recruitment', 'missions', 'shogi', 'garden'],
  library: ['library', 'hall', 'dojo'],
  recruitment: ['recruitment', 'hall'],
  missions: ['missions', 'hall'],
  shogi: ['shogi', 'hall', 'council'],
  garden: ['garden', 'hall', 'dojo', 'council', 'office', 'exterior'],
  dojo: ['dojo', 'garden', 'library'],
  council: ['council', 'garden', 'shogi'],
  office: ['office', 'garden', 'exterior'],
}

/** Tracé du chemin de pierre dans la forêt (x en fonction de z). */
export function pathX(z: number) {
  return Math.sin((z - 34) * 0.07) * 4.2 * smoothstep(34, 52, z)
}

const rampZ = (z: number) => smoothstep(24, 96, z) * 3.4

function rectDist(x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }) {
  const dx = Math.max(r.x0 - x, 0, x - r.x1)
  const dz = Math.max(r.z0 - z, 0, z - r.z1)
  return Math.hypot(dx, dz)
}

export function footprintDistance(x: number, z: number) {
  let d = Infinity
  for (const r of FOOTPRINT_RECTS) d = Math.min(d, rectDist(x, z, r))
  return Math.min(d, rectDist(x, z, STAIRS))
}

export function pathDistance(x: number, z: number) {
  if (z < 9) return Infinity
  return Math.abs(x - pathX(z))
}

/** Relief de la forêt (identique pour le maillage du sol et la marche). */
export function terrainHeight(x: number, z: number) {
  const base = FOREST_Y + rampZ(z)
  const dF = footprintDistance(x, z)
  const dP = pathDistance(x, z)
  const flat = Math.min(smoothstep(2.5, 16, dF), smoothstep(2.4, 9, dP))
  const hills = worldNoise.fbm(x * 0.017 + 3.1, z * 0.017 - 1.7, 3) * 5 + worldNoise.fbm(x * 0.09, z * 0.09, 2) * 0.55
  const bowl = Math.max(0, Math.hypot(x * 0.9, (z + 22) * 0.75) - 58) * 0.16
  return base + (hills + bowl) * flat
}

/** Hauteur du sol sous le joueur. */
export function floorHeight(x: number, z: number) {
  if (x >= STAIRS.x0 && x <= STAIRS.x1 && z >= STAIRS.z0 && z <= STAIRS.z1) {
    return lerp(0, FOREST_Y, (z - STAIRS.z0) / (STAIRS.z1 - STAIRS.z0))
  }
  if (FOOTPRINT_RECTS.some((r) => x >= r.x0 - 0.05 && x <= r.x1 + 0.05 && z >= r.z0 - 0.05 && z <= r.z1 + 0.05)) return 0
  return terrainHeight(x, z)
}

/** Limites praticables de la forêt. */
export const WORLD_BOUNDS = { x0: -62, x1: 62, z0: -82, z1: 96 }

export function zoneMeta(z: ZoneId) {
  if (z === 'exterior') return { name: EXTERIOR_META.name, kanji: EXTERIOR_META.kanji, ordinal: EXTERIOR_META.ordinal }
  const r = ROOM_BY_ID[z]
  return { name: r.name, kanji: r.kanji, ordinal: r.ordinal }
}
