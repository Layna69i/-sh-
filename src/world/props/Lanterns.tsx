/**
 * Sources lumineuses du domaine : chōchin (lanternes de papier suspendues),
 * andon (lanternes de sol), bougies, tōrō (lanternes de pierre) et halos.
 * Chaque source déclare un « point d'éclairage » pour le pool de lumières.
 */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { M } from '../assets'
import { latheGeo, makeInstanced } from '../geo'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { setLightAnchors, anchor } from '../lights'
import type { ZoneId } from '../layout'
import { makeCanvas, ctx2d } from '../../textures/util'

type V3 = [number, number, number]
export interface LanternItem {
  p: V3
  s?: number
  ry?: number
}

function useAnchors(id: string, zone: ZoneId, items: LanternItem[], yOff: number, intensity: number, distance: number, flicker = 0.12) {
  useEffect(
    () => setLightAnchors(id, items.map((it) => anchor(zone, it.p[0], it.p[1] + yOff * (it.s ?? 1), it.p[2], intensity * (it.s ?? 1), 0xffa458, distance, flicker))),
    [id, zone, items, yOff, intensity, distance, flicker],
  )
}

const merge = (geos: THREE.BufferGeometry[]) => {
  const list = geos.map((g) => {
    const n = g.index ? g.toNonIndexed() : g
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k)
    return n
  })
  return mergeGeometries(list, false)!
}

/* ------------------------------ halos ------------------------------ */
let haloTex: THREE.Texture | null = null
function getHaloTex() {
  if (haloTex) return haloTex
  const c = makeCanvas(128)
  const ctx = ctx2d(c)
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,176,96,1)')
  g.addColorStop(0.2, 'rgba(255,150,70,0.42)')
  g.addColorStop(0.55, 'rgba(255,140,60,0.1)')
  g.addColorStop(1, 'rgba(255,120,40,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  haloTex = new THREE.CanvasTexture(c)
  haloTex.colorSpace = THREE.SRGBColorSpace
  return haloTex
}

export function Halos({ points, size = 1.6, opacity = 0.5 }: { points: V3[]; size?: number; opacity?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3))
    return g
  }, [points])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial map={getHaloTex()} size={size} sizeAttenuation transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}

/* ------------------------------ chōchin ------------------------------ */
function chochinGeos() {
  const prof: [number, number][] = []
  for (let i = 0; i <= 14; i++) {
    const t = i / 14
    prof.push([0.06 + 0.17 * Math.pow(Math.sin(Math.PI * t), 0.75), -0.32 + t * 0.64])
  }
  const paper = latheGeo(prof, 18)
  const uv = paper.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i))
  const capT = new THREE.CylinderGeometry(0.075, 0.08, 0.06, 14)
  capT.translate(0, 0.34, 0)
  const capB = new THREE.CylinderGeometry(0.08, 0.075, 0.06, 14)
  capB.translate(0, -0.34, 0)
  const cord = new THREE.CylinderGeometry(0.006, 0.006, 0.5, 4)
  cord.translate(0, 0.6, 0)
  const tassel = new THREE.ConeGeometry(0.03, 0.14, 6)
  tassel.translate(0, -0.44, 0)
  return { paper, caps: merge([capT, capB, cord, tassel]) }
}

export function Chochin({ id, zone, items, intensity = 7, distance = 9, halo = true }: { id: string; zone: ZoneId; items: LanternItem[]; intensity?: number; distance?: number; halo?: boolean }) {
  const meshes = useMemo(() => {
    const g = chochinGeos()
    const xf = items.map((it) => ({ p: it.p, r: [0, it.ry ?? 0, 0] as V3, s: it.s ?? 1 }))
    return [makeInstanced(g.paper, M().lanternPaper, xf), makeInstanced(g.caps, M().woodBlack, xf)]
  }, [items])
  useAnchors(id, zone, items, 0, intensity, distance)
  useEffect(() => () => meshes.forEach((m) => (m.geometry.dispose(), m.dispose())), [meshes])
  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      {halo && <Halos points={items.map((i) => i.p)} size={2.2} opacity={0.26} />}
    </group>
  )
}

/* ------------------------------ andon ------------------------------ */
function andonGeos() {
  const w = 0.34
  const h = 0.62
  const frame: THREE.BufferGeometry[] = []
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const p = new THREE.BoxGeometry(0.035, h + 0.18, 0.035)
      p.translate((sx * w) / 2, (h + 0.18) / 2, (sz * w) / 2)
      frame.push(p)
    }
  for (const y of [0.16, 0.16 + h]) {
    for (const r of [0, Math.PI / 2]) {
      for (const s of [-1, 1]) {
        const b = new THREE.BoxGeometry(w + 0.04, 0.03, 0.03)
        b.translate(0, y, (s * w) / 2)
        b.rotateY(r)
        frame.push(b)
      }
    }
  }
  const base = new THREE.BoxGeometry(w + 0.08, 0.05, w + 0.08)
  base.translate(0, 0.025, 0)
  frame.push(base)
  const paper: THREE.BufferGeometry[] = []
  for (let i = 0; i < 4; i++) {
    const p = new THREE.PlaneGeometry(w - 0.01, h)
    p.translate(0, 0.16 + h / 2, w / 2 - 0.01)
    p.rotateY((i * Math.PI) / 2)
    paper.push(p)
  }
  return { frame: merge(frame), paper: merge(paper) }
}

export function Andons({ id, zone, items, intensity = 3, distance = 7 }: { id: string; zone: ZoneId; items: LanternItem[]; intensity?: number; distance?: number }) {
  const meshes = useMemo(() => {
    const g = andonGeos()
    const xf = items.map((it) => ({ p: it.p, r: [0, it.ry ?? 0, 0] as V3, s: it.s ?? 1 }))
    const f = makeInstanced(g.frame, M().woodBlack, xf)
    f.castShadow = true
    return [f, makeInstanced(g.paper, M().andon, xf)]
  }, [items])
  useAnchors(id, zone, items, 1.05, intensity, distance, 0.08)
  useEffect(() => () => meshes.forEach((m) => (m.geometry.dispose(), m.dispose())), [meshes])
  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <Halos points={items.map((i) => [i.p[0], i.p[1] + 0.5 * (i.s ?? 1), i.p[2]] as V3)} size={1.5} opacity={0.4} />
    </group>
  )
}

/* ------------------------------ bougies ------------------------------ */
export function Candles({ id, zone, items, intensity = 1.6, distance = 4, light = true }: { id: string; zone: ZoneId; items: LanternItem[]; intensity?: number; distance?: number; light?: boolean }) {
  const { wax, flame, holder } = useMemo(() => {
    const w = new THREE.CylinderGeometry(0.022, 0.024, 0.16, 10)
    w.translate(0, 0.1, 0)
    const f = new THREE.ConeGeometry(0.012, 0.05, 8)
    f.translate(0, 0.025, 0)
    const h = latheGeo([[0, 0], [0.05, 0], [0.05, 0.012], [0.02, 0.02], [0.025, 0.03], [0.03, 0.03]], 10)
    const xf = items.map((it) => ({ p: it.p, s: it.s ?? 1 }))
    return {
      wax: makeInstanced(w, M().wax, xf),
      holder: makeInstanced(h, M().bronze, xf),
      flame: makeInstanced(
        f,
        M().flame,
        items.map((it) => ({ p: [it.p[0], it.p[1] + 0.18 * (it.s ?? 1), it.p[2]] as V3, s: it.s ?? 1 })),
      ),
    }
  }, [items])
  useEffect(() => {
    if (!light) return
    return setLightAnchors(id, items.map((it) => anchor(zone, it.p[0], it.p[1] + 0.3, it.p[2], intensity, 0xff9a48, distance, 0.25)))
  }, [id, zone, items, intensity, distance, light])
  useEffect(() => () => [wax, flame, holder].forEach((m) => (m.geometry.dispose(), m.dispose())), [wax, flame, holder])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const seeds = useMemo(() => items.map(() => Math.random() * 100), [items])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    items.forEach((it, i) => {
      const k = it.s ?? 1
      const f = 1 + 0.18 * Math.sin(t * 13 + seeds[i]) * Math.sin(t * 7.3 + seeds[i] * 2)
      m4.makeScale(k * (1 - (f - 1) * 0.5), k * f, k * (1 - (f - 1) * 0.5))
      m4.setPosition(it.p[0] + Math.sin(t * 5 + seeds[i]) * 0.002, it.p[1] + 0.18 * k, it.p[2])
      flame.setMatrixAt(i, m4)
    })
    flame.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <primitive object={wax} />
      <primitive object={holder} />
      <primitive object={flame} />
      <Halos points={items.map((it) => [it.p[0], it.p[1] + 0.2 * (it.s ?? 1), it.p[2]] as V3)} size={0.5} opacity={0.6} />
    </group>
  )
}

/* ------------------------------ tōrō ------------------------------ */
/** Papier du foyer : diffus sombre (la lumière toute proche du foyer ne le blanchit pas), éclat ambré porté par l'émissif. */
let toroPaperMat: THREE.MeshStandardMaterial | null = null
function toroPaper() {
  if (!toroPaperMat) {
    const a = M().andon
    toroPaperMat = new THREE.MeshStandardMaterial({ color: 0x4a4036, map: a.map, emissive: 0xff9c48, emissiveMap: a.emissiveMap, emissiveIntensity: 1.3, roughness: 0.9, side: THREE.DoubleSide })
  }
  return toroPaperMat
}

/**
 * Révolution à section hexagonale (ou ronde) : profil [rayon, hauteur], UV en mètres.
 * `hex` donne des faces planes à arêtes vives ; `lift` relève les coins du dernier
 * point du profil (bords de toit retroussés, warabite).
 */
function hexLathe(profile: [number, number][], opts: { hex?: boolean; seg?: number; lift?: number; liftFrom?: number; flip?: boolean } = {}) {
  const seg = opts.seg ?? (opts.hex ? 36 : 20)
  const pos: number[] = []
  const uv: number[] = []
  const lens = [0]
  for (let i = 1; i < profile.length; i++) lens.push(lens[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]))
  const pt = (i: number, k: number) => {
    const th = (k / seg) * Math.PI * 2
    let rr = profile[i][0]
    let y = profile[i][1]
    if (opts.hex) {
      // rayon d'un hexagone régulier (sommets aux multiples de 60°)
      const m = ((th % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)
      rr *= Math.cos(Math.PI / 6) / Math.cos(m - Math.PI / 6)
      if (opts.lift && i >= (opts.liftFrom ?? profile.length - 1)) {
        const corner = 1 - Math.abs(m - Math.PI / 6) / (Math.PI / 6) // 1 au coin
        y += opts.lift * Math.pow(corner, 4)
      }
    }
    return [Math.cos(th) * rr, y, Math.sin(th) * rr, (k / seg) * Math.PI * 2 * Math.max(0.05, profile[i][0]), lens[i]] as const
  }
  for (let i = 0; i < profile.length - 1; i++)
    for (let k = 0; k < seg; k++) {
      const a = pt(i, k), b = pt(i, k + 1), c = pt(i + 1, k), d = pt(i + 1, k + 1)
      // un profil parcouru de haut en bas (toit) inverse l'enroulement : `flip` le rétablit
      for (const q of opts.flip ? [a, b, c, b, d, c] : [a, c, b, b, c, d]) {
        pos.push(q[0], q[1], q[2])
        uv.push(q[3], q[4])
      }
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}

/** Lanterne kasuga-dōrō : socle, fût bagué, plateau en lotus, foyer ajouré, toit à coins relevés, hōju. */
function toroGeos() {
  const stone: THREE.BufferGeometry[] = []
  // kiso : socle hexagonal à deux gradins et doucine
  stone.push(hexLathe([[0, 0], [0.38, 0], [0.4, 0.05], [0.4, 0.13], [0.34, 0.16], [0.3, 0.2], [0.27, 0.27], [0.15, 0.3], [0, 0.3]], { hex: true }))
  // sao : fût rond avec bague centrale (fushi) et léger galbe
  stone.push(
    hexLathe(
      [[0.125, 0.29], [0.118, 0.55], [0.112, 0.69], [0.13, 0.71], [0.136, 0.75], [0.13, 0.79], [0.112, 0.81], [0.108, 0.98], [0.112, 1.18], [0.13, 1.2]],
      { seg: 20 },
    ),
  )
  // chūdai : plateau évasé en pétales de lotus
  {
    const lotus: [number, number][] = []
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      lotus.push([0.14 + 0.2 * Math.pow(t, 0.7) + 0.015 * Math.sin(t * Math.PI * 4), 1.19 + t * 0.15])
    }
    lotus.push([0.34, 1.37], [0.3, 1.38], [0.27, 1.41], [0, 1.41])
    stone.push(hexLathe(lotus, { hex: true }))
  }
  // hibukuro : six montants, linteaux haut et bas
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const p = new THREE.BoxGeometry(0.055, 0.34, 0.055)
    p.rotateY(-a)
    p.translate(Math.cos(a) * 0.235, 1.58, Math.sin(a) * 0.235)
    stone.push(p.toNonIndexed())
  }
  stone.push(hexLathe([[0.27, 1.405], [0.27, 1.45], [0.23, 1.46], [0, 1.46]], { hex: true }))
  stone.push(hexLathe([[0, 1.73], [0.26, 1.73], [0.28, 1.76], [0.28, 1.79], [0, 1.79]], { hex: true }))
  // kasa : toit hexagonal concave, coins relevés, faîte
  stone.push(
    hexLathe(
      [[0.09, 2.08], [0.16, 2.02], [0.27, 1.95], [0.4, 1.88], [0.5, 1.84], [0.56, 1.82], [0.585, 1.84], [0.58, 1.8], [0.5, 1.785], [0.3, 1.79], [0, 1.79]],
      { hex: true, lift: 0.08, liftFrom: 5, flip: true },
    ),
  )
  // hōju : joyau en bouton de lotus sur une collerette
  stone.push(hexLathe([[0, 2.06], [0.1, 2.06], [0.11, 2.1], [0.07, 2.13], [0.085, 2.16], [0.09, 2.21], [0.07, 2.27], [0.035, 2.31], [0, 2.33]], { seg: 16 }))
  const s = merge(stone)
  // papier translucide sur les six faces du foyer, lueur intérieure (petite flamme)
  const paper: THREE.BufferGeometry[] = []
  for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) / 6) * Math.PI * 2
    const w = 2 * 0.235 * Math.sin(Math.PI / 6) - 0.05
    const p = new THREE.PlaneGeometry(w, 0.26)
    p.rotateY(-a + Math.PI / 2)
    const r = 0.235 * Math.cos(Math.PI / 6) - 0.012
    p.translate(Math.cos(a) * r, 1.595, Math.sin(a) * r)
    paper.push(p)
  }
  const glow = new THREE.SphereGeometry(0.05, 10, 8)
  glow.scale(1, 1.6, 1)
  glow.translate(0, 1.56, 0)
  return { stone: s, paper: merge(paper), glow }
}

export function StoneLanterns({ id, zone, items, intensity = 4, distance = 8 }: { id: string; zone: ZoneId; items: LanternItem[]; intensity?: number; distance?: number }) {
  const meshes = useMemo(() => {
    const g = toroGeos()
    const xf = items.map((it) => ({ p: it.p, r: [0, it.ry ?? 0, 0] as V3, s: it.s ?? 1 }))
    const s = makeInstanced(g.stone, M().stone, xf)
    s.castShadow = true
    s.receiveShadow = true
    return [s, makeInstanced(g.paper, toroPaper(), xf), makeInstanced(g.glow, M().flame, xf)]
  }, [items])
  useAnchors(id, zone, items, 1.6, intensity, distance, 0.15)
  useEffect(() => () => meshes.forEach((m) => (m.geometry.dispose(), m.dispose())), [meshes])
  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <Halos points={items.map((it) => [it.p[0], it.p[1] + 1.6 * (it.s ?? 1), it.p[2]] as V3)} size={1.8} opacity={0.5} />
    </group>
  )
}

/* ------------------------------ braise animée ------------------------------ */
export function useFlicker(material: THREE.MeshBasicMaterial | null, base: THREE.Color) {
  const seed = useRef(Math.random() * 10)
  useFrame((s) => {
    if (!material) return
    const t = s.clock.elapsedTime
    const f = 0.85 + 0.15 * Math.sin(t * 8 + seed.current) * Math.sin(t * 3.1)
    material.color.copy(base).multiplyScalar(f)
  })
}
