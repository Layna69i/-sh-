/**
 * Abords de l'école : soubassement de pierres (ishigaki), terrasse (engawa)
 * et auvent, escalier, rideau à l'emblème du porche, torii, lanternes de pierre, nobori,
 * tours de guet. Le bassin et la cascade sont dans Waterfall.tsx.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { M, T, bannerMat, makuMat, cachedMaterial, dynamicTexture } from '../assets'
import { StaticBuilder, bendY, boxGeo } from '../geo'
import { useStatic, StaticMeshes } from '../Static'
import { OUTLINE, TERRACE, STAIRS, FOREST_Y, pathX, terrainHeight } from '../layout'
import { Placer, railing } from '../props/furniture'
import { Chochin, StoneLanterns, type LanternItem } from '../props/Lanterns'
import { buildRoof } from '../building/roof'
import { applyCloth } from '../wind'
import { setColliders, removeColliders, setCircles } from '../../player/collision'
import { makeCanvas, ctx2d, JP_FONT } from '../../textures/util'
import { useSettings, QUALITY } from '../../store/settings'

/* --------------------------- soubassement --------------------------- */
function addBase(b: StaticBuilder) {
  const m = M()
  const bottom = FOREST_Y - 0.8
  for (const o of OUTLINE) {
    const segs: [number, number][] = []
    if (o.axis === 'x' && o.at === TERRACE.z1) {
      segs.push([o.a, STAIRS.x0], [STAIRS.x1, o.b])
    } else segs.push([o.a, o.b])
    for (const [a0, b0] of segs) {
      const a = a0 - 0.55
      const bb = b0 + 0.55
      const len = bb - a
      // face légèrement fruitée (inclinée) : haut à 0,2 m, bas à 0,75 m du nu du mur
      const topOff = 0.2
      const botOff = 0.75
      const g = new THREE.BufferGeometry()
      const s = o.outward
      const P = (u: number, y: number, off: number): [number, number, number] =>
        o.axis === 'x' ? [u, y, o.at + s * off] : [o.at + s * off, y, u]
      const v = [P(a, -0.05, topOff), P(bb, -0.05, topOff), P(a, bottom, botOff), P(bb, bottom, botOff)]
      g.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, len, 0, 0, bottom, len, bottom].map((x, i) => (i % 2 ? x : x + a)), 2))
      // orientation : normale vers l'extérieur
      const flip = (o.axis === 'x' && s > 0) || (o.axis === 'z' && s < 0)
      g.setIndex(flip ? [0, 2, 1, 1, 2, 3] : [0, 1, 2, 1, 3, 2])
      g.computeVertexNormals()
      b.add(g, m.stoneBlocks, undefined, { cast: true })
      // chaperon de pierre
      const mid = (a0 + b0) / 2
      const cl = b0 - a0 + 0.5
      if (o.axis === 'x') b.box(m.stoneDark, cl, 0.14, 0.42, [mid, -0.05, o.at + s * 0.32])
      else b.box(m.stoneDark, 0.42, 0.14, cl, [o.at + s * 0.32, -0.05, mid])
    }
  }
}

/* --------------------------- terrasse & escalier --------------------------- */
function addTerrace(b: StaticBuilder) {
  const m = M()
  const T0 = TERRACE
  const w = T0.x1 - T0.x0
  const d = T0.z1 - T0.z0
  const deck = new THREE.PlaneGeometry(w, d)
  deck.rotateX(-Math.PI / 2)
  deck.translate((T0.x0 + T0.x1) / 2, 0.005, (T0.z0 + T0.z1) / 2)
  const uv = deck.attributes.uv as THREE.BufferAttribute
  const pos = deck.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, -pos.getZ(i), pos.getX(i))
  b.add(deck, m.planks)
  const P = new Placer(b)
  // garde-corps
  railing(P.at((T0.x0 + STAIRS.x0) / 2, 0, T0.z1 - 0.1), STAIRS.x0 - T0.x0, 0.85)
  railing(P.at((STAIRS.x1 + T0.x1) / 2, 0, T0.z1 - 0.1), T0.x1 - STAIRS.x1, 0.85)
  railing(P.at(T0.x0 + 0.1, 0, (T0.z0 + T0.z1) / 2, Math.PI / 2), d - 0.2, 0.85)
  railing(P.at(T0.x1 - 0.1, 0, (T0.z0 + T0.z1) / 2, Math.PI / 2), d - 0.2, 0.85)
  // giboshi (pommeaux de bronze) aux extrémités de l'escalier
  for (const x of [STAIRS.x0 - 0.05, STAIRS.x1 + 0.05]) {
    P.box(m.woodDark, 0.16, 1.05, 0.16, [x, 0.52, T0.z1 - 0.1])
    P.geo(new THREE.SphereGeometry(0.1, 10, 8), m.bronze, [x, 1.12, T0.z1 - 0.1])
  }
  // escalier de pierre
  const steps = 12
  const run = (STAIRS.z1 - STAIRS.z0) / steps
  const rise = -FOREST_Y / steps
  for (let i = 0; i < steps; i++) {
    const top = -i * rise
    const z = STAIRS.z0 + (i + 0.5) * run
    b.box(m.stone, STAIRS.x1 - STAIRS.x0, rise + 0.02, run + 0.04, [(STAIRS.x0 + STAIRS.x1) / 2, top - rise / 2, z])
    b.box(m.stoneDark, STAIRS.x1 - STAIRS.x0, 0.04, 0.06, [(STAIRS.x0 + STAIRS.x1) / 2, top - 0.02, z - run / 2 + 0.03])
  }
  // remplissage sous les marches
  for (let i = 0; i < steps; i++) {
    const top = -i * rise
    const z = STAIRS.z0 + (i + 0.5) * run
    const h = top - FOREST_Y
    b.box(m.stoneBlocks, STAIRS.x1 - STAIRS.x0, h, run, [(STAIRS.x0 + STAIRS.x1) / 2, FOREST_Y + h / 2 - rise, z])
  }
  // murets latéraux
  for (const x of [STAIRS.x0 - 0.18, STAIRS.x1 + 0.18]) {
    for (let i = 0; i < steps; i++) {
      const top = -i * rise + 0.6
      const z = STAIRS.z0 + (i + 0.5) * run
      b.box(m.stoneBlocks, 0.36, top - FOREST_Y, run + 0.01, [x, (top + FOREST_Y) / 2, z], undefined, { cast: true })
      b.box(m.stoneDark, 0.42, 0.08, run + 0.02, [x, top + 0.04, z])
    }
  }
}

/* --------------------------- auvent de façade --------------------------- */
function addPorch(b: StaticBuilder, shadows: boolean) {
  const m = M()
  const zFront = 5.5
  const yBack = 4.85
  const yFront = 3.75
  const len = Math.hypot(zFront, yBack - yFront)
  const ang = Math.atan2(yBack - yFront, zFront)
  // auvent en appentis de part et d'autre du porche central (karahafu, voir Crown)
  for (const [x0, x1] of [
    [-10.2, -3.95],
    [3.95, 10.2],
  ]) {
    const w = x1 - x0
    const cx = (x0 + x1) / 2
    b.add(boxGeo(w, 0.08, len), m.roof, { p: [cx, (yBack + yFront) / 2 + 0.06, zFront / 2], r: [ang, 0, 0] }, { cast: shadows })
    b.add(boxGeo(w, 0.06, len), m.roofUnder, { p: [cx, (yBack + yFront) / 2 - 0.04, zFront / 2], r: [ang, 0, 0] })
    b.box(m.woodDark, w + 0.1, 0.22, 0.14, [cx, yFront - 0.05, zFront - 0.02])
    b.box(m.woodBlack, w, 0.3, 0.2, [cx, yFront - 0.4, 4.85])
  }
  for (const x of [-9.8, -6.2, -3.4, 3.4, 6.2, 9.8]) {
    b.box(m.woodDark, 0.24, yFront - 0.4, 0.24, [x, (yFront - 0.4) / 2, 4.85], undefined, { cast: shadows })
    b.box(m.stoneDark, 0.36, 0.1, 0.36, [x, 0.05, 4.85])
  }
  // poteaux plus hauts du porche central
  for (const x of [-3.4, 3.4]) b.box(m.woodBlack, 0.3, 4.1, 0.3, [x, 2.05, 4.85], undefined, { cast: shadows })
}

/* --------------------------- torii --------------------------- */
function plaqueMaterial() {
  return cachedMaterial('torii-plaque', () => {
    const tex = dynamicTexture('torii-plaque', () => {
      const c = makeCanvas(256, 384)
      const ctx = ctx2d(c)
      ctx.fillStyle = '#14100e'
      ctx.fillRect(0, 0, 256, 384)
      ctx.strokeStyle = '#a8844a'
      ctx.lineWidth = 10
      ctx.strokeRect(10, 10, 236, 364)
      ctx.fillStyle = '#c9a25c'
      ctx.font = `800 140px ${JP_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('王', 128, 120)
      ctx.fillText('将', 128, 270)
      return c
    })
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.2 })
  })
}

function addTorii(b: StaticBuilder, x: number, z: number) {
  const m = M()
  const y = terrainHeight(x, z) - 0.1
  const P = new Placer(b, x, y, z)
  const span = 2.75
  for (const s of [-1, 1]) {
    P.cyl(m.vermilion, 0.26, 0.31, 6.1, 14, [s * span, 3.05, 0], [0, 0, s * 0.025], true)
    P.cyl(m.woodBlack, 0.36, 0.38, 0.55, 14, [s * span, 0.27, 0])
    P.cyl(m.woodBlack, 0.3, 0.3, 0.12, 14, [s * span * 0.985, 4.55, 0], [0, 0, s * 0.025])
  }
  P.box(m.vermilion, 7.1, 0.34, 0.24, [0, 4.5, 0], [0, 0, 0], true)
  P.box(m.vermilion, 0.3, 0.9, 0.22, [0, 5.15, 0])
  P.box(m.woodBlack, 0.7, 1.05, 0.1, [0, 5.15, 0.14])
  const plaque = new THREE.PlaneGeometry(0.58, 0.92)
  P.geo(plaque, plaqueMaterial(), [0, 5.15, 0.195])
  const shimaki = boxGeo(7.6, 0.3, 0.36)
  bendY(shimaki, 0.006, 2)
  P.geo(shimaki, m.vermilion, [0, 5.75, 0], [0, 0, 0], 1, true)
  const kasagi = boxGeo(8.9, 0.34, 0.48)
  bendY(kasagi, 0.012, 2.2)
  P.geo(kasagi, m.woodBlack, [0, 6.12, 0], [0, 0, 0], 1, true)
  return [
    { x: x - span, z, r: 0.42 },
    { x: x + span, z, r: 0.42 },
  ]
}

/* --------------------------- tours de guet --------------------------- */
function addTower(b: StaticBuilder, x: number, z: number, shadows: boolean) {
  const m = M()
  const P = new Placer(b, x, 0, z)
  const W = 5.6
  // socle de pierre
  for (const [sx, sz, rot] of [
    [0, W / 2 + 0.4, 0],
    [0, -W / 2 - 0.4, Math.PI],
    [W / 2 + 0.4, 0, Math.PI / 2],
    [-W / 2 - 0.4, 0, -Math.PI / 2],
  ] as const) {
    const g = new THREE.PlaneGeometry(W + 0.8, 2 - FOREST_Y + 0.8)
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (W + 0.8), uv.getY(i) * 3.5)
    P.geo(g, m.stoneBlocks, [sx, (FOREST_Y - 0.8 + 2) / 2, sz], [0, rot, 0], 1, shadows)
  }
  P.box(m.stoneDark, W + 1, 0.15, W + 1, [0, 2.05, 0])
  // étage 1
  const h1 = 3.6
  P.box(m.plasterExt, W, h1, W, [0, 2 + h1 / 2, 0], [0, 0, 0], shadows)
  for (const s of [-1, 1]) {
    for (const rot of [0, Math.PI / 2]) {
      const Q = P.at(0, 0, 0, rot)
      Q.box(m.woodDark, W + 0.06, 0.14, 0.06, [0, 2 + 1.1, (s * W) / 2])
      Q.box(m.woodDark, W + 0.06, 0.2, 0.06, [0, 2 + h1 - 0.1, (s * W) / 2])
      for (let i = 0; i <= 3; i++) Q.box(m.woodDark, 0.2, h1, 0.07, [-W / 2 + 0.1 + (i * (W - 0.2)) / 3, 2 + h1 / 2, (s * W) / 2])
      for (const wx of [-1.1, 1.1]) {
        const g = new THREE.PlaneGeometry(1.1, 0.9)
        Q.geo(g, m.window, [wx, 2 + 2.3, (s * W) / 2 + s * 0.02], [0, s > 0 ? 0 : Math.PI, 0])
      }
    }
  }
  const r1 = buildRoof({ x0: x - W / 2, x1: x + W / 2, z0: z - W / 2, z1: z + W / 2, wallTop: 2 + h1, overhang: { n: 1.2, s: 1.2, e: 1.2, w: 1.2 }, pitch: 0.55 })
  r1.top.forEach((g) => b.add(g, m.roof, undefined, { cast: shadows }))
  b.add(r1.under, m.roofUnder)
  b.add(r1.fascia, m.woodDark)
  // étage 2
  const W2 = 3.8
  const y2 = 2 + h1 + 1.0
  const h2 = 2.8
  P.box(m.plasterExt, W2, h2 + 1, W2, [0, y2 + (h2 - 1) / 2, 0], [0, 0, 0], shadows)
  for (const rot of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const Q = P.at(0, 0, 0, rot)
    const g = new THREE.PlaneGeometry(2.4, 1.1)
    Q.geo(g, m.window, [0, y2 + 1.3, W2 / 2 + 0.02])
    for (let k = 1; k < 8; k++) Q.box(m.woodBlack, 0.04, 1.1, 0.04, [-1.2 + (k * 2.4) / 8, y2 + 1.3, W2 / 2 + 0.05])
    Q.box(m.woodDark, W2 + 0.08, 0.16, 0.08, [0, y2 + h2 - 0.1, W2 / 2])
    for (const sx of [-1, 1]) Q.box(m.woodDark, 0.18, h2 + 1, 0.08, [(sx * W2) / 2, y2 + (h2 - 1) / 2, W2 / 2])
    // balcon
    railing(Q.at(0, y2 - 0.2, W2 / 2 + 0.6), W2 + 1.2, 0.75, m.woodDark, 1.4)
  }
  P.box(m.planks, W2 + 1.4, 0.12, W2 + 1.4, [0, y2 - 0.25, 0])
  const r2 = buildRoof({ x0: x - W2 / 2, x1: x + W2 / 2, z0: z - W2 / 2, z1: z + W2 / 2, wallTop: y2 + h2, overhang: { n: 1.3, s: 1.3, e: 1.3, w: 1.3 }, pitch: 0.7, lift: 0.55 })
  r2.top.forEach((g) => b.add(g, m.roof, undefined, { cast: shadows }))
  b.add(r2.under, m.roofUnder)
  b.add(r2.fascia, m.woodDark)
  b.add(r2.ridges, m.stoneDark)
}

/* --------------------------- bannières (nobori) --------------------------- */
function Nobori({ x, z, flip = false }: { x: number; z: number; flip?: boolean }) {
  const y = terrainHeight(x, z) - 0.1
  const mat = useMemo(() => {
    const base = bannerMat('nobori-emblem', { emblem: true, kanji: '影', sub: 'ŌSHŌ' }, undefined, undefined, 0.95 / 4.0)
    const m = base.clone()
    applyCloth(m, 0.14, 1.2)
    return m
  }, [])
  return (
    <group position={[x, y, z]}>
      <mesh castShadow material={M().woodBlack} position={[0, 3.3, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 6.6, 8]} />
      </mesh>
      <mesh material={M().woodBlack} position={[flip ? -0.5 : 0.5, 6.35, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 1.05, 6]} />
      </mesh>
      <mesh material={mat} position={[flip ? -0.5 : 0.5, 4.3, 0.02]} castShadow>
        <planeGeometry args={[0.95, 4.0, 6, 16]} />
      </mesh>
    </group>
  )
}

/** Rideau à l'emblème (mizuhiki-maku) tendu sous la poutre du karahafu, entre les lanternes des
 *  poteaux : seul emplacement de la façade visible depuis l'allée sans masquer la porte. */
const MAKU = { w: 6.0, h: 0.85, top: 3.92, z: 5.05 }
function PorchCurtain() {
  const mat = useMemo(() => {
    // violet profond des rideaux de temple : se détache du dessous noir de l'auvent
    const m = makuMat('porch', 2, MAKU.w / MAKU.h, '#3d2649', '#e6dcc4').clone()
    applyCloth(m, 0.03, 0.8)
    return m
  }, [])
  const geo = useMemo(() => {
    // plis réguliers du tissu froncé sur la tringle
    const g = new THREE.PlaneGeometry(MAKU.w, MAKU.h, 120, 3)
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) pos.setZ(i, 0.03 * Math.sin((pos.getX(i) / 0.25) * Math.PI))
    g.computeVertexNormals()
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <group position={[0, MAKU.top, MAKU.z]}>
      <mesh material={mat} geometry={geo} position={[0, -MAKU.h / 2, 0]} />
      {/* cordon de suspension */}
      <mesh material={M().woodBlack} position={[0, 0.01, 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, MAKU.w + 0.1, 6]} />
      </mesh>
    </group>
  )
}

/* --------------------------- eau --------------------------- */
export function waterMaterial(color = 0x0d1418, sky = 0x5a3550) {
  return cachedMaterial(`water-${color}-${sky}`, () => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.05, normalMap: T().waterN, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.92 })
    mat.normalMap!.repeat.set(0.4, 0.4)
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 }
      shader.uniforms.uSky = { value: new THREE.Color(sky) }
      mat.userData.shader = shader
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSky;')
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
          float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
          gl_FragColor.rgb += uSky * fres * 0.25;`,
        )
    }
    return mat
  })
}

/* --------------------------- composant --------------------------- */
export function Domain() {
  const shadows = QUALITY[useSettings((s) => s.quality)].shadows
  const parts = useStatic(
    (b) => {
      addBase(b)
      addTerrace(b)
      addPorch(b, shadows)
      addTorii(b, pathX(30), 30)
      addTower(b, -24, -3.5, shadows)
      addTower(b, 26, -4.5, shadows)
    },
    [shadows],
  )

  useEffect(() => {
    setColliders('towers', [
      { x0: -27.6, x1: -20.4, z0: -7.1, z1: 0.1 },
      { x0: 22.4, x1: 29.6, z0: -8.1, z1: -0.9 },
    ])
    setCircles('torii', [
      { x: pathX(30) - 2.75, z: 30, r: 0.42 },
      { x: pathX(30) + 2.75, z: 30, r: 0.42 },
      ...pathLanterns.map((l) => ({ x: l.p[0], z: l.p[2], r: 0.42 })),
      { x: -4.4, z: 12.6, r: 0.12 },
      { x: 4.4, z: 12.6, r: 0.12 },
    ])
    return () => {
      removeColliders('towers')
      removeColliders('torii')
    }
  }, [])

  const facadeLanterns: LanternItem[] = useMemo(
    () => [
      ...[-9.8, -6.2, -3.4, 3.4, 6.2, 9.8].map((x) => ({ p: [x, 3.0, 4.85] as [number, number, number], s: 1.15 })),
      { p: [-2.6, 3.3, 0.55], s: 1.6 },
      { p: [2.6, 3.3, 0.55], s: 1.6 },
    ],
    [],
  )

  return (
    <group>
      <StaticMeshes parts={parts} />
      <PorchCurtain />
      {/* lanternes de papier : 17 à 23 cd, des flaques de lumière chaude sans brûler les shoji voisins */}
      <Chochin id="facade" zone="exterior" items={facadeLanterns} intensity={1.6} distance={9} />
      <StoneLanterns id="path-lanterns" zone="exterior" items={pathLanterns} intensity={12} distance={12} />
      <Nobori x={-4.4} z={12.6} flip />
      <Nobori x={4.4} z={12.6} />
    </group>
  )
}

export const pathLanterns: LanternItem[] = [14.5, 22, 37, 46, 56, 68, 82].flatMap((z) => [
  { p: [pathX(z) - 2.7, terrainHeight(pathX(z) - 2.7, z) - 0.05, z] as [number, number, number] },
  { p: [pathX(z) + 2.7, terrainHeight(pathX(z) + 2.7, z) - 0.05, z] as [number, number, number] },
])
