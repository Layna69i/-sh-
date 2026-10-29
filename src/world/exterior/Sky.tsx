/**
 * Ciel de crépuscule procédural (dégradé, soleil couchant, nuages, étoiles)
 * et silhouettes de montagnes lointaines.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { SUN_DIR } from '../Lighting'
import { worldNoise } from '../../core/noise'

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // toujours au fond
}`

const frag = /* glsl */ `
varying vec3 vDir;
uniform vec3 sunDir;
uniform float time;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
  return s;
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float sunAmt = max(dot(d, sunDir), 0.0);
  vec3 zenith = vec3(0.055, 0.05, 0.13);
  vec3 mid = vec3(0.26, 0.12, 0.25);
  vec3 low = vec3(0.62, 0.24, 0.2);
  vec3 horizon = vec3(0.95, 0.46, 0.2);
  vec3 col = mix(horizon, low, smoothstep(0.0, 0.08, h));
  col = mix(col, mid, smoothstep(0.06, 0.3, h));
  col = mix(col, zenith, smoothstep(0.25, 0.85, h));
  // halo du soleil couchant
  float glow = pow(sunAmt, 5.0);
  col += vec3(1.0, 0.42, 0.14) * glow * 0.75 * (1.0 - smoothstep(0.0, 0.6, h));
  col += vec3(1.0, 0.6, 0.3) * pow(sunAmt, 60.0) * 0.8;
  col += vec3(1.0, 0.8, 0.55) * smoothstep(0.9991, 0.9996, sunAmt) * 6.0;
  // nuages stratifiés
  vec2 uv = d.xz / (max(h, 0.02) + 0.18) * 0.55;
  uv += vec2(time * 0.004, time * 0.001);
  float c = fbm(uv * 2.2) * 0.75 + fbm(uv * 6.0 + 3.0) * 0.25;
  float band = smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.35, 0.7, h));
  float clouds = smoothstep(0.5, 0.78, c) * band;
  vec3 lit = mix(vec3(0.22, 0.1, 0.2), vec3(1.0, 0.5, 0.25), pow(sunAmt, 2.5));
  vec3 rim = vec3(1.0, 0.65, 0.35) * pow(sunAmt, 8.0) * smoothstep(0.55, 0.7, c);
  col = mix(col, lit * (0.7 + 0.5 * c), clouds * 0.85) + rim * band * 0.6;
  // étoiles naissantes
  vec2 sp = d.xz / (h + 1.0) * 220.0;
  float star = step(0.9965, hash(floor(sp))) * smoothstep(0.35, 0.8, h);
  col += vec3(0.8, 0.8, 1.0) * star * (0.4 + 0.6 * noise(sp + time));
  // sous l'horizon
  col = mix(col, vec3(0.09, 0.06, 0.09), smoothstep(0.0, -0.08, h));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { sunDir: { value: SUN_DIR.clone() }, time: { value: 0 } },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  )
  useFrame((s) => (mat.uniforms.time.value = s.clock.elapsedTime))
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[800, 32, 16]} />
    </mesh>
  )
}

function ridgeRing(radius: number, base: number, amp: number, seed: number) {
  const seg = 256
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2
    const t = i / seg
    const n = worldNoise.fbm(Math.cos(a) * 2 + seed, Math.sin(a) * 2 + seed, 5)
    const ridge = 1 - Math.abs(worldNoise.noise(t * 14 + seed, seed))
    const h = base + amp * (0.5 + n) + amp * 0.5 * ridge * ridge
    const x = Math.sin(a) * radius
    const z = Math.cos(a) * radius
    pos.push(x, -40, z, x, h, z)
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return g
}

export function Mountains() {
  const layers = useMemo(
    () => [
      { g: ridgeRing(520, 30, 70, 3.3), c: new THREE.Color(0x2a1c2c) },
      { g: ridgeRing(380, 12, 45, 9.1), c: new THREE.Color(0x1b1520) },
      { g: ridgeRing(260, 4, 26, 17.7), c: new THREE.Color(0x121014) },
    ],
    [],
  )
  return (
    <group>
      {layers.map((l, i) => (
        <mesh key={i} geometry={l.g} renderOrder={-9} frustumCulled={false}>
          <meshBasicMaterial color={l.c} fog={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}
