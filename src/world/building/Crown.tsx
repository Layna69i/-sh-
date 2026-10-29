/**
 * Ornements de façade du hall : pignon décoratif (chidori-hafu) posé sur la
 * croupe avant avec l'emblème doré, épis de faîtage dorés (shachihoko),
 * porche à fronton courbe (karahafu) et murs de shoji éclairés de part et
 * d'autre de la grande porte.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { M, cachedMaterial } from '../assets'
import { StaticBuilder, boxGeo } from '../geo'
import { StaticMeshes } from '../Static'
import { ROOM_BY_ID } from '../layout'
import { roofMetrics, roofProfile } from './roof'
import { roofSpecFor } from './Shell'
import { Placer } from '../props/furniture'
import { useSettings, QUALITY } from '../../store/settings'

/** Queue de shachihoko stylisée (extrusion). */
function shachiGeo() {
  const s = new THREE.Shape()
  s.moveTo(-0.16, 0)
  s.lineTo(0.16, 0)
  s.bezierCurveTo(0.2, 0.35, 0.05, 0.55, 0.22, 0.85)
  s.bezierCurveTo(0.34, 1.05, 0.5, 1.12, 0.55, 1.3)
  s.bezierCurveTo(0.32, 1.28, 0.12, 1.2, 0.02, 1.02)
  s.bezierCurveTo(-0.12, 0.8, -0.22, 0.45, -0.16, 0)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 10 })
  g.translate(0, 0, -0.08)
  return g
}

const goldEmblem = () =>
  cachedMaterial('crown-emblem', () => {
    const m = M().emblemGold.clone()
    m.depthWrite = true
    m.alphaTest = 0.4
    m.transparent = false
    m.emissiveIntensity = 0.5
    return m
  })

function buildCrown(b: StaticBuilder, shadows: boolean) {
  const m = M()
  const P = new Placer(b)
  const hall = ROOM_BY_ID.hall
  const R = roofMetrics(roofSpecFor(hall))
  const yAt = (z: number) => R.eaveY + R.H * roofProfile(Math.max(0, Math.min(1, (R.Z1 - z) / R.half)))

  /* --- chidori-hafu sur la croupe avant --- */
  const zf = R.Z1 - 0.3 * R.half
  const yb = yAt(zf)
  const Wd = 8.4
  const Hd = 4.0
  const ya = yb + Hd
  // recul du faîtage du pignon jusqu'à la rencontre de la pente principale
  let vb = 0.3
  while (vb < 1 && yAt(R.Z1 - vb * R.half) < ya + 0.1) vb += 0.01
  const zb = R.Z1 - vb * R.half
  const frontOver = 0.75
  const eaveX = Wd / 2 + 0.7
  const slopeH = ya + 0.18 - (yb - 0.32)
  const slant = Math.hypot(eaveX, slopeH)
  const ang = Math.atan2(slopeH, eaveX)
  const depth = zf + frontOver - zb
  const zc = (zf + frontOver + zb) / 2
  for (const s of [-1, 1]) {
    const cx = (s * eaveX) / 2
    const cy = (ya + 0.18 + yb - 0.32) / 2
    P.geo(boxGeo(slant + 0.2, 0.2, depth), m.roof, [cx, cy + 0.1, zc], [0, 0, -s * ang], 1, shadows)
    P.geo(boxGeo(slant + 0.2, 0.08, depth), m.roofUnder, [cx, cy - 0.06, zc], [0, 0, -s * ang])
    // bargeboards (hafu-ita) et pointes dorées
    P.geo(boxGeo(slant + 0.35, 0.42, 0.14), m.woodBlack, [cx, cy - 0.05, zf + frontOver + 0.02], [0, 0, -s * ang], 1, shadows)
    P.box(m.gold, 0.32, 0.12, 0.18, [s * (eaveX + 0.1), yb - 0.4, zf + frontOver + 0.06], [0, 0, -s * ang])
  }
  P.box(m.roof, 0.42, 0.34, depth + 0.2, [0, ya + 0.36, zc], [0, 0, 0], shadows)
  // tympan : enduit blanc, colombage et lattis vertical (kitsuregoshi)
  const tri = new THREE.Shape()
  tri.moveTo(-Wd / 2, 0)
  tri.lineTo(Wd / 2, 0)
  tri.lineTo(0, Hd)
  tri.closePath()
  P.geo(new THREE.ShapeGeometry(tri), m.plasterExt, [0, yb, zf])
  P.box(m.woodBlack, Wd + 0.3, 0.26, 0.2, [0, yb + 0.1, zf + 0.05], [0, 0, 0], shadows)
  P.box(m.woodBlack, Wd - 1.2, 0.14, 0.14, [0, yb + 1.45, zf + 0.06])
  for (let x = -Wd / 2 + 1.0; x <= Wd / 2 - 1.0 + 1e-3; x += 0.32) {
    const top = Hd * (1 - Math.abs(x) / (Wd / 2)) - 0.2
    if (top < 1.75) continue
    P.box(m.woodBlack, 0.07, top - 1.5, 0.06, [x, yb + 1.5 + (top - 1.5) / 2, zf + 0.04])
  }
  P.geo(new THREE.CircleGeometry(0.72, 40), m.woodBlack, [0, yb + 0.78, zf + 0.06])
  P.geo(new THREE.PlaneGeometry(1.25, 1.25), goldEmblem(), [0, yb + 0.78, zf + 0.075])
  // gegyo (ornement doré sous le faîtage)
  P.geo(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 6), m.gold, [0, ya - 0.25, zf + frontOver + 0.12], [Math.PI / 2, 0, 0])
  P.box(m.gold, 0.12, 0.5, 0.06, [0, ya - 0.62, zf + frontOver + 0.1])

  /* --- shachihoko dorés aux extrémités du faîtage (hall et bibliothèque) --- */
  const tail = shachiGeo()
  const ridgeEnds: { x: number; z: number; y: number; ry: number }[] = [
    { x: R.Cc, z: R.R1 - 0.1, y: R.ridgeY + 0.42, ry: 0 },
    { x: R.Cc, z: R.R0 + 0.1, y: R.ridgeY + 0.42, ry: Math.PI },
  ]
  const lib = roofMetrics(roofSpecFor(ROOM_BY_ID.library))
  if (lib.alongX) {
    ridgeEnds.push({ x: lib.R0 + 0.1, z: lib.Cc, y: lib.ridgeY + 0.42, ry: -Math.PI / 2 }, { x: lib.R1 - 0.1, z: lib.Cc, y: lib.ridgeY + 0.42, ry: Math.PI / 2 })
  } else {
    ridgeEnds.push({ x: lib.Cc, z: lib.R1 - 0.1, y: lib.ridgeY + 0.42, ry: 0 }, { x: lib.Cc, z: lib.R0 + 0.1, y: lib.ridgeY + 0.42, ry: Math.PI })
  }
  for (const e of ridgeEnds) {
    // la queue se recourbe vers l'extérieur du faîtage
    P.geo(tail.clone(), m.gold, [e.x, e.y, e.z], [0, e.ry - Math.PI / 2, 0], 1.1, shadows)
  }
  tail.dispose()
}

/** Porche à fronton courbe (karahafu) au-dessus de la grande porte. */
function buildKarahafu(b: StaticBuilder, shadows: boolean) {
  const m = M()
  const hw = 4.0
  const z0 = -0.15
  const z1 = 6.25
  const yEnd = 4.35
  const yTop = 6.15
  const N = 32
  const curve = (x: number) => {
    const t = Math.min(1, Math.abs(x) / hw)
    return yEnd + (yTop - yEnd) * Math.pow(Math.cos((Math.PI / 2) * t), 1.25) + 0.28 * Math.pow(t, 12)
  }
  const strip = (yOff: number, mat: THREE.Material, flip: boolean, uvScale = 1) => {
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    for (let i = 0; i <= N; i++) {
      const x = -hw - 0.25 + ((2 * hw + 0.5) * i) / N
      const y = curve(x) + yOff
      pos.push(x, y, z0, x, y, z1)
      uv.push(x * uvScale, 0, x * uvScale, (z1 - z0) * uvScale)
      if (i < N) {
        const a = i * 2
        if (flip) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
        else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    b.add(g, mat, undefined, { cast: shadows })
  }
  strip(0, m.roof, false)
  strip(-0.2, m.roofUnder, true)
  // bandeau courbe épais (hafu) en façade
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= N; i++) {
    const x = -hw - 0.25 + ((2 * hw + 0.5) * i) / N
    const y = curve(x)
    pos.push(x, y + 0.06, z1 + 0.02, x, y - 0.52, z1 + 0.02)
    if (i < N) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const fascia = new THREE.BufferGeometry()
  fascia.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  fascia.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((N + 1) * 4), 2))
  fascia.setIndex(idx)
  fascia.computeVertexNormals()
  b.add(fascia, m.woodBlack, undefined, { cast: shadows })
  // ornement doré (gegyo) au sommet de la courbe et emblème
  const P = new Placer(b)
  P.geo(new THREE.CircleGeometry(0.5, 32), m.woodBlack, [0, yTop - 0.95, z1 + 0.04])
  P.geo(new THREE.PlaneGeometry(0.86, 0.86), goldEmblem(), [0, yTop - 0.95, z1 + 0.055])
  for (const s of [-1, 1]) P.box(m.gold, 0.5, 0.08, 0.06, [s * 0.75, yTop - 0.36, z1 + 0.05], [0, 0, s * 0.18])
  // poutre et consoles
  P.box(m.woodBlack, 2 * hw, 0.32, 0.26, [0, yEnd - 0.55, 4.85])
  for (const s of [-1, 1]) P.box(m.woodDark, 0.5, 0.3, 0.5, [s * 3.4, yEnd - 0.3, 4.85])
}

/** Panneaux de shoji éclairés sous le porche, de part et d'autre de la porte. */
function buildShojiWalls(b: StaticBuilder) {
  const m = M()
  const P = new Placer(b)
  for (const s of [-1, 1]) {
    const x0 = s * 2.75
    const x1 = s * 9.55
    const n = 7
    const w = Math.abs(x1 - x0) / n
    for (let i = 0; i < n; i++) {
      const cx = x0 + s * (i + 0.5) * w
      P.geo(new THREE.PlaneGeometry(w - 0.06, 2.35), m.shojiLit, [cx, 1.55, 0.17])
      P.box(m.woodBlack, 0.06, 2.45, 0.06, [cx - (w / 2) * s, 1.55, 0.19])
    }
    const mid = (x0 + x1) / 2
    P.box(m.woodBlack, Math.abs(x1 - x0) + 0.1, 0.1, 0.1, [mid, 2.78, 0.2])
    P.box(m.woodBlack, Math.abs(x1 - x0) + 0.1, 0.14, 0.12, [mid, 0.32, 0.2])
    P.box(m.woodDark, Math.abs(x1 - x0) + 0.1, 0.3, 0.1, [mid, 0.15, 0.2])
  }
}

export function Crown() {
  const shadows = QUALITY[useSettings((s) => s.quality)].shadows
  const parts = useMemo(() => {
    const b = new StaticBuilder({ cast: false, receive: true })
    buildCrown(b, shadows)
    buildKarahafu(b, shadows)
    buildShojiWalls(b)
    return b.build()
  }, [shadows])
  return <StaticMeshes parts={parts} />
}
