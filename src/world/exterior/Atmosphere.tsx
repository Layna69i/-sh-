/**
 * Atmosphère de la forêt : brume basse (billboards bruités), feuilles
 * d'érable portées par le vent, lucioles, cerfs.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { T } from '../assets'
import { rng, range } from '../../core/math'
import { terrainHeight, footprintDistance } from '../layout'
import { useSettings, QUALITY } from '../../store/settings'
import { Deer, DEER_SPOTS } from './Deer'

/* ------------------------------ brume ------------------------------ */
const mistVert = /* glsl */ `
attribute vec3 offset;
attribute float size;
attribute float seed;
uniform float uTime;
varying vec2 vUv;
varying float vSeed;
varying float vFade;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vSeed = seed;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 p = offset + right * position.x * size + vec3(0.0, 1.0, 0.0) * position.y * size * 0.35;
  p.x += sin(uTime * 0.04 + seed * 6.283) * 3.0;
  p.z += cos(uTime * 0.03 + seed * 3.1) * 2.0;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  float d = -mvPosition.z;
  vFade = smoothstep(3.0, 14.0, d) * (1.0 - smoothstep(70.0, 140.0, d));
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`
const mistFrag = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
varying float vSeed;
varying float vFade;
#include <fog_pars_fragment>
void main() {
  vec2 c = vUv - 0.5;
  float r = 1.0 - smoothstep(0.15, 0.5, length(c * vec2(1.0, 1.4)));
  float n = texture2D(uNoise, vUv * 0.7 + vec2(vSeed * 3.7 + uTime * 0.006, vSeed * 1.3)).r;
  float n2 = texture2D(uNoise, vUv * 1.6 - vec2(uTime * 0.01, vSeed)).r;
  float a = r * smoothstep(0.3, 0.85, n * 0.7 + n2 * 0.5) * vFade * uOpacity;
  gl_FragColor = vec4(uColor, a);
  #include <fog_fragment>
}`

function Mist() {
  const quality = useSettings((s) => s.quality)
  const count = quality === 'high' ? 70 : 45
  const { geo, mat } = useMemo(() => {
    const r = rng(555)
    const base = new THREE.PlaneGeometry(1, 1)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index
    geo.attributes.position = base.attributes.position
    geo.attributes.uv = base.attributes.uv
    const off: number[] = []
    const size: number[] = []
    const seed: number[] = []
    let n = 0
    while (n < count) {
      const x = range(r, -70, 70)
      const z = range(r, -60, 100)
      if (footprintDistance(x, z) < 4) continue
      off.push(x, terrainHeight(x, z) + range(r, 0.6, 2.2), z)
      size.push(range(r, 10, 24))
      seed.push(r())
      n++
    }
    geo.setAttribute('offset', new THREE.InstancedBufferAttribute(new Float32Array(off), 3))
    geo.setAttribute('size', new THREE.InstancedBufferAttribute(new Float32Array(size), 1))
    geo.setAttribute('seed', new THREE.InstancedBufferAttribute(new Float32Array(seed), 1))
    geo.instanceCount = count
    const mat = new THREE.ShaderMaterial({
      vertexShader: mistVert,
      fragmentShader: mistFrag,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uTime: { value: 0 }, uNoise: { value: T().noise }, uColor: { value: new THREE.Color(0x6c5a72) }, uOpacity: { value: 0.32 } },
      ]),
      transparent: true,
      depthWrite: false,
      fog: true,
    })
    mat.uniforms.uNoise.value = T().noise
    return { geo, mat }
  }, [count])
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat])
  useFrame((s) => (mat.uniforms.uTime.value = s.clock.elapsedTime))
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={2} />
}

/* ------------------------------ feuilles ------------------------------ */
export function FallingLeaves({ count = 140, area = 16, center }: { count?: number; area?: number; center?: [number, number, number] }) {
  const camera = useThree((s) => s.camera)
  const { mesh, parts } = useMemo(() => {
    const r = rng(77)
    const g = new THREE.PlaneGeometry(0.09, 0.09)
    const mat = new THREE.MeshStandardMaterial({ map: T().leaf, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 })
    const mesh = new THREE.InstancedMesh(g, mat, count)
    const palette = [0x9c2f1a, 0xb8501f, 0xc77a2a, 0x7a2416, 0x8c6a26, 0x5b6a2a]
    const parts = Array.from({ length: count }, (_, i) => {
      mesh.setColorAt(i, new THREE.Color(palette[i % palette.length]).multiplyScalar(1.3))
      return {
        x: range(r, -area, area),
        y: range(r, 0, 9),
        z: range(r, -area, area),
        rx: r() * 6,
        ry: r() * 6,
        sp: range(r, 0.35, 0.8),
        ph: r() * 6,
        spin: range(r, 1, 3),
      }
    })
    mesh.frustumCulled = false
    return { mesh, parts }
  }, [count, area])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  useEffect(() => () => (mesh.geometry.dispose(), mesh.dispose()), [mesh])
  useFrame((s, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = s.clock.elapsedTime
    const cx = center ? center[0] : camera.position.x
    const cy = center ? center[1] : camera.position.y
    const cz = center ? center[2] : camera.position.z
    parts.forEach((p, i) => {
      p.y -= p.sp * dt
      p.x += (Math.sin(t * 0.7 + p.ph) * 0.5 + 0.35) * dt
      p.z += Math.cos(t * 0.5 + p.ph) * 0.25 * dt
      p.rx += p.spin * dt
      p.ry += p.spin * 0.6 * dt
      // recyclage autour du point d'intérêt
      let wx = p.x + cx
      let wz = p.z + cz
      if (p.x > area) p.x -= 2 * area
      if (p.x < -area) p.x += 2 * area
      if (p.z > area) p.z -= 2 * area
      if (p.z < -area) p.z += 2 * area
      wx = cx + p.x
      wz = cz + p.z
      const ground = center ? center[1] : terrainHeight(wx, wz)
      if (cy + p.y - 4 < ground) p.y = 8 + Math.random() * 3
      e.set(p.rx, p.ry, Math.sin(t + p.ph))
      q.setFromEuler(e)
      v.set(wx, cy + p.y - 4, wz)
      m4.compose(v, q, one)
      mesh.setMatrixAt(i, m4)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return <primitive object={mesh} />
}

export function Atmosphere() {
  const Q = QUALITY[useSettings((s) => s.quality)]
  return (
    <group>
      {Q.mist && <Mist />}
      <FallingLeaves count={Q.mist ? 160 : 70} />
      <Sparkles count={80} scale={[22, 3, 70]} position={[0, -1.2, 46]} size={4} speed={0.25} noise={1.5} color="#ffcf7a" opacity={0.85} />
      <Sparkles count={40} scale={[60, 4, 30]} position={[0, -1, 14]} size={3} speed={0.2} noise={1.2} color="#ffd890" opacity={0.6} />
      {DEER_SPOTS.map((d) => (
        <Deer key={d.seed} {...d} />
      ))}
    </group>
  )
}
