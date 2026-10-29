/**
 * Cascade du soubassement : l'eau sort d'une bouche de pierre ménagée dans
 * l'ishigaki, rebondit sur une corniche rocheuse puis tombe dans un bassin
 * bordé de pierres moussues. Nappes animées, écume, remous, gouttelettes et
 * son de chute dont le volume suit la distance de la caméra.
 */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { M, T, cachedMaterial, dynamicTexture } from '../assets'
import { useStatic, StaticMeshes } from '../Static'
import { Placer } from '../props/furniture'
import { rockGeo } from './Forest'
import { StoneLanterns, type LanternItem } from '../props/Lanterns'
import { waterMaterial } from './Domain'
import { CASCADE, FOREST_Y } from '../layout'
import { setColliders, setCircles, removeColliders } from '../../player/collision'
import { useGame } from '../../store/game'
import { audio } from '../../audio/engine'
import { makeCanvas, ctx2d } from '../../textures/util'
import { rng } from '../../core/math'

const X = CASCADE.x
const WATER_Y = FOREST_Y + 0.06
/** Bouche de pierre, corniche et points d'impact (le mur est en z = 5, l'eau coule vers +z). */
const LIP = { y: -0.5, z: 5.95 }
const LEDGE = { y: -1.44, z0: 6.32, z1: 7.12 }
const IMPACT_LEDGE: [number, number, number] = [X, LEDGE.y + 0.02, 6.34]
const IMPACT_POOL: [number, number, number] = [X, WATER_Y, 7.45]
/** Tōrō qui éclaire la chute depuis la berge est. */
const TORO: LanternItem[] = [{ p: [X + 3.55, FOREST_Y - 0.05, 6.9] }]

/* --------------------------- textures --------------------------- */
export function streakTexture() {
  return dynamicTexture(
    'cascade-streaks',
    () => {
      const W = 128
      const H = 512
      const c = makeCanvas(W, H)
      const ctx = ctx2d(c)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      const r = rng(77)
      for (let i = 0; i < 110; i++) {
        const x = r() * W
        const w = 1 + r() * 3.5
        const a = 0.18 + r() * 0.55
        // périodes entières : le motif se raccorde verticalement
        const k = 1 + Math.floor(r() * 4)
        const ph = r() * Math.PI * 2
        for (let y = 0; y < H; y += 4) {
          const v = a * (0.5 + 0.5 * Math.sin((y / H) * Math.PI * 2 * k + ph))
          ctx.fillStyle = `rgba(255,255,255,${v.toFixed(3)})`
          ctx.fillRect(x, y, w, 4)
        }
      }
      return c
    },
    true,
  )
}

function puffTexture() {
  return dynamicTexture('cascade-puff', () => {
    const c = makeCanvas(128)
    const ctx = ctx2d(c)
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.45, 'rgba(255,255,255,0.45)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    return c
  })
}

export function ringTexture() {
  return dynamicTexture('cascade-ring', () => {
    const c = makeCanvas(128)
    const ctx = ctx2d(c)
    const g = ctx.createRadialGradient(64, 64, 30, 64, 64, 62)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.7, 'rgba(255,255,255,0.8)')
    g.addColorStop(0.85, 'rgba(255,255,255,0.25)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    return c
  })
}

/* --------------------------- matériaux --------------------------- */
const fallMaterial = () =>
  cachedMaterial('cascade-fall', () => {
    const tex = streakTexture()
    return new THREE.MeshStandardMaterial({
      color: 0xd6e3e6,
      map: tex,
      alphaMap: tex,
      emissive: 0x8ea2a8,
      emissiveMap: tex,
      emissiveIntensity: 0.3,
      roughness: 0.2,
      metalness: 0,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
    })
  })

const ROCK_LOOK = { wet: [0x6f6b61, 0.42], moss: [0x5f6a52, 0.9], dry: [0x858073, 0.82] } as const
const rockMat = (look: keyof typeof ROCK_LOOK) =>
  cachedMaterial(`cascade-rock-${look}`, () =>
    new THREE.MeshStandardMaterial({ map: T().stone, normalMap: T().stoneN, color: ROCK_LOOK[look][0], roughness: ROCK_LOOK[look][1] }),
  )

const voidMat = () => cachedMaterial('cascade-void', () => new THREE.MeshStandardMaterial({ color: 0x0a0b0c, roughness: 1 }))

/* --------------------------- géométries d'eau --------------------------- */
/** Nappe en chute libre : avance linéaire, chute parabolique ; alpha par sommet (RGBA). */
function sheetGeo(o: { y0: number; z0: number; drop: number; reach: number; w0: number; w1: number; len: number }) {
  const segV = 18
  const segU = 4
  const pos: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= segV; j++) {
    const s = j / segV
    const w = THREE.MathUtils.lerp(o.w0, o.w1, s)
    const y = o.y0 - o.drop * s * s
    const z = o.z0 + o.reach * s
    const aV = Math.min(1, s / 0.1 + 0.2) * Math.min(1, (1 - s) / 0.12 + 0.3)
    for (let i = 0; i <= segU; i++) {
      const u = i / segU
      pos.push(X + (u - 0.5) * w, y, z + Math.sin(s * 9 + u * 5) * 0.015)
      uv.push(u, s * o.len)
      col.push(1, 1, 1, aV * Math.min(1, Math.min(u, 1 - u) / 0.2))
    }
  }
  for (let j = 0; j < segV; j++)
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i
      const c = a + segU + 1
      idx.push(a, c, a + 1, a + 1, c, c + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Lame d'eau horizontale (dessus de la bouche, corniche). */
function flowGeo(y: number, z0: number, z1: number, w: number) {
  return sheetGeo({ y0: y, z0, drop: 0, reach: z1 - z0, w0: w, w1: w, len: (z1 - z0) * 0.9 })
}

function poolShape() {
  const shape = new THREE.Shape()
  for (let i = 0; i <= 56; i++) {
    const a = (i / 56) * Math.PI * 2
    const w = 1 + 0.08 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 5)
    const x = Math.cos(a) * CASCADE.rx * w
    const y = Math.sin(a) * CASCADE.rz * w
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  const g = new THREE.ShapeGeometry(shape)
  g.rotateX(-Math.PI / 2)
  return g
}

/* --------------------------- pierres --------------------------- */
type RockDef = { p: [number, number, number]; s: [number, number, number]; seed: number; wet?: boolean; moss?: boolean; flip?: boolean }

const STACK: RockDef[] = [
  // corniche : pierre retournée pour offrir un dessus plat
  { p: [X, -1.86, 6.62], s: [1.2, 1.2, 0.62], seed: 101, wet: true, flip: true },
  { p: [X - 1.6, -1.75, 5.95], s: [0.65, 1.1, 0.6], seed: 102, wet: true },
  { p: [X + 1.65, -1.7, 6.0], s: [0.7, 1.15, 0.6], seed: 103, wet: true },
  { p: [X - 1.2, -0.95, 5.62], s: [0.45, 0.6, 0.4], seed: 104, moss: true },
  { p: [X + 1.25, -0.9, 5.62], s: [0.5, 0.55, 0.42], seed: 105, moss: true },
  { p: [X - 1.95, -2.3, 6.95], s: [0.8, 0.9, 0.7], seed: 106, moss: true },
  { p: [X + 2.05, -2.3, 7.05], s: [0.9, 0.8, 0.75], seed: 107 },
  { p: [X - 0.75, -2.38, 7.75], s: [0.3, 0.35, 0.3], seed: 108, wet: true },
  { p: [X + 0.95, -2.4, 8.1], s: [0.22, 0.3, 0.24], seed: 109, wet: true },
]

function rimRocks(): RockDef[] {
  const r = rng(31)
  const out: RockDef[] = []
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + (r() - 0.5) * 0.18
    const x = X + Math.cos(a) * (CASCADE.rx + 0.05)
    const z = CASCADE.z + Math.sin(a) * (CASCADE.rz + 0.05)
    if (z < CASCADE.z - 1.0 && Math.abs(x - X) < 2.5) continue
    const s = 0.22 + r() * 0.34
    out.push({ p: [x, FOREST_Y - s * 0.05, z], s: [s * 1.2, s, s], seed: 200 + i, moss: r() < 0.3 })
  }
  return out
}

/* --------------------------- éléments animés --------------------------- */
function FallingWater() {
  const mat = fallMaterial()
  const geos = useMemo(
    () => [
      flowGeo(LIP.y + 0.02, 5.3, LIP.z, 1.02),
      sheetGeo({ y0: LIP.y, z0: LIP.z, drop: LIP.y - LEDGE.y, reach: LEDGE.z0 - LIP.z, w0: 1.02, w1: 1.25, len: 1.6 }),
      flowGeo(LEDGE.y, LEDGE.z0, LEDGE.z1, 1.3),
      sheetGeo({ y0: LEDGE.y - 0.02, z0: LEDGE.z1, drop: LEDGE.y - 0.02 - WATER_Y, reach: IMPACT_POOL[2] - LEDGE.z1, w0: 1.3, w1: 1.6, len: 1.5 }),
    ],
    [],
  )
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos])
  useFrame((_s, dt) => {
    if (mat.map) mat.map.offset.y -= Math.min(dt, 0.1) * 1.3
  })
  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={mat} renderOrder={3} />
      ))}
    </group>
  )
}

const FOAM_N = 16
function Foam() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const seeds = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: FOAM_N }, (_, i) => {
      const pool = i >= 6
      const c = pool ? IMPACT_POOL : IMPACT_LEDGE
      return { c, dx: (r() - 0.5) * (pool ? 1.5 : 1.1), dz: (r() - 0.5) * 0.3, size: pool ? 0.55 + r() * 0.4 : 0.35 + r() * 0.25, rate: 0.6 + r() * 0.5, off: r() }
    })
  }, [])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color() }), [])
  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    seeds.forEach((f, i) => {
      const ph = (t * f.rate + f.off) % 1
      const sc = f.size * (0.6 + ph * 0.9)
      tmp.p.set(f.c[0] + f.dx, f.c[1] + 0.05 + ph * 0.22, f.c[2] + f.dz)
      tmp.s.set(sc, sc * 0.7, sc)
      tmp.m.compose(tmp.p, state.camera.quaternion, tmp.s)
      mesh.setMatrixAt(i, tmp.m)
      // mélange additif : la couleur sert d'opacité
      mesh.setColorAt(i, tmp.c.setScalar(Math.sin(ph * Math.PI) * 0.24))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: puffTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xdce6e8 }),
    [],
  )
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, FOAM_N]} material={mat} renderOrder={4} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </instancedMesh>
  )
}

function Ripples() {
  const group = useRef<THREE.Group>(null)
  const mats = useMemo(
    () => Array.from({ length: 4 }, () => new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, depthWrite: false, color: 0xcfdadd, opacity: 0 })),
    [],
  )
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])
  useFrame((state) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    g.children.forEach((c, i) => {
      const ph = (t / 2.6 + i / 4) % 1
      c.scale.setScalar(0.5 + ph * 2.3)
      mats[i].opacity = (1 - ph) * 0.42
    })
  })
  return (
    <group ref={group} position={[IMPACT_POOL[0], WATER_Y + 0.012, IMPACT_POOL[2] + 0.15]}>
      {mats.map((m, i) => (
        <mesh key={i} material={m} rotation={[-Math.PI / 2, 0, i * 1.3]} renderOrder={2}>
          <planeGeometry args={[1, 0.8]} />
        </mesh>
      ))}
    </group>
  )
}

const DROPS = 80
function Droplets() {
  const data = useMemo(() => {
    const r = rng(17)
    return Array.from({ length: DROPS }, (_, i) => {
      const pool = i >= 24
      const c = pool ? IMPACT_POOL : IMPACT_LEDGE
      return {
        o: [c[0] + (r() - 0.5) * (pool ? 1.4 : 1.0), c[1] + 0.03, c[2] + (r() - 0.5) * 0.25] as const,
        v: [(r() - 0.5) * 1.6, 0.9 + r() * (pool ? 1.6 : 1.0), -0.2 + r() * 1.1] as const,
        life: 0.45 + r() * 0.45,
        off: r(),
      }
    })
  }, [])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(DROPS * 3), 3))
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  const mat = useMemo(() => new THREE.PointsMaterial({ color: 0xe6eef0, size: 0.045, transparent: true, opacity: 0.75, depthWrite: false, sizeAttenuation: true }), [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const pos = geo.attributes.position as THREE.BufferAttribute
    data.forEach((d, i) => {
      const k = ((t / d.life + d.off) % 1) * d.life
      const y = d.o[1] + d.v[1] * k - 4.9 * k * k
      pos.setXYZ(i, d.o[0] + d.v[0] * k, Math.max(y, d.o[1] - 0.02), d.o[2] + d.v[2] * k)
    })
    pos.needsUpdate = true
  })
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={4} />
}

function Mist() {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: puffTexture(), transparent: true, depthWrite: false, color: 0xc9d3d8, opacity: 0.1 }), [])
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    const c = state.camera.position
    m.rotation.y = Math.atan2(c.x - m.position.x, c.z - m.position.z)
    mat.opacity = 0.08 + Math.sin(state.clock.elapsedTime * 0.6) * 0.025
  })
  return (
    <mesh ref={ref} material={mat} position={[X, -1.75, 7.5]} renderOrder={5}>
      <planeGeometry args={[3.4, 2.0]} />
    </mesh>
  )
}

/** Volume de la chute selon la distance de la caméra (fonctionne aussi pendant l'introduction). */
function CascadeSound() {
  const acc = useRef(0)
  useFrame((state, dt) => {
    acc.current += dt
    if (acc.current < 0.2) return
    acc.current = 0
    const c = state.camera.position
    const d = Math.hypot(c.x - X, c.z - 7.2, (c.y - WATER_Y) * 0.5)
    const zone = useGame.getState().zone
    const near = Math.max(0, 1 - d / 28) ** 2
    audio.setCascade(zone === 'exterior' ? near * 0.9 : zone === 'hall' ? near * 0.25 : 0)
  })
  useEffect(() => () => audio.setCascade(0), [])
  return null
}

/* --------------------------- composant --------------------------- */
export function Waterfall() {
  const parts = useStatic((b) => {
    const P = new Placer(b)
    const m = M()
    // bouche de pierre dans le soubassement
    P.box(voidMat(), 1.14, 0.42, 0.12, [X, -0.42, 5.27])
    P.box(m.stoneDark, 1.4, 0.24, 0.72, [X, -0.64, 5.6], [0, 0, 0], true)
    for (const sx of [-1, 1]) P.box(m.stoneDark, 0.16, 0.36, 0.72, [X + sx * 0.62, -0.46, 5.6], [0, 0, 0], true)
    P.box(m.stoneDark, 1.55, 0.16, 0.3, [X, -0.17, 5.38], [0, 0, 0], true)
    // éboulis et bordure
    for (const k of [...STACK, ...rimRocks()]) {
      const rot: [number, number, number] = [k.flip ? Math.PI : 0, (k.seed % 7) * 0.9, 0]
      P.geo(rockGeo(k.seed), rockMat(k.wet ? 'wet' : k.moss ? 'moss' : 'dry'), k.p, rot, k.s, true)
    }
  }, [])

  const pool = useMemo(poolShape, [])
  useEffect(() => () => pool.dispose(), [pool])
  const water = waterMaterial(0x16252b, 0x6a4060)
  useFrame((s) => {
    if (water.normalMap) water.normalMap.offset.set(s.clock.elapsedTime * 0.02, s.clock.elapsedTime * 0.013)
  })

  useEffect(() => {
    setCircles('cascade', [
      { x: X, z: CASCADE.z, r: CASCADE.rz },
      { x: X - 1.55, z: CASCADE.z, r: 1.85 },
      { x: X + 1.55, z: CASCADE.z, r: 1.85 },
      ...TORO.map((l) => ({ x: l.p[0], z: l.p[2], r: 0.42 })),
    ])
    setColliders('cascade-rocks', [{ x0: X - 2.8, x1: X + 2.9, z0: 5.0, z1: 7.3 }])
    return () => {
      removeColliders('cascade')
      removeColliders('cascade-rocks')
    }
  }, [])

  return (
    <group>
      <StaticMeshes parts={parts} />
      <mesh geometry={pool} material={water} position={[X, WATER_Y, CASCADE.z]} receiveShadow />
      <FallingWater />
      <Foam />
      <Ripples />
      <Droplets />
      <Mist />
      <CascadeSound />
      <StoneLanterns id="cascade-toro" zone="exterior" items={TORO} intensity={9} distance={9} />
    </group>
  )
}
