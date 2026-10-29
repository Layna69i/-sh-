/**
 * Atmosphère du Hall des Ombres : grandes lanternes suspendues aux poutres
 * (avec halos de lumière dans l'air enfumé) et volutes d'encens sur l'autel.
 */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { M, cachedMaterial, dynamicTexture } from '../assets'
import { useStatic, StaticMeshes } from '../Static'
import { Placer } from '../props/furniture'
import { Chochin, type LanternItem } from '../props/Lanterns'
import { makeCanvas, ctx2d } from '../../textures/util'
import { rng } from '../../core/math'

const BEAM_Y = 8.45
/** Lanterne centrale au-dessus de l'emblème, puis deux rangées le long de la nef. */
const HANGING: LanternItem[] = [
  { p: [0, 6.0, -13], s: 3.2 },
  ...[-6.5, -10.2, -15.8, -19.5].flatMap((z) => [
    { p: [-3.4, 6.4, z] as [number, number, number], s: 2.2 },
    { p: [3.4, 6.4, z] as [number, number, number], s: 2.2 },
  ]),
]

/* --------------------------- textures --------------------------- */
function smokeTexture() {
  return dynamicTexture('hall-smoke', () => {
    const c = makeCanvas(128)
    const ctx = ctx2d(c)
    ctx.clearRect(0, 0, 128, 128)
    const r = rng(12)
    for (let i = 0; i < 28; i++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * 34
      const x = 64 + Math.cos(a) * d
      const y = 64 + Math.sin(a) * d
      const rad = 14 + r() * 22
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
      g.addColorStop(0, `rgba(255,255,255,${(0.08 + r() * 0.1).toFixed(3)})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 128, 128)
    }
    return c
  })
}

/** Voile lumineux sous une lanterne : trapèze aux bords fondus, plus dense en haut. */
function hazeTexture() {
  return dynamicTexture('hall-haze-veil', () => {
    const W = 128
    const H = 256
    const c = makeCanvas(W, H)
    const ctx = ctx2d(c)
    const img = ctx.createImageData(W, H)
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1)
      const half = 0.1 + v * 0.4
      for (let x = 0; x < W; x++) {
        const d = Math.abs(x / (W - 1) - 0.5)
        const edge = Math.min(1, Math.max(0, (half - d) / (half * 0.55)))
        const a = Math.pow(1 - v, 1.3) * edge * edge * (3 - 2 * edge)
        const i = (y * W + x) * 4
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
        img.data[i + 3] = Math.round(a * 255)
      }
    }
    ctx.putImageData(img, 0, 0)
    return c
  })
}

const hazeMat = () =>
  cachedMaterial('hall-haze-veil', () =>
    new THREE.MeshBasicMaterial({ map: hazeTexture(), color: 0xffc78a, transparent: true, opacity: 0.075, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  )

/* --------------------------- fumée --------------------------- */
/** Volutes : sprites qui montent en s'élargissant puis s'effacent. */
export function IncenseSmoke({
  origin,
  count = 10,
  height = 2.4,
  life = 7,
  width = 0.9,
  opacity = 0.16,
  color = 0xbdb4aa,
  seed = 1,
}: {
  origin: [number, number, number]
  count?: number
  height?: number
  life?: number
  width?: number
  opacity?: number
  color?: number
  seed?: number
}) {
  const group = useRef<THREE.Group>(null)
  const puffs = useMemo(() => {
    const r = rng(seed)
    return Array.from({ length: count }, (_, i) => ({ off: i / count, sway: r() * 6, k: 0.7 + r() * 0.6 }))
  }, [count, seed])
  const mats = useMemo(
    () => puffs.map(() => new THREE.SpriteMaterial({ map: smokeTexture(), color, transparent: true, depthWrite: false, opacity: 0 })),
    [puffs, color],
  )
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])
  useFrame((s) => {
    const g = group.current
    if (!g) return
    const t = s.clock.elapsedTime
    g.children.forEach((c, i) => {
      const p = puffs[i]
      const ph = (t / life + p.off) % 1
      c.position.set(Math.sin(ph * 4 + p.sway + t * 0.3) * 0.25 * ph * width, ph * height, Math.cos(ph * 3 + p.sway) * 0.15 * ph * width)
      const sc = (0.1 + ph * width) * p.k
      c.scale.set(sc, sc * 1.4, 1)
      const m = mats[i]
      m.opacity = opacity * Math.min(1, ph / 0.12) * Math.pow(1 - ph, 1.2)
      m.rotation = p.sway + ph * 1.5
    })
  })
  return (
    <group ref={group} position={origin}>
      {mats.map((m, i) => (
        <sprite key={i} material={m} renderOrder={6} />
      ))}
    </group>
  )
}

/* --------------------------- composant --------------------------- */
export function HallAtmosphere() {
  const parts = useStatic((b) => {
    const m = M()
    const P = new Placer(b)
    // cordons des lanternes jusqu'aux poutres
    for (const it of HANGING) {
      const s = it.s ?? 1
      const top = it.p[1] + 0.85 * s
      if (top < BEAM_Y) P.cyl(m.rope, 0.012, 0.012, BEAM_Y - top, 4, [it.p[0], (top + BEAM_Y) / 2, it.p[2]])
    }
  }, [])

  const haze = useMemo(
    () =>
      HANGING.map((it) => {
        const s = it.s ?? 1
        const bottom = it.p[1] - 0.36 * s
        const h = bottom - 0.05
        return { pos: [it.p[0], bottom - h / 2, it.p[2]] as [number, number, number], rBottom: 0.75 * s + 0.9, h }
      }),
    [],
  )

  // voiles tournés vers la caméra (rotation verticale seulement)
  const hazeGroup = useRef<THREE.Group>(null)
  useFrame((st) => {
    const c = st.camera.position
    hazeGroup.current?.children.forEach((m) => (m.rotation.y = Math.atan2(c.x - m.position.x, c.z - m.position.z)))
  })

  return (
    <group>
      <StaticMeshes parts={parts} />
      <Chochin id="hall-hanging" zone="hall" items={HANGING} intensity={8} distance={12} />
      <group ref={hazeGroup}>
        {haze.map((h, i) => (
          <mesh key={i} material={hazeMat()} position={h.pos} renderOrder={5}>
            <planeGeometry args={[h.rBottom * 2, h.h]} />
          </mesh>
        ))}
      </group>
      <IncenseSmoke origin={[-0.75, 1.1, -24.85]} count={9} height={2.2} width={0.6} opacity={0.2} seed={9} />
    </group>
  )
}
