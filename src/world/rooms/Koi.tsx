/**
 * Carpes koï du bassin du jardin : quelques poissons aux robes classiques
 * (kōhaku, shōwa, ōgon, asagi) qui tournent lentement juste sous la surface.
 * Ils sont dessinés après l'eau, en semi-transparence, pour paraître immergés.
 */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { cachedMaterial, dynamicTexture } from '../assets'
import { makeCanvas, ctx2d } from '../../textures/util'
import { rng } from '../../core/math'

type Robe = 'kohaku' | 'showa' | 'ogon' | 'asagi'
const ROBES: Robe[] = ['kohaku', 'showa', 'ogon', 'kohaku', 'asagi', 'showa', 'kohaku']

function robeTexture(robe: Robe) {
  return dynamicTexture(`koi-${robe}`, () => {
    const c = makeCanvas(128, 64)
    const ctx = ctx2d(c)
    const r = rng(robe.length * 13)
    const base = robe === 'ogon' ? '#d9a441' : robe === 'asagi' ? '#7f8f9c' : '#f1ece2'
    ctx.fillStyle = base
    ctx.fillRect(0, 0, 128, 64)
    const blot = (color: string, n: number) => {
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.ellipse(r() * 128, 10 + r() * 44, 8 + r() * 18, 5 + r() * 9, r() * 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    if (robe === 'kohaku') blot('#c8361d', 5)
    if (robe === 'showa') {
      blot('#141210', 6)
      blot('#c23a1e', 3)
    }
    if (robe === 'asagi') {
      ctx.fillStyle = '#d0662c'
      ctx.fillRect(0, 50, 128, 14)
    }
    if (robe === 'ogon') {
      const g = ctx.createLinearGradient(0, 0, 0, 64)
      g.addColorStop(0, 'rgba(255,240,190,0.35)')
      g.addColorStop(1, 'rgba(120,70,10,0.2)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 128, 64)
    }
    return c
  })
}

const bodyMat = (robe: Robe) =>
  cachedMaterial(`koi-body-${robe}`, () => new THREE.MeshStandardMaterial({ map: robeTexture(robe), roughness: 0.4, transparent: true, opacity: 0.78, depthWrite: false }))
const finMat = () => cachedMaterial('koi-fin', () => new THREE.MeshStandardMaterial({ color: 0xf3e6d6, roughness: 0.6, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }))

/** Corps allongé selon +z (tête en +z), queue en éventail séparée pour l'animer.
 *  Les formes 2D sont couchées par rotateX(-π/2) : leur y positif part vers l'arrière (-z). */
function koiGeos() {
  const body = new THREE.SphereGeometry(1, 14, 10)
  body.rotateX(Math.PI / 2)
  const pos = body.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i)
    // tête arrondie, corps qui s'affine vers la queue
    const taper = z < 0 ? 1 + z * 0.55 : 1
    pos.setXYZ(i, pos.getX(i) * 0.055 * taper, pos.getY(i) * 0.04 * taper, z * 0.17)
  }
  body.computeVertexNormals()
  const tail = new THREE.ShapeGeometry(
    new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.07, 0.11), new THREE.Vector2(0, 0.08), new THREE.Vector2(0.07, 0.11)]),
  )
  tail.rotateX(-Math.PI / 2)
  const fins = new THREE.ShapeGeometry(
    new THREE.Shape([new THREE.Vector2(0.04, 0), new THREE.Vector2(0.11, 0.05), new THREE.Vector2(0.05, 0.04), new THREE.Vector2(-0.05, 0.04), new THREE.Vector2(-0.11, 0.05), new THREE.Vector2(-0.04, 0)]),
  )
  fins.rotateX(-Math.PI / 2)
  fins.translate(0, -0.01, 0.06)
  return { body, tail, fins }
}

export function Koi({ x, z, rx, rz, y }: { x: number; z: number; rx: number; rz: number; y: number }) {
  const geos = useMemo(koiGeos, [])
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos])
  const fish = useMemo(() => {
    const r = rng(404)
    return ROBES.map((robe, i) => ({
      robe,
      a0: (i / ROBES.length) * Math.PI * 2,
      w: (0.12 + r() * 0.12) * (i % 3 === 0 ? -1 : 1),
      k: 0.35 + r() * 0.4,
      wob: r() * 6,
      depth: r() * 0.025,
      scale: 0.8 + r() * 0.45,
    }))
  }, [])
  const refs = useRef<(THREE.Group | null)[]>([])
  const tails = useRef<(THREE.Mesh | null)[]>([])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    fish.forEach((f, i) => {
      const g = refs.current[i]
      if (!g) return
      const a = f.a0 + f.w * t
      const k = f.k + Math.sin(t * 0.21 + f.wob) * 0.12
      const px = x + Math.cos(a) * rx * k
      const pz = z + Math.sin(a) * rz * k
      // direction : dérivée de la trajectoire
      const dx = -Math.sin(a) * rx * k * Math.sign(f.w)
      const dz = Math.cos(a) * rz * k * Math.sign(f.w)
      g.position.set(px, y - 0.012 - f.depth, pz)
      g.rotation.y = Math.atan2(dx, dz) + Math.sin(t * 3 + f.wob) * 0.08
      const tail = tails.current[i]
      if (tail) tail.rotation.y = Math.sin(t * 7 + f.wob) * 0.45
    })
  })
  return (
    <group>
      {fish.map((f, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} scale={f.scale}>
          <mesh geometry={geos.body} material={bodyMat(f.robe)} renderOrder={3} />
          <mesh geometry={geos.fins} material={finMat()} renderOrder={3} />
          <mesh ref={(el) => (tails.current[i] = el)} geometry={geos.tail} material={finMat()} position={[0, 0, -0.16]} renderOrder={3} />
        </group>
      ))}
    </group>
  )
}
