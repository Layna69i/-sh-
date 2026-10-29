/**
 * Ombre-guide inspirée du Kagemane no Jutsu : lorsqu'un objet interactif est
 * visé, un mince filet d'ombre s'étire sur le sol depuis les pieds du joueur
 * jusqu'à l'objet, puis se rétracte lorsqu'on détourne le regard.
 */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { getCurrentTarget } from '../../interaction/InteractionSystem'
import { player } from '../../player/PlayerController'
import { floorHeight } from '../layout'
import { damp } from '../../core/math'
import { useGame } from '../../store/game'

const SEG = 48

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const frag = /* glsl */ `
varying vec2 vUv;
uniform float uProgress;
uniform float uOpacity;
uniform float uTime;
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  float along = vUv.x;
  if (along > uProgress) discard;
  float across = abs(vUv.y - 0.5) * 2.0;
  float taper = mix(0.35, 1.0, smoothstep(0.0, 0.25, along)) * mix(1.0, 0.25, smoothstep(0.75, 1.0, along));
  float n = noise(vec2(along * 26.0 - uTime * 1.6, vUv.y * 4.0)) * 0.55 + noise(vec2(along * 70.0 + uTime, vUv.y * 9.0)) * 0.25;
  float a = 1.0 - smoothstep(taper * 0.55, taper * 0.55 + 0.35 + n * 0.25, across);
  a *= smoothstep(uProgress, uProgress - 0.06, along);
  a *= smoothstep(0.0, 0.08, along);
  gl_FragColor = vec4(0.012, 0.012, 0.02, a * uOpacity);
}`

export function ShadowGuide() {
  const { geo, mat } = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array((SEG + 1) * 2 * 3)
    const uv = new Float32Array((SEG + 1) * 2 * 2)
    const idx: number[] = []
    for (let i = 0; i <= SEG; i++) {
      uv.set([i / SEG, 0, i / SEG, 1], i * 4)
      if (i < SEG) {
        const a = i * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setIndex(idx)
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uProgress: { value: 0 }, uOpacity: { value: 0 }, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    })
    return { geo, mat }
  }, [])
  const st = useRef({ id: '', progress: 0, opacity: 0, end: new THREE.Vector3(), start: new THREE.Vector3() })
  const mesh = useRef<THREE.Mesh>(null)

  useFrame((s, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const target = getCurrentTarget()
    const g = useGame.getState()
    const k = st.current
    const active = !!target && g.phase === 'playing' && !g.panel
    if (active && target) {
      if (target.id !== k.id) {
        k.id = target.id
        k.progress = 0
      }
      const c = target.anchor ?? target.box.getCenter(new THREE.Vector3())
      k.end.set(c.x, 0, c.z)
      k.progress = Math.min(1, k.progress + dt * 2.2)
      k.opacity = damp(k.opacity, 1, 6, dt)
    } else {
      k.opacity = damp(k.opacity, 0, 5, dt)
      k.progress = Math.max(0, k.progress - dt * 1.5)
      if (k.opacity < 0.01) k.id = ''
    }
    mat.uniforms.uProgress.value = k.progress
    mat.uniforms.uOpacity.value = k.opacity
    mat.uniforms.uTime.value = s.clock.elapsedTime
    if (mesh.current) mesh.current.visible = k.opacity > 0.01
    if (k.opacity < 0.01) return

    // tracé : des pieds du joueur jusqu'au pied de l'objet, avec une légère ondulation
    const sx = player.x - Math.sin(player.yaw) * 0.35
    const sz = player.z - Math.cos(player.yaw) * 0.35
    const dx = k.end.x - sx
    const dz = k.end.z - sz
    const len = Math.hypot(dx, dz) || 1
    const nx = -dz / len
    const nz = dx / len
    const pos = geo.attributes.position as THREE.BufferAttribute
    const t = s.clock.elapsedTime
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG
      const wob = Math.sin(u * Math.PI) * (0.18 * Math.sin(u * 5 + t * 0.8) + 0.12)
      const x = sx + dx * u + nx * wob
      const z = sz + dz * u + nz * wob
      const y = floorHeight(x, z) + 0.015
      const w = 0.07 + 0.06 * Math.sin(u * Math.PI)
      pos.setXYZ(i * 2, x - nx * w, y, z - nz * w)
      pos.setXYZ(i * 2 + 1, x + nx * w, y, z + nz * w)
    }
    pos.needsUpdate = true
    geo.computeBoundingSphere()
  })

  return <mesh ref={mesh} geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />
}
