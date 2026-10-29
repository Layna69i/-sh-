/**
 * Toiture japonaise en croupe (yosemune) aux rives relevées (sori) :
 * profil concave, coins retroussés, sous-face en bois, bandeau et arêtiers.
 */
import * as THREE from 'three'
import { lerp } from '../../core/math'

export interface RoofSpec {
  x0: number
  x1: number
  z0: number
  z1: number
  wallTop: number
  overhang: { n: number; s: number; e: number; w: number }
  pitch?: number // hauteur / demi-profondeur
  lift?: number // relevé des coins
  thickness?: number
}

export interface RoofGeometry {
  top: THREE.BufferGeometry[]
  under: THREE.BufferGeometry
  fascia: THREE.BufferGeometry
  ridges: THREE.BufferGeometry
  eaveY: number
  ridgeY: number
}

export const roofProfile = (v: number) => Math.pow(v, 1.45)
const prof = roofProfile

/** Dimensions dérivées d'une toiture (partagées avec les ornements : pignons, épis…). */
export function roofMetrics(spec: RoofSpec) {
  const { overhang: o } = spec
  const X0 = spec.x0 - o.w
  const X1 = spec.x1 + o.e
  const Z0 = spec.z0 - o.n
  const Z1 = spec.z1 + o.s
  const W = X1 - X0
  const D = Z1 - Z0
  const alongX = W >= D
  // repère local : l = le long du faîtage, c = travers
  const L0 = alongX ? X0 : Z0
  const L1 = alongX ? X1 : Z1
  const C0 = alongX ? Z0 : X0
  const C1 = alongX ? Z1 : X1
  const half = (C1 - C0) / 2
  const pitch = spec.pitch ?? 0.62
  const H = half * pitch
  const maxO = Math.max(o.n, o.s, o.e, o.w)
  const eaveY = spec.wallTop + 0.06 - H * prof(Math.min(0.95, maxO / half))
  const lift = spec.lift ?? Math.min(0.9, half * 0.12)
  const thick = spec.thickness ?? 0.28
  const Cc = (C0 + C1) / 2
  const R0 = Math.min(L0 + half, (L0 + L1) / 2)
  const R1 = Math.max(L1 - half, (L0 + L1) / 2)
  return { X0, X1, Z0, Z1, alongX, L0, L1, C0, C1, half, H, eaveY, lift, thick, Cc, R0, R1, ridgeY: eaveY + H }
}

export function buildRoof(spec: RoofSpec): RoofGeometry {
  const { alongX, L0, L1, C0, C1, half, H, eaveY, lift, thick, Cc, R0, R1 } = roofMetrics(spec)

  const toWorld = (l: number, y: number, c: number) => (alongX ? new THREE.Vector3(l, y, c) : new THREE.Vector3(c, y, l))
  // Le repère local inverse l'orientation quand le faîtage suit z : on corrige l'ordre des sommets.
  const flip = !alongX

  type P2 = [number, number] // (l, c)
  const slopes: { a: P2; b: P2; ra: P2; rb: P2 }[] = [
    { a: [L0, C1], b: [L1, C1], ra: [R0, Cc], rb: [R1, Cc] }, // côté c+
    { a: [L1, C0], b: [L0, C0], ra: [R1, Cc], rb: [R0, Cc] }, // côté c-
    { a: [L0, C0], b: [L0, C1], ra: [R0, Cc], rb: [R0, Cc] }, // extrémité l-
    { a: [L1, C1], b: [L1, C0], ra: [R1, Cc], rb: [R1, Cc] }, // extrémité l+
  ]

  const NU = 18
  const NV = 10
  const top: THREE.BufferGeometry[] = []
  const underPos: number[] = []
  const underUv: number[] = []
  const fasciaPos: number[] = []
  const fasciaUv: number[] = []
  const hips: THREE.Vector3[][] = []

  const point = (s: (typeof slopes)[number], u: number, v: number) => {
    const ex = lerp(s.a[0], s.b[0], u)
    const ec = lerp(s.a[1], s.b[1], u)
    const rx = lerp(s.ra[0], s.rb[0], u)
    const rc = lerp(s.ra[1], s.rb[1], u)
    const l = lerp(ex, rx, v)
    const c = lerp(ec, rc, v)
    const t = Math.abs(2 * u - 1)
    const y = eaveY + H * prof(v) + lift * Math.pow(t, 3) * Math.pow(1 - v, 2)
    return toWorld(l, y, c)
  }

  for (let si = 0; si < slopes.length; si++) {
    const s = slopes[si]
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    const eaveLen = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])
    const el = (s.b[0] - s.a[0]) / eaveLen
    const ec = (s.b[1] - s.a[1]) / eaveLen
    const slopeLen = Math.hypot(half, H) * 1.05
    for (let j = 0; j <= NV; j++) {
      for (let i = 0; i <= NU; i++) {
        const u = i / NU
        const v = j / NV
        const p = point(s, u, v)
        pos.push(p.x, p.y, p.z)
        const pl = alongX ? p.x : p.z
        const pc = alongX ? p.z : p.x
        // rangées de tuiles parallèles, perpendiculaires à la rive
        uv.push((pl - s.a[0]) * el + (pc - s.a[1]) * ec, v * slopeLen)
      }
    }
    for (let j = 0; j < NV; j++) {
      for (let i = 0; i < NU; i++) {
        const a = j * (NU + 1) + i
        const b = a + 1
        const c = a + NU + 1
        const d = c + 1
        if (flip) idx.push(a, c, b, b, c, d)
        else idx.push(a, b, c, b, d, c)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    top.push(g)

    // Sous-face : même surface abaissée, orientation inversée
    for (let j = 0; j < NV; j++) {
      for (let i = 0; i < NU; i++) {
        const q = (ii: number, jj: number) => {
          const p = point(s, ii / NU, jj / NV)
          p.y -= thick
          return p
        }
        const A = q(i, j)
        const B = q(i + 1, j)
        const C = q(i, j + 1)
        const Dd = q(i + 1, j + 1)
        const tri = flip ? [A, B, C, B, Dd, C] : [A, C, B, B, C, Dd]
        for (const p of tri) {
          underPos.push(p.x, p.y, p.z)
          underUv.push(p.x * 0.8 + p.z * 0.8, p.y)
        }
      }
    }
    // Bandeau de rive
    for (let i = 0; i < NU; i++) {
      const A = point(s, i / NU, 0)
      const B = point(s, (i + 1) / NU, 0)
      const A2 = A.clone()
      A2.y -= thick + 0.06
      const B2 = B.clone()
      B2.y -= thick + 0.06
      const quad = flip ? [A, B, A2, B, B2, A2] : [A, A2, B, B, A2, B2]
      for (const p of quad) {
        fasciaPos.push(p.x, p.y, p.z)
        fasciaUv.push((p.x + p.z) * 1, p.y)
      }
    }
    // Arêtier (ligne u = 0 des pentes principales)
    if (si < 2) {
      const line: THREE.Vector3[] = []
      for (let j = 0; j <= NV; j++) {
        const p = point(s, 0, j / NV)
        p.y += 0.08
        line.push(p)
      }
      hips.push(line)
      const line2: THREE.Vector3[] = []
      for (let j = 0; j <= NV; j++) {
        const p = point(s, 1, j / NV)
        p.y += 0.08
        line2.push(p)
      }
      hips.push(line2)
    }
  }

  const under = new THREE.BufferGeometry()
  under.setAttribute('position', new THREE.Float32BufferAttribute(underPos, 3))
  under.setAttribute('uv', new THREE.Float32BufferAttribute(underUv, 2))
  under.computeVertexNormals()
  const fascia = new THREE.BufferGeometry()
  fascia.setAttribute('position', new THREE.Float32BufferAttribute(fasciaPos, 3))
  fascia.setAttribute('uv', new THREE.Float32BufferAttribute(fasciaUv, 2))
  fascia.computeVertexNormals()

  // Faîtage + arêtiers + épis
  const ridgeParts: THREE.BufferGeometry[] = []
  const ridgeY = eaveY + H
  const rl = Math.max(0.6, R1 - R0)
  const ridge = new THREE.BoxGeometry(alongX ? rl + 0.5 : 0.5, 0.42, alongX ? 0.5 : rl + 0.5)
  ridge.translate(alongX ? (R0 + R1) / 2 : Cc, ridgeY + 0.12, alongX ? Cc : (R0 + R1) / 2)
  ridgeParts.push(ridge.toNonIndexed())
  const cap = new THREE.BoxGeometry(alongX ? rl + 0.7 : 0.62, 0.1, alongX ? 0.62 : rl + 0.7)
  cap.translate(alongX ? (R0 + R1) / 2 : Cc, ridgeY + 0.36, alongX ? Cc : (R0 + R1) / 2)
  ridgeParts.push(cap.toNonIndexed())
  for (const e of [R0, R1]) {
    const oni = new THREE.BoxGeometry(alongX ? 0.18 : 0.8, 0.8, alongX ? 0.8 : 0.18)
    const sign = e === R0 ? -1 : 1
    oni.translate(alongX ? e + sign * 0.3 : Cc, ridgeY + 0.38, alongX ? Cc : e + sign * 0.3)
    ridgeParts.push(oni.toNonIndexed())
  }
  for (const line of hips) {
    const curve = new THREE.CatmullRomCurve3(line)
    const tube = new THREE.TubeGeometry(curve, 12, 0.13, 5, false)
    ridgeParts.push(tube.toNonIndexed())
  }
  for (const g of ridgeParts) {
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
  }
  const ridges = mergeSimple(ridgeParts)
  return { top, under, fascia, ridges, eaveY, ridgeY }
}

function mergeSimple(geos: THREE.BufferGeometry[]) {
  let count = 0
  for (const g of geos) count += g.attributes.position.count
  const pos = new Float32Array(count * 3)
  const nor = new Float32Array(count * 3)
  const uv = new Float32Array(count * 2)
  let o = 0
  for (const g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals()
    pos.set(g.attributes.position.array as Float32Array, o * 3)
    nor.set(g.attributes.normal.array as Float32Array, o * 3)
    uv.set(g.attributes.uv.array as Float32Array, o * 2)
    o += g.attributes.position.count
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return out
}
