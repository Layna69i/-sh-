/**
 * Cerfs sika, symboles du clan Nara : modèle procédural articulé (cou, tête,
 * oreilles, pattes) et petite machine à états (brouter, guetter, marcher).
 */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { terrainHeight } from '../layout'
import { M } from '../assets'
import { cachedMaterial } from '../assets'
import { damp, dampAngle, rng } from '../../core/math'

const furMat = () =>
  cachedMaterial('deer-fur', () => new THREE.MeshStandardMaterial({ color: 0x6e4c33, roughness: 1 }))
const bellyMat = () => cachedMaterial('deer-belly', () => new THREE.MeshStandardMaterial({ color: 0xb59d80, roughness: 1 }))
const darkMat = () => cachedMaterial('deer-dark', () => new THREE.MeshStandardMaterial({ color: 0x1d1612, roughness: 0.6 }))

function ellipsoid(rx: number, ry: number, rz: number) {
  const g = new THREE.SphereGeometry(1, 14, 10)
  g.scale(rx, ry, rz)
  return g
}

function antlerGeo() {
  const parts: THREE.BufferGeometry[] = []
  for (const side of [-1, 1]) {
    const main = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.04 * side, 0, 0),
      new THREE.Vector3(0.1 * side, 0.14, -0.02),
      new THREE.Vector3(0.14 * side, 0.3, -0.08),
      new THREE.Vector3(0.12 * side, 0.46, -0.04),
    ])
    parts.push(new THREE.TubeGeometry(main, 8, 0.014, 5))
    const p1 = main.getPoint(0.3)
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p1, p1.clone().add(new THREE.Vector3(0.02 * side, 0.08, 0.1))]), 3, 0.01, 4))
    const p2 = main.getPoint(0.72)
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p2, p2.clone().add(new THREE.Vector3(-0.05 * side, 0.1, 0.03))]), 3, 0.009, 4))
  }
  return parts
}

interface DeerProps {
  home: [number, number]
  stag?: boolean
  scale?: number
  seed: number
}

function Leg({ legRef, x, z, front }: { legRef: (g: THREE.Group | null) => void; x: number; z: number; front: boolean }) {
  return (
    <group ref={legRef} position={[x, 0.82, z]}>
      <mesh material={furMat()} position={[0, -0.2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.035, 0.42, 6]} />
      </mesh>
      <mesh material={furMat()} position={[0, -0.6, front ? 0.01 : -0.02]} castShadow>
        <cylinderGeometry args={[0.025, 0.02, 0.42, 6]} />
      </mesh>
      <mesh material={darkMat()} position={[0, -0.81, 0.01]}>
        <boxGeometry args={[0.045, 0.04, 0.06]} />
      </mesh>
    </group>
  )
}

export function Deer({ home, stag = true, scale = 1, seed }: DeerProps) {
  const root = useRef<THREE.Group>(null)
  const neck = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const ears = useRef<(THREE.Mesh | null)[]>([])
  const legs = useRef<(THREE.Group | null)[]>([])
  const r = useMemo(() => rng(seed), [seed])
  const st = useRef({
    x: home[0],
    z: home[1],
    heading: r() * Math.PI * 2,
    state: 'graze' as 'graze' | 'look' | 'walk',
    timer: 2 + r() * 4,
    neck: 0.9,
    headYaw: 0,
    targetYaw: 0,
    phase: 0,
    ear: 0,
  })
  const antlers = useMemo(() => (stag ? antlerGeo() : []), [stag])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const s = st.current
    s.timer -= dt
    if (s.timer <= 0) {
      const roll = r()
      if (s.state === 'walk' || roll < 0.45) {
        s.state = 'graze'
        s.timer = 3 + r() * 6
      } else if (roll < 0.75) {
        s.state = 'look'
        s.timer = 2 + r() * 3
        s.targetYaw = (r() - 0.5) * 1.2
      } else {
        s.state = 'walk'
        s.timer = 2 + r() * 3
        const dx = home[0] - s.x
        const dz = home[1] - s.z
        const away = Math.hypot(dx, dz)
        s.heading = away > 5 ? Math.atan2(dx, dz) + (r() - 0.5) * 0.6 : s.heading + (r() - 0.5) * 1.6
      }
    }
    const walking = s.state === 'walk'
    if (walking) {
      s.x += Math.sin(s.heading) * 0.55 * dt
      s.z += Math.cos(s.heading) * 0.55 * dt
      s.phase += dt * 5.5
    }
    s.neck = damp(s.neck, s.state === 'graze' ? 1.05 : walking ? 0.15 : -0.1, 2.2, dt)
    s.headYaw = dampAngle(s.headYaw, s.state === 'look' ? s.targetYaw : 0, 2, dt)
    s.ear += dt
    if (root.current) {
      root.current.position.set(s.x, terrainHeight(s.x, s.z) - 0.04, s.z)
      root.current.rotation.y = dampAngle(root.current.rotation.y, s.heading, 3, dt)
    }
    if (neck.current) {
      neck.current.rotation.x = s.neck
      neck.current.rotation.y = s.headYaw * 0.6
    }
    if (head.current) {
      head.current.rotation.y = s.headYaw * 0.4
      head.current.rotation.x = -s.neck * 0.35 + (s.state === 'graze' ? Math.sin(s.ear * 3) * 0.05 : 0)
    }
    ears.current.forEach((e, i) => {
      if (e) e.rotation.z = (i ? -1 : 1) * (0.9 + (Math.sin(s.ear * 0.7 + i) > 0.97 ? 0.4 : 0))
    })
    legs.current.forEach((l, i) => {
      if (!l) return
      const ph = s.phase + (i === 0 || i === 3 ? 0 : Math.PI)
      l.rotation.x = walking ? Math.sin(ph) * 0.45 : damp(l.rotation.x, 0, 4, dt)
    })
  })

  return (
    <group ref={root} scale={scale}>
      <mesh geometry={useMemo(() => ellipsoid(0.22, 0.25, 0.5), [])} material={furMat()} position={[0, 0.98, 0]} castShadow />
      <mesh geometry={useMemo(() => ellipsoid(0.2, 0.16, 0.42), [])} material={bellyMat()} position={[0, 0.88, 0.02]} />
      <mesh geometry={useMemo(() => ellipsoid(0.23, 0.26, 0.24), [])} material={furMat()} position={[0, 1.0, 0.32]} castShadow />
      <mesh geometry={useMemo(() => ellipsoid(0.24, 0.26, 0.25), [])} material={furMat()} position={[0, 1.0, -0.33]} castShadow />
      <mesh geometry={useMemo(() => ellipsoid(0.07, 0.09, 0.05), [])} material={bellyMat()} position={[0, 1.08, -0.58]} />
      <group ref={neck} position={[0, 1.12, 0.45]}>
        <mesh material={furMat()} position={[0, 0.2, 0.08]} rotation={[0.4, 0, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.11, 0.48, 8]} />
        </mesh>
        <group ref={head} position={[0, 0.44, 0.17]}>
          <mesh geometry={useMemo(() => ellipsoid(0.085, 0.09, 0.15), [])} material={furMat()} position={[0, 0, 0.05]} castShadow />
          <mesh geometry={useMemo(() => ellipsoid(0.05, 0.055, 0.1), [])} material={furMat()} position={[0, -0.03, 0.18]} />
          <mesh material={darkMat()} position={[0, -0.03, 0.27]}>
            <sphereGeometry args={[0.025, 8, 6]} />
          </mesh>
          {[-1, 1].map((sx, i) => (
            <mesh key={sx} ref={(e) => void (ears.current[i] = e)} material={furMat()} position={[sx * 0.08, 0.07, -0.02]} rotation={[0, 0, sx * 0.9]}>
              <coneGeometry args={[0.035, 0.13, 6]} />
            </mesh>
          ))}
          {[-1, 1].map((sx) => (
            <mesh key={sx} material={darkMat()} position={[sx * 0.065, 0.02, 0.08]}>
              <sphereGeometry args={[0.014, 6, 6]} />
            </mesh>
          ))}
          {antlers.map((g, i) => (
            <mesh key={i} geometry={g} material={M().woodLight} position={[0, 0.06, -0.02]} castShadow />
          ))}
        </group>
      </group>
      {(
        [
          [-0.12, 0.3, true],
          [0.12, 0.3, true],
          [-0.12, -0.34, false],
          [0.12, -0.34, false],
        ] as const
      ).map(([x, z, front], i) => (
        <Leg key={i} legRef={(g) => void (legs.current[i] = g)} x={x} z={z} front={front} />
      ))}
    </group>
  )
}

export const DEER_SPOTS: DeerProps[] = [
  { home: [-11, 41], stag: true, seed: 1 },
  { home: [-15.5, 46], stag: false, scale: 0.85, seed: 2 },
  { home: [-8.5, 56], stag: false, seed: 3 },
  { home: [14, 63], stag: true, scale: 1.05, seed: 4 },
  { home: [-15, -64], stag: true, seed: 5 },
  { home: [9, -69], stag: false, seed: 6 },
  { home: [36, 10], stag: false, scale: 0.9, seed: 7 },
]
