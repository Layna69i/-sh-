/**
 * Le système d'ombres Nara : silhouettes de cerfs et de shinobi qui glissent
 * sur les murs et les papiers, vrilles d'encre autour de l'emblème…
 * Discret par conception : opacités faibles, apparitions espacées.
 */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { dynamicTexture } from '../assets'
import { makeCanvas, ctx2d } from '../../textures/util'
import { drawDeer } from '../../textures/generators'
import { rng } from '../../core/math'
import type { ZoneId } from '../layout'

type Kind = 'deer' | 'figure' | 'tendril' | 'hand'

function shadowTex(kind: Kind) {
  return dynamicTexture(`shadow-${kind}`, () => {
    const c = makeCanvas(512, 512)
    const ctx = ctx2d(c)
    ctx.clearRect(0, 0, 512, 512)
    ctx.filter = 'blur(6px)'
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#fff'
    if (kind === 'deer') drawDeer(ctx, 230, 330, 2.6)
    else if (kind === 'figure') {
      ctx.beginPath()
      ctx.moveTo(190, 120)
      ctx.lineTo(256, 70)
      ctx.lineTo(322, 120)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(256, 140, 22, 26, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(226, 160)
      ctx.quadraticCurveTo(170, 280, 190, 400)
      ctx.lineTo(320, 400)
      ctx.quadraticCurveTo(342, 280, 286, 160)
      ctx.closePath()
      ctx.fill()
      ctx.fillRect(220, 390, 26, 100)
      ctx.fillRect(268, 390, 26, 100)
    } else if (kind === 'tendril') {
      const r = rng(5)
      ctx.lineCap = 'round'
      for (let i = 0; i < 9; i++) {
        const a0 = (i / 9) * Math.PI * 2
        ctx.lineWidth = 10 + r() * 8
        ctx.beginPath()
        let a = a0
        let rad = 150
        ctx.moveTo(256 + Math.cos(a) * rad, 256 + Math.sin(a) * rad)
        for (let k = 0; k < 30; k++) {
          a += 0.035 + r() * 0.02
          rad += 3.2
          ctx.lineWidth *= 0.95
          ctx.lineTo(256 + Math.cos(a) * rad, 256 + Math.sin(a) * rad)
        }
        ctx.stroke()
      }
    } else {
      // main tendue (ombre qui « saisit »)
      ctx.beginPath()
      ctx.ellipse(256, 330, 70, 90, 0, 0, Math.PI * 2)
      ctx.fill()
      for (let f = 0; f < 5; f++) {
        ctx.lineWidth = 26 - f * 2
        ctx.lineCap = 'round'
        ctx.beginPath()
        const x = 200 + f * 28
        ctx.moveTo(x, 300)
        ctx.quadraticCurveTo(x + (f - 2) * 8, 200, x + (f - 2) * 16, 110 + Math.abs(f - 2) * 20)
        ctx.stroke()
      }
    }
    return c
  })
}

interface Actor {
  kind: Kind
  from: [number, number, number]
  to: [number, number, number]
  rot: [number, number, number]
  size: [number, number]
  period: number
  delay: number
  window: number
  opacity: number
  spin?: number
  flip?: boolean
}

const W = Math.PI / 2
export const SHADOW_ACTORS: Partial<Record<ZoneId, Actor[]>> = {
  hall: [
    { kind: 'deer', from: [-9.8, 6.3, -4.5], to: [-9.8, 6.3, -21], rot: [0, W, 0], size: [3.2, 3.2], period: 46, delay: 6, window: 0.5, opacity: 0.5 },
    { kind: 'figure', from: [9.8, 6.4, -21], to: [9.8, 6.4, -5], rot: [0, -W, 0], size: [2.6, 2.6], period: 58, delay: 28, window: 0.32, opacity: 0.45 },
    { kind: 'tendril', from: [0, 0.012, -13], to: [0, 0.012, -13], rot: [-W, 0, 0], size: [9.6, 9.6], period: 24, delay: 0, window: 1, opacity: 0.33, spin: 0.05 },
  ],
  library: [
    { kind: 'figure', from: [-27.8, 3.0, -11], to: [-27.8, 3.0, -24], rot: [0, W, 0], size: [3, 3], period: 64, delay: 12, window: 0.3, opacity: 0.35 },
    { kind: 'hand', from: [-19, 0.015, -12], to: [-19, 0.015, -14.2], rot: [-W, 0, 0], size: [1.8, 1.8], period: 40, delay: 22, window: 0.25, opacity: 0.4 },
  ],
  shogi: [
    { kind: 'figure', from: [23.78, 1.45, -16.2], to: [23.78, 1.45, -19.8], rot: [0, -W, 0], size: [2.2, 2.2], period: 34, delay: 4, window: 0.55, opacity: 0.62 },
    { kind: 'deer', from: [23.78, 1.2, -19.6], to: [23.78, 1.2, -16.4], rot: [0, -W, 0], size: [2.0, 2.0], period: 47, delay: 25, window: 0.45, opacity: 0.55 },
  ],
  garden: [
    { kind: 'deer', from: [-9.6, 1.1, -30], to: [-9.6, 1.1, -43], rot: [0, W, 0], size: [2.2, 2.2], period: 50, delay: 15, window: 0.4, opacity: 0.4 },
  ],
  office: [
    { kind: 'deer', from: [-5.8, 1.6, -48], to: [-5.8, 1.6, -54], rot: [0, W, 0], size: [2.0, 2.0], period: 44, delay: 8, window: 0.5, opacity: 0.38, flip: true },
  ],
  dojo: [
    { kind: 'figure', from: [-27.8, 2.6, -29], to: [-27.8, 2.6, -43], rot: [0, W, 0], size: [2.8, 2.8], period: 70, delay: 30, window: 0.3, opacity: 0.32 },
  ],
}

function ShadowActor({ a }: { a: Actor }) {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x020203,
        alphaMap: shadowTex(a.kind),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -6,
        side: THREE.DoubleSide,
      }),
    [a.kind],
  )
  const from = useMemo(() => new THREE.Vector3(...a.from), [a])
  const to = useMemo(() => new THREE.Vector3(...a.to), [a])
  useFrame((s) => {
    const t = s.clock.elapsedTime - a.delay
    if (!mesh.current) return
    if (t < 0) {
      mat.opacity = 0
      mesh.current.visible = false
      return
    }
    const ph = (t % a.period) / a.period
    if (ph > a.window) {
      mesh.current.visible = false
      return
    }
    const k = ph / a.window
    const fade = a.window >= 1 ? 0.75 + 0.25 * Math.sin(t * 0.4) : Math.sin(Math.PI * k)
    mesh.current.visible = true
    mesh.current.position.lerpVectors(from, to, k * k * (3 - 2 * k))
    // petite oscillation de marche
    if (a.kind === 'deer' || a.kind === 'figure') mesh.current.position.y += Math.abs(Math.sin(t * 2.4)) * 0.04
    if (a.spin) mesh.current.rotation.z = t * a.spin
    mat.opacity = a.opacity * Math.pow(Math.max(0, fade), 0.7)
  })
  const dirSign = to.clone().sub(from)
  const flipX = a.flip ? -1 : 1
  return (
    <mesh ref={mesh} material={mat} rotation={a.rot} scale={[a.size[0] * (dirSign.length() > 0 && a.rot[1] < 0 ? -1 : 1) * flipX, a.size[1], 1]} renderOrder={4}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}

export function ShadowPlay({ zone }: { zone: ZoneId }) {
  const actors = SHADOW_ACTORS[zone] ?? []
  return (
    <group>
      {actors.map((a, i) => (
        <ShadowActor key={i} a={a} />
      ))}
    </group>
  )
}
