/**
 * Coque du bâtiment générée depuis le plan : murs (styles intérieur/extérieur
 * par face), colombages, planchers, plafonds à caissons, fenêtres de papier
 * éclairées, toitures. Tout est fusionné par matériau.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { M, cachedMaterial } from '../assets'
import { StaticBuilder } from '../geo'
import { StaticMeshes } from '../Static'
import { WALLS, WALL_T, ROOMS, ROOM_BY_ID, DOORS, FENCE_H, type WallPiece, type ZoneId, type RoomDef } from '../layout'
import { buildRoof, type RoofSpec } from './roof'
import { useSettings, QUALITY } from '../../store/settings'

type MatKey = 'woodDark' | 'woodBlack' | 'woodMid' | 'plaster' | 'plasterExt' | 'plasterDark' | 'plasterWarm'

const tinted = (key: string, base: THREE.MeshStandardMaterial, color: number) =>
  cachedMaterial(key, () => {
    const m = base.clone()
    m.color.setHex(color)
    return m
  })

function mat(k: MatKey) {
  const m = M()
  switch (k) {
    case 'plasterDark':
      return tinted('plasterDark', m.plaster, 0x8a7e6c)
    case 'plasterWarm':
      return tinted('plasterWarm', m.plaster, 0xe0c9a0)
    default:
      return m[k]
  }
}

const STYLE: Record<ZoneId, { lower: MatKey; upper: MatKey; split: number }> = {
  exterior: { lower: 'woodDark', upper: 'plasterExt', split: 1.15 },
  garden: { lower: 'woodDark', upper: 'plasterExt', split: 0.95 },
  hall: { lower: 'woodBlack', upper: 'plasterDark', split: 1.4 },
  library: { lower: 'woodDark', upper: 'woodMid', split: 1.0 },
  shogi: { lower: 'woodBlack', upper: 'plasterDark', split: 0.9 },
  dojo: { lower: 'woodMid', upper: 'plaster', split: 1.0 },
  missions: { lower: 'woodDark', upper: 'plaster', split: 1.0 },
  council: { lower: 'woodBlack', upper: 'plasterDark', split: 1.1 },
  office: { lower: 'woodMid', upper: 'plasterWarm', split: 0.9 },
  recruitment: { lower: 'woodDark', upper: 'plaster', split: 1.0 },
}

const WINDOW_ROWS: Partial<Record<ZoneId, number[]>> = {
  hall: [6.6],
  library: [6.1],
  dojo: [2.7],
  missions: [2.5],
  council: [2.9],
  recruitment: [2.5],
}

const zoneHeight = (z: ZoneId) => (z === 'exterior' || z === 'garden' ? 0 : ROOM_BY_ID[z].height)
const isOutside = (z: ZoneId) => z === 'exterior' || z === 'garden'

/** Plan vertical d'une face de mur. side = +1 (côté positif) ou -1. */
function faceGeo(p: WallPiece, side: 1 | -1, y0: number, y1: number, off = WALL_T / 2) {
  const w = p.b - p.a
  const h = y1 - y0
  const g = new THREE.PlaneGeometry(w, h)
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w + (side > 0 ? p.a : -p.b), uv.getY(i) * h + y0)
  const mid = (p.a + p.b) / 2
  const ym = (y0 + y1) / 2
  if (p.axis === 'x') {
    if (side < 0) g.rotateY(Math.PI)
    g.translate(mid, ym, p.at + side * off)
  } else {
    g.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2)
    g.translate(p.at + side * off, ym, mid)
  }
  return g
}

/** Ajoute une boîte alignée sur une face de mur (poteau, poutre…). */
function onFace(b: StaticBuilder, m: THREE.Material, p: WallPiece, side: 1 | -1, along: number, len: number, y: number, h: number, depth: number, gap = 0) {
  const off = p.at + side * (WALL_T / 2 + depth / 2 + gap)
  if (p.axis === 'x') b.box(m, len, h, depth, [along, y, off])
  else b.box(m, depth, h, len, [off, y, along])
}

function addFace(b: StaticBuilder, p: WallPiece, side: 1 | -1, zone: ZoneId) {
  const m = M()
  const room = isOutside(zone) ? null : ROOM_BY_ID[zone]
  const hz = zoneHeight(zone)
  const y0 = p.y0
  const y1 = p.y1
  const st = STYLE[zone]
  // Partie intérieure (jusqu'au plafond de la pièce)
  const inTop = Math.min(y1, hz)
  const segs: [number, number, ZoneId][] = []
  if (!isOutside(zone) && inTop > y0) segs.push([y0, inTop, zone])
  const exFrom = Math.max(y0, isOutside(zone) ? y0 : hz)
  if (exFrom < y1) segs.push([exFrom, y1, isOutside(zone) ? zone : 'exterior'])
  for (const [a, c, z] of segs) {
    const s = STYLE[z]
    const split = Math.min(Math.max(s.split, a), c)
    if (split > a + 0.01) b.add(faceGeo(p, side, a, split), mat(s.lower))
    if (c > split + 0.01) b.add(faceGeo(p, side, split, c), mat(s.upper))
  }
  const len = p.b - p.a
  const mid = (p.a + p.b) / 2
  const full = y0 < 0.01
  if (room) {
    // Colombages intérieurs
    const wood = room.id === 'council' || room.id === 'shogi' || room.id === 'hall' ? m.woodBlack : m.woodDark
    const top = Math.min(y1, room.height)
    if (full) {
      const n = Math.max(1, Math.round(len / 2.7))
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const x = p.a + 0.09 + t * (len - 0.18)
        onFace(b, wood, p, side, x, 0.18, top / 2, top, 0.07)
      }
      onFace(b, wood, p, side, mid, len, 0.05, 0.1, 0.03)
      if (st.split > 0.2) onFace(b, wood, p, side, mid, len, st.split, 0.06, 0.05)
    }
    if (room.height > 3.2 && y0 < 2.3 && top > 2.4) onFace(b, wood, p, side, mid, len, 2.32, 0.13, 0.07)
    if (p.kind === 'lintel') onFace(b, wood, p, side, mid, len + 0.1, y0 + 0.06, 0.12, 0.09)
    if (top >= room.height - 0.05) onFace(b, wood, p, side, mid, len, room.height - 0.12, 0.24, 0.08)
    if (room.height > 6 && full) onFace(b, wood, p, side, mid, len, room.height * 0.55, 0.16, 0.08)
  } else if (p.kind !== 'fence') {
    // Colombages extérieurs
    const n = Math.max(1, Math.round(len / 2.4))
    if (full)
      for (let i = 0; i <= n; i++) {
        const x = p.a + 0.11 + (i / n) * (len - 0.22)
        onFace(b, m.woodDark, p, side, x, 0.22, (y0 + y1) / 2, y1 - y0, 0.09)
      }
    if (full) onFace(b, m.woodDark, p, side, mid, len, STYLE[zone].split, 0.12, 0.1)
    for (let y = 3.6; y < y1 - 0.6; y += 3) if (y > y0 + 0.2) onFace(b, m.woodDark, p, side, mid, len, y, 0.16, 0.1)
    onFace(b, m.woodDark, p, side, mid, len, y1 - 0.2, 0.3, 0.12)
    if (p.kind === 'lintel') onFace(b, m.woodDark, p, side, mid, len + 0.1, y0 + 0.07, 0.14, 0.1)
  }
}

function addWindows(b: StaticBuilder, p: WallPiece) {
  const m = M()
  if (p.kind !== 'wall') return
  const len = p.b - p.a
  for (const side of [1, -1] as const) {
    const outside = side > 0 ? p.pos : p.neg
    const inside = side > 0 ? p.neg : p.pos
    if (!isOutside(outside) || isOutside(inside)) continue
    const rows = WINDOW_ROWS[inside]
    if (!rows || len < 2.6) continue
    const count = Math.max(1, Math.floor(len / 3.4))
    for (let i = 0; i < count; i++) {
      const c = p.a + ((i + 0.5) / count) * len
      for (const y of rows) {
        if (y + 0.7 > p.y1 - 0.3) continue
        const w = 1.5
        const h = 1.05
        // panneau lumineux côté extérieur
        const pane = new THREE.PlaneGeometry(w, h)
        const pin = new THREE.PlaneGeometry(w, h)
        if (p.axis === 'x') {
          if (side < 0) pane.rotateY(Math.PI)
          pane.translate(c, y, p.at + side * (WALL_T / 2 + 0.012))
          if (side > 0) pin.rotateY(Math.PI)
          pin.translate(c, y, p.at - side * (WALL_T / 2 + 0.012))
        } else {
          pane.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2)
          pane.translate(p.at + side * (WALL_T / 2 + 0.012), y, c)
          pin.rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2)
          pin.translate(p.at - side * (WALL_T / 2 + 0.012), y, c)
        }
        b.add(pane, m.window)
        if (inside !== 'library') b.add(pin, m.shoji)
        // encadrement extérieur
        const fake: WallPiece = { ...p }
        onFace(b, m.woodBlack, fake, side, c, w + 0.2, y + h / 2 + 0.06, 0.1, 0.12)
        onFace(b, m.woodBlack, fake, side, c, w + 0.3, y - h / 2 - 0.06, 0.1, 0.16)
        onFace(b, m.woodBlack, fake, side, c - w / 2 - 0.05, 0.09, y, h + 0.2, 0.12)
        onFace(b, m.woodBlack, fake, side, c + w / 2 + 0.05, 0.09, y, h + 0.2, 0.12)
        // barreaux verticaux (koshi-goshi)
        for (let k = 1; k < 7; k++) onFace(b, m.woodBlack, fake, side, c - w / 2 + (k * w) / 7, 0.035, y, h, 0.05, 0.04)
      }
    }
  }
}

function overhangFor(r: RoomDef, side: 'n' | 's' | 'e' | 'w') {
  const neighbors = WALLS.filter((p) => {
    if (side === 'n') return p.axis === 'x' && p.at === r.z0 && p.pos === r.id
    if (side === 's') return p.axis === 'x' && p.at === r.z1 && p.neg === r.id
    if (side === 'w') return p.axis === 'z' && p.at === r.x0 && p.pos === r.id
    return p.axis === 'z' && p.at === r.x1 && p.neg === r.id
  }).map((p) => (side === 'n' || side === 'w' ? p.neg : p.pos))
  const blocked = neighbors.some((z) => !isOutside(z) && ROOM_BY_ID[z].height >= r.height - 2)
  return blocked ? 0 : 1.55
}

/** Toiture d'une pièce (partagée avec les ornements de façade). */
export function roofSpecFor(r: RoomDef): RoofSpec {
  const o = { n: overhangFor(r, 'n'), s: overhangFor(r, 's'), e: overhangFor(r, 'e'), w: overhangFor(r, 'w') }
  // Le hall reçoit un débord symétrique : son faîtage reste centré sur la grande porte.
  if (r.id === 'hall') o.w = o.e = 1.55
  return { x0: r.x0 - 0.15, x1: r.x1 + 0.15, z0: r.z0 - 0.15, z1: r.z1 + 0.15, wallTop: r.height, overhang: o, pitch: r.id === 'hall' ? 0.84 : r.id === 'library' ? 0.66 : 0.6 }
}

export function Shell() {
  const shadows = QUALITY[useSettings((s) => s.quality)].shadows
  const parts = useMemo(() => {
    const m = M()
    const b = new StaticBuilder({ cast: false, receive: true })

    // Murs
    for (const p of WALLS) {
      if (p.kind === 'fence') continue
      addFace(b, p, 1, p.pos)
      addFace(b, p, -1, p.neg)
      // tranches et dessous des linteaux
      const len = p.b - p.a
      const h = p.y1 - p.y0
      if (p.axis === 'x') {
        b.box(m.woodDark, 0.02, h, WALL_T, [p.a + 0.01, (p.y0 + p.y1) / 2, p.at])
        b.box(m.woodDark, 0.02, h, WALL_T, [p.b - 0.01, (p.y0 + p.y1) / 2, p.at])
        if (p.kind === 'lintel') b.box(m.woodDark, len, 0.03, WALL_T + 0.02, [(p.a + p.b) / 2, p.y0 + 0.015, p.at])
      } else {
        b.box(m.woodDark, WALL_T, h, 0.02, [p.at, (p.y0 + p.y1) / 2, p.a + 0.01])
        b.box(m.woodDark, WALL_T, h, 0.02, [p.at, (p.y0 + p.y1) / 2, p.b - 0.01])
        if (p.kind === 'lintel') b.box(m.woodDark, WALL_T + 0.02, 0.03, len, [p.at, p.y0 + 0.015, (p.a + p.b) / 2])
      }
      addWindows(b, p)
    }

    // Murets du jardin (tsuiji-bei) coiffés de tuiles
    for (const p of WALLS.filter((w) => w.kind === 'fence')) {
      const len = p.b - p.a
      const mid = (p.a + p.b) / 2
      const along = p.axis === 'x'
      b.add(faceGeo(p, 1, 0, FENCE_H), m.plasterExt)
      b.add(faceGeo(p, -1, 0, FENCE_H), m.plasterExt)
      b.box(m.woodDark, along ? len : WALL_T + 0.04, 0.35, along ? WALL_T + 0.04 : len, along ? [mid, 0.17, p.at] : [p.at, 0.17, mid])
      const cap = along ? [len + 0.2, 0.12, 0.8] : [0.8, 0.12, len + 0.2]
      b.box(m.roof, cap[0], cap[1], cap[2], along ? [mid, FENCE_H + 0.06, p.at] : [p.at, FENCE_H + 0.06, mid], undefined, { cast: shadows })
      b.box(m.stoneDark, along ? len + 0.2 : 0.3, 0.16, along ? 0.3 : len + 0.2, along ? [mid, FENCE_H + 0.18, p.at] : [p.at, FENCE_H + 0.18, mid])
    }

    // Planchers et plafonds
    for (const r of ROOMS) {
      const w = r.x1 - r.x0
      const d = r.z1 - r.z0
      const cx = (r.x0 + r.x1) / 2
      const cz = (r.z0 + r.z1) / 2
      const floorMat = r.floor === 'tatami' ? m.tatami : r.floor === 'gravel' ? m.gravel : r.floor === 'polished' ? m.polished : m.planks
      const fg = new THREE.PlaneGeometry(w, d)
      fg.rotateX(-Math.PI / 2)
      fg.translate(cx, 0, cz)
      const uv = fg.attributes.uv as THREE.BufferAttribute
      const pos = fg.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i))
      // le jardin a son propre sol de sable ratissé en relief (GardenSand)
      if (r.floor !== 'gravel') b.add(fg, floorMat)
      if (r.open) continue
      // plafond
      const cg = new THREE.PlaneGeometry(w, d)
      cg.rotateX(Math.PI / 2)
      cg.translate(cx, r.height, cz)
      const cuv = cg.attributes.uv as THREE.BufferAttribute
      const cpos = cg.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cpos.getX(i), cpos.getZ(i))
      b.add(cg, m.ceiling)
      // caissons (sao-buchi)
      const wood = r.id === 'hall' || r.id === 'shogi' || r.id === 'council' ? m.woodBlack : m.woodDark
      const step = r.id === 'hall' ? 0.6 : 0.45
      for (let x = r.x0 + step; x < r.x1 - 0.05; x += step) b.box(wood, 0.045, 0.05, d, [x, r.height - 0.025, cz])
      const beam = r.id === 'hall' ? 3.2 : 1.8
      for (let z = r.z0 + beam; z < r.z1 - 0.1; z += beam) b.box(wood, w, r.id === 'hall' ? 0.55 : 0.12, r.id === 'hall' ? 0.36 : 0.12, [cx, r.height - (r.id === 'hall' ? 0.275 : 0.06), z])
    }

    // Toitures
    const roofMat = m.roof
    const ridgeMat = tinted('ridge', m.roof, 0x5c6066)
    for (const r of ROOMS) {
      if (r.open) continue
      const roof = buildRoof(roofSpecFor(r))
      roof.top.forEach((g) => b.add(g, roofMat, undefined, { cast: shadows }))
      b.add(roof.under, m.roofUnder)
      b.add(roof.fascia, m.woodDark)
      b.add(roof.ridges, ridgeMat, undefined, { cast: shadows })
    }

    // Porte : seuils (shikii) et montants pour chaque ouverture
    for (const d of DOORS) {
      if (d.kind === 'window') continue
      const along = d.axis === 'x'
      const mid: [number, number, number] = along ? [d.center, 0.02, d.at] : [d.at, 0.02, d.center]
      b.box(m.woodBlack, along ? d.width + 0.1 : WALL_T + 0.06, 0.04, along ? WALL_T + 0.06 : d.width + 0.1, mid)
    }
    return b.build()
  }, [shadows])

  // Toute la coque projette des ombres (lumière rasante du couchant dans les ouvertures).
  // Les faces étant simples, les deux côtés du mur participent à la carte d'ombre.
  const withShadow = useMemo(() => parts.map((p) => ({ ...p, cast: shadows })), [parts, shadows])

  return <StaticMeshes parts={withShadow} />
}
