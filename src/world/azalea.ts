/**
 * Azalées satsuki taillées en coussins (o-karikomi), le long du soubassement de la façade.
 * Volume : le coussin bosselé, couvert d'une texture triplanaire de petites feuilles serrées
 * (relief, creux sombres entre les feuilles) ; par-dessus, des milliers de cartes de rameaux
 * feuillus posées sur la surface, qui donnent la profondeur et la frange d'une haie taillée.
 * La couleur vient de chaque coussin (vert, ou rougi par l'automne) sur des dessins en tons
 * clairs ; quelques feuilles rouges parsèment aussi les coussins verts. Pas de vent : taille serrée.
 */
import * as THREE from 'three'
import { rng } from '../core/math'
import { makeCanvas, ctx2d, normalFromHeight, toTexture } from '../textures/util'
import { dynamicTexture, cachedMaterial } from './assets'
import { TRIPLANAR } from './rocks'
import { cardMaterial, looseCardMesh, type TreeWind } from './cards'

/** Haie taillée : immobile, à peine un frémissement des feuilles. */
const STILL: TreeWind = [0, 1, 0.004]
/** Teintes de coussin (multipliées par des dessins clairs) : vert des satsuki, rouge d'automne. */
export const AZALEA_GREENS = [0x3f7a3a, 0x4a8740, 0x386e33, 0x55903f]
export const AZALEA_RED = 0xc0452c
const FLECK = new THREE.Color(0xa8452a)

/* ------------------------------ surface du coussin ------------------------------ */
let surface: { map: THREE.Texture; normal: THREE.Texture } | null = null

/** Feuilles elliptiques serrées, en niveaux de gris, raccordables (tuile de 45 cm). */
function leafSurface() {
  if (surface) return surface
  const S = 512
  const c = makeCanvas(S, S)
  const ctx = ctx2d(c)
  ctx.fillStyle = '#0e0e0e'
  ctx.fillRect(0, 0, S, S)
  const r = rng(2727)
  for (let i = 0; i < 950; i++) {
    const x = r() * S
    const y = r() * S
    const a = r() * Math.PI * 2
    const L = 26 + r() * 18
    const W = L * (0.4 + r() * 0.12)
    const v = 110 + Math.floor(r() * 120)
    // copies décalées près des bords : la tuile se raccorde sans couture
    for (const dx of x < L ? [0, S] : x > S - L ? [0, -S] : [0])
      for (const dy of y < L ? [0, S] : y > S - L ? [0, -S] : [0]) {
        ctx.save()
        ctx.translate(x + dx, y + dy)
        ctx.rotate(a)
        const g = ctx.createLinearGradient(-L / 2, 0, L / 2, 0)
        g.addColorStop(0, `rgb(${v * 0.7},${v * 0.7},${v * 0.7})`)
        g.addColorStop(0.6, `rgb(${v},${v},${v})`)
        g.addColorStop(1, `rgb(${v * 0.85},${v * 0.85},${v * 0.85})`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.ellipse(0, 0, L / 2, W / 2, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'
        ctx.lineWidth = 1.2
        ctx.stroke()
        ctx.strokeStyle = `rgba(255,255,255,0.18)`
        ctx.beginPath()
        ctx.moveTo(-L * 0.42, 0)
        ctx.lineTo(L * 0.42, 0)
        ctx.stroke()
        ctx.restore()
      }
  }
  const px = ctx.getImageData(0, 0, S, S).data
  const hm = new Float32Array(S * S)
  for (let i = 0; i < S * S; i++) hm[i] = px[i * 4] / 255
  surface = { map: toTexture(c), normal: toTexture(normalFromHeight(hm, S, S, 2.2), { srgb: false }) }
  return surface
}

/** Coussin : feuilles en projection triplanaire (albédo, relief « whiteout »), creux assombris. */
export function azaleaShellMaterial() {
  return cachedMaterial('azalea-shell-v1', () => {
    const { map, normal } = leafSurface()
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, envMapIntensity: 0.3 })
    const uniforms = { azMap: { value: map }, azNor: { value: normal }, azScale: { value: 1 / 0.45 } }
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms)
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAzPos;\nvarying vec3 vAzNor;').replace(
        '#include <project_vertex>',
        `#include <project_vertex>
{
  vec4 azW = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  azW = instanceMatrix * azW;
#endif
  vAzPos = (modelMatrix * azW).xyz;
  vAzNor = normalize((vec4(transformedNormal, 0.0) * viewMatrix).xyz);
}`,
      )
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nuniform sampler2D azMap, azNor;\nuniform float azScale;\nvarying vec3 vAzPos;\nvarying vec3 vAzNor;\n${TRIPLANAR}\nfloat azCav;`)
        .replace(
          '#include <map_fragment>',
          `{
  vec3 w = triW(normalize(vAzNor));
  azCav = tri(azMap, vAzPos * azScale, w).r;
  diffuseColor.rgb *= azCav * 1.25;
}`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `{
  vec3 wn = normalize(vAzNor);
  vec3 wN = triN(azNor, vAzPos * azScale, triW(wn), wn);
  normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
}`,
        )
        .replace(
          '#include <aomap_fragment>',
          `#include <aomap_fragment>
reflectedLight.indirectDiffuse *= mix(0.35, 1.0, smoothstep(0.05, 0.45, azCav));
reflectedLight.indirectSpecular *= smoothstep(0.05, 0.45, azCav);`,
        )
    }
    mat.customProgramCacheKey = () => 'azalea-shell-v1'
    return mat
  })
}

/* ------------------------------ atlas des rameaux ------------------------------ */
const LEAF = ['#aab89a', '#b6c3a4', '#c1ccb0', '#9fae8f', '#cbd4bb']

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.min(255, Math.round(v * f))
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`
}

/** Feuille d'azalée : elliptique, pointue, luisante (reflet le long d'un bord). */
function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, L: number, W: number, color: string, k: number) {
  const N = 14
  const half = (u: number) => W * 0.5 * Math.pow(Math.sin(Math.PI * u), 0.8) * (1 - 0.25 * u)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ang)
  ctx.beginPath()
  for (let i = 0; i <= N; i++) ctx.lineTo((i / N) * L, -half(i / N))
  for (let i = N; i >= 0; i--) ctx.lineTo((i / N) * L, half(i / N))
  ctx.closePath()
  const g = ctx.createLinearGradient(0, 0, L, 0)
  g.addColorStop(0, shade(color, 0.72))
  g.addColorStop(0.45, color)
  g.addColorStop(1, shade(color, 0.92))
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 1.4 * k
  ctx.beginPath()
  for (let i = 2; i <= N - 2; i++) ctx.lineTo((i / N) * L, -half(i / N) * 0.55)
  ctx.stroke()
  ctx.strokeStyle = shade(color, 1.15)
  ctx.lineWidth = 1 * k
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(L * 0.85, 0)
  ctx.stroke()
  ctx.restore()
}

/** Rameau taillé : rosettes de feuilles (comme en bout de pousse) le long d'une courte tige. */
function drawSprig(ctx: CanvasRenderingContext2D, ox: number, oy: number, S: number, r: () => number) {
  const k = S / 512
  const bx = ox + S * 0.5
  const by = oy + S * 0.96
  const tx = ox + S * (0.5 + (r() - 0.5) * 0.12)
  const ty = oy + S * 0.52
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#6f6a55'
  ctx.lineWidth = 4 * k
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(tx, ty)
  ctx.stroke()
  const rosettes = [
    { t: 0.45, n: 4, size: 0.2 },
    { t: 0.72, n: 5, size: 0.22 },
    { t: 1, n: 7, size: 0.26 },
  ]
  for (const ro of rosettes) {
    const px = bx + (tx - bx) * ro.t
    const py = by + (ty - by) * ro.t
    const a0 = r() * Math.PI * 2
    for (let j = 0; j < ro.n; j++) {
      const L = S * ro.size * (0.8 + r() * 0.3)
      drawLeaf(ctx, px, py, a0 + (j / ro.n) * Math.PI * 2 + (r() - 0.5) * 0.4, L, L * (0.38 + r() * 0.12), LEAF[Math.floor(r() * LEAF.length)], k)
    }
  }
}

export function azaleaAtlas() {
  return dynamicTexture('azalea-sprig-atlas-v1', () => {
    const S = 1024
    const c = makeCanvas(S, S)
    const ctx = ctx2d(c)
    ctx.clearRect(0, 0, S, S)
    const r = rng(6262)
    for (let q = 0; q < 4; q++) drawSprig(ctx, (q % 2) * 512 + 6, Math.floor(q / 2) * 512 + 6, 500, r)
    return c
  })
}

export const azaleaLeafMaterial = () =>
  cardMaterial('azalea-leaves-v1', azaleaAtlas(), STILL, { roughness: 0.72, envMapIntensity: 0.28, glow: 0.03, bend: 0.3 })

/* ------------------------------ cartes posées sur les coussins ------------------------------ */
export interface Cushion {
  m: THREE.Matrix4
  tint: THREE.Color
  autumn: boolean
}

/**
 * Rameaux feuillus répartis sur la surface de chaque coussin (tirage pondéré par l'aire, dessous
 * exclus), presque tangents à la surface. `density` réduit leur nombre selon le profil.
 */
export function azaleaCardMesh(geo: THREE.BufferGeometry, cushions: Cushion[], groundY: number, density = 1) {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const nor = geo.attributes.normal as THREE.BufferAttribute
  const index = geo.index!.array
  const r = rng(5353)
  const cards: THREE.Matrix4[] = []
  const colors: THREE.Color[] = []
  const cells: number[] = []
  const feet: number[] = []
  const nm = new THREE.Matrix3()
  const up = new THREE.Vector3(0, 1, 0)
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3()
  const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3()
  const cn = new THREE.Vector3(), t = new THREE.Vector3(), bx = new THREE.Vector3()
  const sizeK = 1 / Math.pow(density, 0.35)
  for (const cu of cushions) {
    nm.getNormalMatrix(cu.m)
    const center = new THREE.Vector3().setFromMatrixPosition(cu.m)
    // triangles du coussin en espace monde, aire cumulée
    const tris: number[] = []
    const cum: number[] = []
    let total = 0
    for (let i = 0; i < index.length; i += 3) {
      pa.fromBufferAttribute(pos, index[i]).applyMatrix4(cu.m)
      pb.fromBufferAttribute(pos, index[i + 1]).applyMatrix4(cu.m)
      pc.fromBufferAttribute(pos, index[i + 2]).applyMatrix4(cu.m)
      const n = new THREE.Vector3().subVectors(pb, pa).cross(new THREE.Vector3().subVectors(pc, pa))
      const area = n.length() / 2
      if (area < 1e-6) continue
      // dessous (tourné vers le sol ou enterré, invisible) exclu
      if (n.y / (2 * area) < -0.25 || (pa.y + pb.y + pc.y) / 3 < groundY + 0.03) continue
      total += area
      tris.push(i)
      cum.push(total)
    }
    const count = Math.round(total * 75 * density)
    for (let s = 0; s < count; s++) {
      // triangle tiré selon son aire (recherche dichotomique)
      const x = r() * total
      let lo = 0, hi = cum.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (cum[mid] < x) lo = mid + 1
        else hi = mid
      }
      const i = tris[lo]
      let u = r(), v = r()
      if (u + v > 1) (u = 1 - u), (v = 1 - v)
      pa.fromBufferAttribute(pos, index[i]).applyMatrix4(cu.m)
      pb.fromBufferAttribute(pos, index[i + 1]).applyMatrix4(cu.m)
      pc.fromBufferAttribute(pos, index[i + 2]).applyMatrix4(cu.m)
      na.fromBufferAttribute(nor, index[i]).applyMatrix3(nm)
      nb.fromBufferAttribute(nor, index[i + 1]).applyMatrix3(nm)
      nc.fromBufferAttribute(nor, index[i + 2]).applyMatrix3(nm)
      const p = pa.clone().multiplyScalar(1 - u - v).addScaledVector(pb, u).addScaledVector(pc, v)
      const n = na.clone().multiplyScalar(1 - u - v).addScaledVector(nb, u).addScaledVector(nc, v).normalize()
      if (p.y < groundY + 0.04) continue
      p.addScaledVector(n, 0.02)
      // carte presque tangente, rameau pointant vers l'extérieur et un peu vers le haut
      cn.copy(n).add(new THREE.Vector3((r() - 0.5) * 0.8, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8)).normalize()
      t.set(r() - 0.5, r() - 0.5, r() - 0.5).addScaledVector(up, 0.4)
      t.addScaledVector(cn, -t.dot(cn))
      if (t.lengthSq() < 1e-4) t.set(1, 0, 0).addScaledVector(cn, -cn.x)
      t.normalize()
      bx.crossVectors(t, cn).normalize()
      const size = (0.15 + r() * 0.07) * sizeK
      cards.push(new THREE.Matrix4().makeBasis(bx, t, cn).scale(new THREE.Vector3(size, size, size)).setPosition(p))
      // dessus plus clair ; quelques feuilles rougies sur les coussins verts
      const b = 0.75 + 0.22 * Math.max(0, n.y) + (r() - 0.5) * 0.12
      const base = !cu.autumn && r() < 0.035 ? FLECK : cu.tint
      colors.push(base.clone().multiplyScalar(b))
      const c = Math.floor(r() * 4)
      cells.push((c % 2) * 0.5, Math.floor(c / 2) * 0.5)
      feet.push(center.x, groundY, center.z, 1)
    }
  }
  return looseCardMesh({ cards, colors, cells }, feet, azaleaLeafMaterial())
}
