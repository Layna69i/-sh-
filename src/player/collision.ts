/**
 * Collisions 2D (plan XZ) : le joueur est un cercle, le décor des boîtes alignées
 * ou des cylindres. Le sol étant défini analytiquement (floorHeight), un moteur
 * physique complet n'est pas nécessaire : ce solveur est déterministe, très léger
 * et permet de glisser naturellement le long des murs.
 */
import { WALLS, WALL_T, OUTLINE, STAIRS, TERRACE, WORLD_BOUNDS, DOORS } from '../world/layout'

export interface Box {
  x0: number
  x1: number
  z0: number
  z1: number
  owner?: string
}
export interface Circle {
  x: number
  z: number
  r: number
  owner?: string
}

const staticBoxes: Box[] = []
const dynamicBoxes = new Map<string, Box[]>()
const circles = new Map<string, Circle[]>()
const disabled = new Set<string>()

function wallBox(axis: 'x' | 'z', at: number, a: number, b: number, t = WALL_T): Box {
  return axis === 'x' ? { x0: a, x1: b, z0: at - t / 2, z1: at + t / 2 } : { x0: at - t / 2, x1: at + t / 2, z0: a, z1: b }
}

// Murs et palissades (les linteaux, au-dessus des portes, ne bloquent pas).
for (const w of WALLS) if (w.kind !== 'lintel') staticBoxes.push(wallBox(w.axis, w.at, w.a, w.b))

// Soubassement de pierre vu depuis la forêt (sauf ouverture de l'escalier).
for (const o of OUTLINE) {
  const off = o.outward * 0.35
  if (o.axis === 'x' && o.at === TERRACE.z1) {
    if (o.a < STAIRS.x0) staticBoxes.push(wallBox('x', o.at + off, o.a, STAIRS.x0, 0.6))
    if (o.b > STAIRS.x1) staticBoxes.push(wallBox('x', o.at + off, STAIRS.x1, o.b, 0.6))
  } else staticBoxes.push(wallBox(o.axis, o.at + off, o.a - 0.3, o.b + 0.3, 0.6))
}
// Garde-corps de la terrasse
staticBoxes.push(wallBox('x', TERRACE.z1 - 0.1, TERRACE.x0, STAIRS.x0, 0.2))
staticBoxes.push(wallBox('x', TERRACE.z1 - 0.1, STAIRS.x1, TERRACE.x1, 0.2))
staticBoxes.push(wallBox('z', TERRACE.x0 + 0.1, TERRACE.z0, TERRACE.z1, 0.2))
staticBoxes.push(wallBox('z', TERRACE.x1 - 0.1, TERRACE.z0, TERRACE.z1, 0.2))
// Rampes de l'escalier
staticBoxes.push(wallBox('z', STAIRS.x0 - 0.15, STAIRS.z0, STAIRS.z1 + 0.4, 0.3))
staticBoxes.push(wallBox('z', STAIRS.x1 + 0.15, STAIRS.z0, STAIRS.z1 + 0.4, 0.3))
// Bords du monde
const B = WORLD_BOUNDS
staticBoxes.push({ x0: B.x0 - 10, x1: B.x0, z0: B.z0 - 10, z1: B.z1 + 10 })
staticBoxes.push({ x0: B.x1, x1: B.x1 + 10, z0: B.z0 - 10, z1: B.z1 + 10 })
staticBoxes.push({ x0: B.x0 - 10, x1: B.x1 + 10, z0: B.z0 - 10, z1: B.z0 })
staticBoxes.push({ x0: B.x0 - 10, x1: B.x1 + 10, z0: B.z1, z1: B.z1 + 10 })

// Portes : un collisionneur par porte, désactivé lorsqu'elle est ouverte.
for (const d of DOORS) dynamicBoxes.set(`door:${d.id}`, [wallBox(d.axis, d.at, d.center - d.width / 2, d.center + d.width / 2, 0.24)])

export function setColliders(owner: string, boxes: Box[]) {
  dynamicBoxes.set(owner, boxes)
}
export function setCircles(owner: string, list: Circle[]) {
  circles.set(owner, list)
}
export function removeColliders(owner: string) {
  dynamicBoxes.delete(owner)
  circles.delete(owner)
}
export function setColliderEnabled(owner: string, enabled: boolean) {
  if (enabled) disabled.delete(owner)
  else disabled.add(owner)
}

/** Boîte orientée → boîte englobante alignée (suffisant pour le mobilier). */
export function boxAround(x: number, z: number, w: number, d: number, rotY = 0, pad = 0): Box {
  const c = Math.abs(Math.cos(rotY))
  const s = Math.abs(Math.sin(rotY))
  const hw = (w * c + d * s) / 2 + pad
  const hd = (w * s + d * c) / 2 + pad
  return { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd }
}

function pushOutBox(p: { x: number; z: number }, r: number, b: Box) {
  const cx = Math.max(b.x0, Math.min(p.x, b.x1))
  const cz = Math.max(b.z0, Math.min(p.z, b.z1))
  let dx = p.x - cx
  let dz = p.z - cz
  const d2 = dx * dx + dz * dz
  if (d2 > r * r) return false
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2)
    const k = (r - d) / d
    p.x += dx * k
    p.z += dz * k
  } else {
    // Centre à l'intérieur : sortie par la face la plus proche.
    const l = p.x - b.x0
    const rr = b.x1 - p.x
    const t = p.z - b.z0
    const bb = b.z1 - p.z
    const m = Math.min(l, rr, t, bb)
    if (m === l) p.x = b.x0 - r
    else if (m === rr) p.x = b.x1 + r
    else if (m === t) p.z = b.z0 - r
    else p.z = b.z1 + r
  }
  return true
}

function pushOutCircle(p: { x: number; z: number }, r: number, c: Circle) {
  const dx = p.x - c.x
  const dz = p.z - c.z
  const rr = r + c.r
  const d2 = dx * dx + dz * dz
  if (d2 >= rr * rr || d2 < 1e-12) return false
  const d = Math.sqrt(d2)
  p.x = c.x + (dx / d) * rr
  p.z = c.z + (dz / d) * rr
  return true
}

const near = (b: Box, p: { x: number; z: number }, m: number) => p.x > b.x0 - m && p.x < b.x1 + m && p.z > b.z0 - m && p.z < b.z1 + m

/** Résout la position du joueur (modifie p). */
export function resolve(p: { x: number; z: number }, r: number) {
  for (let it = 0; it < 4; it++) {
    let hit = false
    for (const b of staticBoxes) if (near(b, p, r + 0.5) && pushOutBox(p, r, b)) hit = true
    for (const [owner, list] of dynamicBoxes) {
      if (disabled.has(owner)) continue
      for (const b of list) if (near(b, p, r + 0.5) && pushOutBox(p, r, b)) hit = true
    }
    for (const [owner, list] of circles) {
      if (disabled.has(owner)) continue
      for (const c of list) if (Math.abs(p.x - c.x) < c.r + r + 0.5 && Math.abs(p.z - c.z) < c.r + r + 0.5 && pushOutCircle(p, r, c)) hit = true
    }
    if (!hit) break
  }
}
