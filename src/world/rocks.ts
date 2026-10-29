/**
 * Pierres organiques procédurales (jardin sec, berges, pas japonais) :
 * icosaèdre subdivisé, plans de clivage (facettes de pierre fendue), bruit 3D multi-octave,
 * fissures (bruit « ridged »), base aplatie. Chaque sommet porte une occlusion (creux, fissures)
 * et un masque de fissure, lus par le matériau triplanaire (aucune couture d'UV).
 * L'empreinte au sol de chaque pierre est mesurée pour que le sable ratissé la contourne.
 */
import * as THREE from 'three'
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { rng } from '../core/math'
import { PBR, PBR_SIZE } from './pbr'
import { T } from './assets'

/* ------------------------------ bruit 3D ------------------------------ */
function makeNoise3(seed: number) {
  const r = rng(seed)
  const perm = new Uint8Array(512)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
  const G = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1],
    [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
  ]
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const grad = (h: number, x: number, y: number, z: number) => {
    const g = G[h % 12]
    return g[0] * x + g[1] * y + g[2] * z
  }
  const noise = (x: number, y: number, z: number) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z)
    x -= X; y -= Y; z -= Z
    const xi = X & 255, yi = Y & 255, zi = Z & 255
    const u = fade(x), v = fade(y), w = fade(z)
    const a = perm[xi] + yi, aa = perm[a] + zi, ab = perm[a + 1] + zi
    const b = perm[xi + 1] + yi, ba = perm[b] + zi, bb = perm[b + 1] + zi
    const l = (t: number, p0: number, p1: number) => p0 + t * (p1 - p0)
    return l(w,
      l(v, l(u, grad(perm[aa], x, y, z), grad(perm[ba], x - 1, y, z)), l(u, grad(perm[ab], x, y - 1, z), grad(perm[bb], x - 1, y - 1, z))),
      l(v, l(u, grad(perm[aa + 1], x, y, z - 1), grad(perm[ba + 1], x - 1, y, z - 1)), l(u, grad(perm[ab + 1], x, y - 1, z - 1), grad(perm[bb + 1], x - 1, y - 1, z - 1))),
    )
  }
  const fbm = (x: number, y: number, z: number, oct: number) => {
    let s = 0, a = 0.5, f = 1
    for (let i = 0; i < oct; i++) {
      s += a * noise(x * f, y * f, z * f)
      f *= 2.03
      a *= 0.5
    }
    return s
  }
  return { noise, fbm }
}

export type RockKind = 'tate' | 'hira' | 'fuse' | 'step' | 'rim'

const SHAPE: Record<RockKind, { sc: [number, number, number]; cuts: number; rough: number; crack: number; bury: number }> = {
  tate: { sc: [0.62, 0.82, 0.52], cuts: 7, rough: 0.16, crack: 1, bury: 0.14 }, // pierre dressée
  hira: { sc: [0.9, 0.34, 0.72], cuts: 6, rough: 0.12, crack: 0.8, bury: 0.08 }, // pierre plate
  fuse: { sc: [0.82, 0.55, 0.52], cuts: 7, rough: 0.15, crack: 1, bury: 0.12 }, // pierre couchée
  step: { sc: [1, 0.22, 0.85], cuts: 5, rough: 0.06, crack: 0.35, bury: 0.05 }, // pas japonais (dessus usé, plat)
  rim: { sc: [0.8, 0.5, 0.62], cuts: 6, rough: 0.14, crack: 0.7, bury: 0.12 }, // margelle du bassin
}

export interface RockGeo {
  geometry: THREE.BufferGeometry
  /** rayon de l'empreinte au sol (y ≈ 0) par secteur de 10°, dans le repère de la pierre */
  footprint: Float32Array
  height: number
}

/** Fabrique une pierre d'environ `size` m de large, posée sur y = 0 (base enterrée). */
export function rockGeometry(seed: number, kind: RockKind, size: number, detail: number): RockGeo {
  const cfg = SHAPE[kind]
  const r = rng(seed * 7919 + 13)
  const N = makeNoise3(seed)
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g)
  const pos = g.attributes.position as THREE.BufferAttribute
  // plans de clivage : facettes nettes de pierre fendue (jamais sous la base)
  const cuts: { n: THREE.Vector3; d: number }[] = []
  for (let i = 0; i < cfg.cuts; i++) {
    const n = new THREE.Vector3(r() * 2 - 1, r() * 1.3 - 0.25, r() * 2 - 1).normalize()
    cuts.push({ n, d: 0.6 + r() * 0.28 })
  }
  if (kind === 'step' || kind === 'hira') cuts.push({ n: new THREE.Vector3(0, 1, 0), d: 0.55 + r() * 0.1 })
  const sx = cfg.sc[0] * (0.9 + r() * 0.2)
  const sy = cfg.sc[1] * (0.9 + r() * 0.2)
  const sz = cfg.sc[2] * (0.9 + r() * 0.2)
  const crackField = new Float32Array(pos.count)
  const v = new THREE.Vector3()
  const ox = r() * 50, oy = r() * 50, oz = r() * 50
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    for (const c of cuts) {
      const t = v.dot(c.n) - c.d
      if (t > 0) v.addScaledVector(c.n, -t * 0.9)
    }
    const dir = v.clone().normalize()
    // déformation de grande échelle (gauchissement), puis détail
    const wx = dir.x * 1.3 + ox, wy = dir.y * 1.3 + oy, wz = dir.z * 1.3 + oz
    const warp = N.fbm(wx, wy, wz, 2) * 0.6
    let disp = N.fbm(wx + warp, wy + warp, wz, 4) * cfg.rough * 2.2
    disp += N.fbm(dir.x * 7 + ox, dir.y * 7, dir.z * 7 + oz, 3) * 0.035
    // fissures : creux étroits là où le bruit ridged s'annule
    const ridged = 1 - Math.abs(N.noise(dir.x * 3.1 + oz + warp, dir.y * 3.1 + ox, dir.z * 3.1 + oy))
    const crack = Math.max(0, (ridged - 0.93) / 0.07) * cfg.crack
    disp -= crack * 0.05
    crackField[i] = crack
    v.addScaledVector(dir, disp)
    v.set(v.x * sx, v.y * sy, v.z * sz)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  // posée au sol : base aplatie puis remontée pour n'enterrer que `bury` de la hauteur
  g.computeBoundingBox()
  let bb = g.boundingBox!
  const cutY = bb.min.y + (bb.max.y - bb.min.y) * 0.22
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < cutY) pos.setY(i, cutY - (cutY - pos.getY(i)) * 0.15)
  g.computeBoundingBox()
  bb = g.boundingBox!
  const span = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z)
  const k = size / span
  const lift = -bb.min.y - (bb.max.y - bb.min.y) * cfg.bury
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * k, (pos.getY(i) + lift) * k, pos.getZ(i) * k)
  g.computeVertexNormals()
  // occlusion par sommet : creux (laplacien) + fissures + pied plus sombre
  const idx = g.index!
  const sum = new Float32Array(pos.count * 3)
  const cnt = new Uint16Array(pos.count)
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2)
    for (const [p, q] of [[a, b], [b, c], [c, a], [b, a], [c, b], [a, c]]) {
      sum[p * 3] += pos.getX(q)
      sum[p * 3 + 1] += pos.getY(q)
      sum[p * 3 + 2] += pos.getZ(q)
      cnt[p]++
    }
  }
  const nor = g.attributes.normal as THREE.BufferAttribute
  const attr = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const n = cnt[i] || 1
    const dx = sum[i * 3] / n - pos.getX(i)
    const dy = sum[i * 3 + 1] / n - pos.getY(i)
    const dz = sum[i * 3 + 2] / n - pos.getZ(i)
    const concave = (dx * nor.getX(i) + dy * nor.getY(i) + dz * nor.getZ(i)) / (size * 0.02)
    const foot = THREE.MathUtils.smoothstep(pos.getY(i), -0.02, 0.12 * size)
    const ao = THREE.MathUtils.clamp(1 - Math.max(0, concave) * 0.55 - crackField[i] * 0.45, 0.25, 1) * (0.72 + 0.28 * foot)
    attr[i * 2] = ao
    attr[i * 2 + 1] = crackField[i]
  }
  g.setAttribute('aRock', new THREE.BufferAttribute(attr, 2))
  // empreinte au sol (sommets proches de y = 0)
  const footprint = new Float32Array(36)
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0.06 * size) continue
    const a = Math.atan2(pos.getZ(i), pos.getX(i))
    const s = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 36) % 36
    footprint[s] = Math.max(footprint[s], Math.hypot(pos.getX(i), pos.getZ(i)))
  }
  for (let s = 0; s < 36; s++) if (!footprint[s]) footprint[s] = Math.max(footprint[(s + 35) % 36], footprint[(s + 1) % 36], size * 0.3)
  return { geometry: g, footprint, height: bb.max.y * k + lift * k }
}

/** Rayon de l'empreinte dans la direction (dx, dz) d'une pierre tournée de `ry`. */
export function footprintRadius(fp: Float32Array, dx: number, dz: number, ry: number) {
  // repère local : rotation inverse autour de y
  const c = Math.cos(ry), s = Math.sin(ry)
  const lx = c * dx - s * dz
  const lz = s * dx + c * dz
  const a = Math.atan2(lz, lx)
  const f = ((a + Math.PI) / (Math.PI * 2)) * 36 - 0.5
  const i0 = (Math.floor(f) + 36) % 36
  const t = f - Math.floor(f)
  return fp[i0] * (1 - t) + fp[(i0 + 1) % 36] * t
}

/** Fusionne des pierres placées (une seule passe de rendu, ombres comprises). */
export function mergeRocks(items: { geo: THREE.BufferGeometry; x: number; y: number; z: number; ry: number; s?: number }[]) {
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const geos = items.map((it) => {
    const g = it.geo.clone()
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.ry)
    m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s ?? 1, it.s ?? 1, it.s ?? 1))
    g.applyMatrix4(m)
    return g
  })
  const out = mergeGeometries(geos, false)!
  geos.forEach((g) => g.dispose())
  out.computeBoundingSphere()
  return out
}

/* --------------------------- matériau triplanaire --------------------------- */
/** Projection triplanaire : poids, lecture, et normales mêlées en « whiteout » (Ben Golus). */
export const TRIPLANAR = /* glsl */ `
vec3 triW(vec3 n) { vec3 w = pow(abs(n), vec3(4.0)); return w / (w.x + w.y + w.z); }
vec4 tri(sampler2D s, vec3 p, vec3 w) {
  return texture(s, p.zy) * w.x + texture(s, p.xz) * w.y + texture(s, p.xy) * w.z;
}
vec3 triN(sampler2D s, vec3 p, vec3 w, vec3 n) {
  vec3 tx = texture(s, p.zy).xyz * 2.0 - 1.0;
  vec3 ty = texture(s, p.xz).xyz * 2.0 - 1.0;
  vec3 tz = texture(s, p.xy).xyz * 2.0 - 1.0;
  tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
  ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
  tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
  return normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z);
}
`

export interface RockLook {
  color?: THREE.ColorRepresentation
  moss?: number
  wet?: number
  scale?: number
}

/**
 * Pierre PBR en projection triplanaire (albédo, normale « whiteout », ARM), mousse sur les faces
 * tournées vers le ciel, fissures assombries, occlusion par sommet. Repli procédural en profil Bas.
 */
export function rockMaterial(look: RockLook = {}) {
  const lib = PBR()
  const rock = lib.lichen_rock
  const moss = lib.mossy_rock
  const t = T()
  // repli procédural (profil Bas) : la texture claire de pierre est ramenée à un granit patiné
  const mat = new THREE.MeshStandardMaterial({ color: look.color ?? (rock ? 0xffffff : 0x8f897d), roughness: 1, metalness: 0 })
  const uniforms = {
    rkMap: { value: rock?.map ?? t.stone },
    rkNor: { value: rock?.normalMap ?? t.stoneN },
    rkArm: { value: rock?.arm ?? null },
    msMap: { value: moss?.map ?? t.stone },
    msNor: { value: moss?.normalMap ?? t.stoneN },
    rkScale: { value: 1 / ((look.scale ?? 1) * (rock ? PBR_SIZE.lichen_rock : 1.6)) },
    msScale: { value: 1 / (moss ? PBR_SIZE.mossy_rock * 0.5 : 1.6) },
    mossAmt: { value: look.moss ?? 0.6 },
    wetAmt: { value: look.wet ?? 0 },
  }
  const hasArm = !!rock
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aRock;\nvarying vec3 vWPos;\nvarying vec3 vWNor;\nvarying vec2 vRock;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNor = normalize(mat3(modelMatrix) * objectNormal);\nvRock = aRock;',
      )
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D rkMap, rkNor, rkArm, msMap, msNor;
uniform float rkScale, msScale, mossAmt, wetAmt;
varying vec3 vWPos;
varying vec3 vWNor;
varying vec2 vRock;
float rkHash(vec3 p) { return fract(sin(dot(p, vec3(17.1, 113.7, 41.3))) * 43758.5453); }
float rkNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rkHash(i), rkHash(i + vec3(1,0,0)), f.x), mix(rkHash(i + vec3(0,1,0)), rkHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(rkHash(i + vec3(0,0,1)), rkHash(i + vec3(1,0,1)), f.x), mix(rkHash(i + vec3(0,1,1)), rkHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
${TRIPLANAR}
float rkMoss;`,
      )
      .replace(
        '#include <map_fragment>',
        `{
  vec3 wn = normalize(vWNor);
  vec3 w = triW(wn);
  vec3 p = vWPos * rkScale;
  vec3 alb = tri(rkMap, p, w).rgb;
  float n1 = rkNoise(vWPos * 2.3) * 0.6 + rkNoise(vWPos * 7.0) * 0.4;
  rkMoss = smoothstep(0.42, 0.78, wn.y + (n1 - 0.5) * 0.55 + (1.0 - vRock.x) * 0.25) * mossAmt * (1.0 - vRock.y);
  vec3 moss = texture(msMap, vWPos.xz * msScale).rgb;
  alb = mix(alb, moss * vec3(0.9, 1.0, 0.8), rkMoss);
  alb *= mix(1.0, 0.55, vRock.y);
  alb *= mix(1.0, 0.62, wetAmt * smoothstep(0.25, 0.0, vWPos.y));
  diffuseColor.rgb *= alb;
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = roughness;
${hasArm ? '{ vec3 w = triW(normalize(vWNor)); roughnessFactor *= tri(rkArm, vWPos * rkScale, w).g; }' : 'roughnessFactor *= 0.85;'}
roughnessFactor = mix(roughnessFactor, 0.95, rkMoss);
roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.45, wetAmt * smoothstep(0.25, 0.0, vWPos.y));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `{
  vec3 wn = normalize(vWNor);
  vec3 w = triW(wn);
  vec3 nr = triN(rkNor, vWPos * rkScale, w, wn);
  vec3 nm = triN(msNor, vWPos * msScale, w, wn);
  vec3 wN = normalize(mix(nr, nm, rkMoss * 0.7));
  normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
}`,
      )
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
{
  float ao = vRock.x${hasArm ? ' * tri(rkArm, vWPos * rkScale, triW(normalize(vWNor))).r' : ''};
  reflectedLight.indirectDiffuse *= ao;
  reflectedLight.indirectSpecular *= ao;
  reflectedLight.directDiffuse *= mix(1.0, ao, 0.5);
}`,
      )
  }
  mat.customProgramCacheKey = () => `rock-tri-${hasArm}`
  return mat
}
