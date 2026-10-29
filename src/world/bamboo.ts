/**
 * Bambou madake (Phyllostachys) procédural, pour le bosquet de la façade.
 * Chaumes : tubes effilés à nœuds saillants (cicatrice de gaine, bourrelet, bande de cire claire
 * sous chaque nœud) ; entre-nœuds courts au pied, longs au milieu, de nouveau courts en tête ;
 * légèrement penchés vers l'extérieur de la touffe et arqués au sommet sous le poids des feuilles.
 * Rameaux : par paires (un fort, un faible) aux nœuds de la moitié haute, alternés d'un nœud à
 * l'autre. Feuilles : cartes portant des éventails de feuilles lancéolées dessinées une à une sur
 * un atlas. Chaumes, rameaux et feuilles partagent le même vent (voir cards.ts).
 */
import * as THREE from 'three'
import { rng } from '../core/math'
import { makeCanvas, ctx2d } from '../textures/util'
import { dynamicTexture, cachedMaterial } from './assets'
import { cardMaterial, cardMesh, windy, type CardSet, type TreeWind } from './cards'

/** Hauteur de référence du gabarit (m) : le vent est proportionnel à la hauteur relative. */
export const BAMBOO_H = 10
/** Le bambou ploie plus que la cryptomère et ses feuilles frémissent davantage. */
const BAMBOO_WIND: TreeWind = [0.34, 1.3, 0.06]

/* ------------------------------ géométrie ------------------------------ */
interface Tube {
  pts: THREE.Vector3[]
  radii: number[]
  /** valeur de nœud de chaque anneau (n° de nœud + fraction de l'entre-nœud) : le shader en tire
   *  les bandes ; 0,5 constant pour les rameaux (aucune bande) */
  nodes: number[]
  colors: THREE.Color[]
  radial: number
}

function tubesGeometry(tubes: Tube[]) {
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  const culm: number[] = []
  const idx: number[] = []
  const T = new THREE.Vector3()
  const N = new THREE.Vector3()
  const B = new THREE.Vector3()
  const prevT = new THREE.Vector3()
  const ax = new THREE.Vector3()
  for (const { pts, radii, nodes, colors, radial } of tubes) {
    const base = pos.length / 3
    for (let i = 0; i < pts.length; i++) {
      T.subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize()
      if (i === 0) {
        N.set(0, 1, 0)
        if (Math.abs(T.dot(N)) > 0.9) N.set(1, 0, 0)
        N.crossVectors(T, N).normalize()
      } else {
        // transport parallèle du repère
        ax.crossVectors(prevT, T)
        const s = ax.length()
        if (s > 1e-5) N.applyAxisAngle(ax.normalize(), Math.asin(Math.min(1, s)))
      }
      prevT.copy(T)
      B.crossVectors(T, N).normalize()
      for (let k = 0; k <= radial; k++) {
        const a = (k / radial) * Math.PI * 2
        const c = Math.cos(a), s = Math.sin(a)
        const nx = N.x * c + B.x * s, ny = N.y * c + B.y * s, nz = N.z * c + B.z * s
        pos.push(pts[i].x + nx * radii[i], pts[i].y + ny * radii[i], pts[i].z + nz * radii[i])
        nor.push(nx, ny, nz)
        col.push(colors[i].r, colors[i].g, colors[i].b)
        culm.push(k / radial, nodes[i])
      }
      if (i > 0) {
        const r0 = base + (i - 1) * (radial + 1)
        const r1 = base + i * (radial + 1)
        for (let k = 0; k < radial; k++) idx.push(r0 + k, r0 + k + 1, r1 + k, r0 + k + 1, r1 + k + 1, r1 + k)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('aCulm', new THREE.Float32BufferAttribute(culm, 2))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

/** Point d'une polyligne à la fraction `s` de ses segments. */
function pointOn(pts: THREE.Vector3[], s: number) {
  const f = Math.min(pts.length - 1.0001, s * (pts.length - 1))
  const i = Math.floor(f)
  return pts[i].clone().lerp(pts[i + 1], f - i)
}

/* ------------------------------ atlas des éventails ------------------------------ */
const LEAF = ['#3a5f25', '#456e2c', '#507b33', '#5d893a', '#6a9642', '#789f46']

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.min(255, Math.round(v * f))
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`
}

/** Feuille lancéolée (limbe large au quart, longue pointe effilée), posée le long de +x. */
function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, L: number, W: number, color: string, k: number, r: () => number) {
  const bend = (r() - 0.5) * 0.24 * L
  const dry = r() < 0.16
  const mid = (u: number) => bend * u * u
  const half = (u: number) => W * 0.725 * Math.pow(u, 0.5) * Math.pow(1 - u, 1.3)
  const N = 20
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ang)
  // pétiole
  ctx.strokeStyle = shade(color, 0.8)
  ctx.lineWidth = 1.6 * k
  ctx.beginPath()
  ctx.moveTo(-0.07 * L, 0)
  ctx.lineTo(0.02 * L, 0)
  ctx.stroke()
  // limbe
  ctx.beginPath()
  for (let i = 0; i <= N; i++) ctx.lineTo((i / N) * L, mid(i / N) - half(i / N))
  for (let i = N; i >= 0; i--) ctx.lineTo((i / N) * L, mid(i / N) + half(i / N))
  ctx.closePath()
  const g = ctx.createLinearGradient(0, 0, L, 0)
  g.addColorStop(0, shade(color, 0.78))
  g.addColorStop(0.35, color)
  if (dry) {
    // pointe desséchée, comme sur les bambous en fin de saison
    g.addColorStop(0.7, shade(color, 1.08))
    g.addColorStop(0.86, '#b4a25e')
    g.addColorStop(1, '#9c8a4e')
  } else g.addColorStop(1, shade(color, 1.12))
  ctx.fillStyle = g
  ctx.fill()
  // moitié supérieure un peu plus claire : le limbe se plie légèrement sur la nervure
  ctx.beginPath()
  for (let i = 0; i <= N; i++) ctx.lineTo((i / N) * L, mid(i / N) - half(i / N))
  for (let i = N; i >= 0; i--) ctx.lineTo((i / N) * L, mid(i / N))
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,255,225,0.10)'
  ctx.fill()
  // nervure centrale et nervures parallèles
  ctx.strokeStyle = shade(color, 1.25)
  ctx.lineWidth = 1.1 * k
  ctx.beginPath()
  for (let i = 0; i <= N * 0.92; i++) ctx.lineTo((i / N) * L, mid(i / N))
  ctx.stroke()
  ctx.strokeStyle = 'rgba(20,40,10,0.18)'
  ctx.lineWidth = 0.7 * k
  for (const s of [-0.5, 0.5]) {
    ctx.beginPath()
    for (let i = 2; i <= N * 0.85; i++) ctx.lineTo((i / N) * L, mid(i / N) + s * half(i / N))
    ctx.stroke()
  }
  ctx.restore()
}

/** Rameau feuillé : deux bouquets latéraux puis l'éventail terminal, partant du bas de la case. */
function drawFan(ctx: CanvasRenderingContext2D, ox: number, oy: number, S: number, r: () => number) {
  const k = S / 512
  const ax = ox + S * 0.5
  const ay = oy + S * 0.95
  const tipY = oy + S * (0.5 + r() * 0.06)
  const lean = (r() - 0.5) * S * 0.14
  const twig: [number, number][] = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    twig.push([ax + lean * t * t, ay + (tipY - ay) * t])
  }
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#56632f'
  ctx.lineWidth = 2.6 * k
  ctx.beginPath()
  twig.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.stroke()
  const at = (t: number) => {
    const f = t * 12
    const i = Math.min(11, Math.floor(f))
    const [x0, y0] = twig[i]
    const [x1, y1] = twig[i + 1]
    return { x: x0 + (x1 - x0) * (f - i), y: y0 + (y1 - y0) * (f - i), a: Math.atan2(y1 - y0, x1 - x0) }
  }
  const side = r() < 0.5 ? -1 : 1
  const clusters = [
    { t: 0.38, n: 2, side, open: 0.95, L: 0.3, dark: 0 },
    { t: 0.66, n: 2 + (r() < 0.5 ? 1 : 0), side: -side, open: 0.75, L: 0.34, dark: 1 },
    { t: 1, n: 4 + Math.floor(r() * 2), side: 0, open: 1.1, L: 0.4, dark: 2 },
  ]
  for (const cl of clusters) {
    const p = at(cl.t)
    const leaves: { a: number; o: number }[] = []
    for (let j = 0; j < cl.n; j++) {
      // bouquet latéral : feuilles écartées d'un côté ; éventail terminal : réparties de part et d'autre
      const o = cl.side ? cl.side * (cl.open + j * 0.28) : (j / (cl.n - 1) - 0.5) * 2 * cl.open
      leaves.push({ a: p.a + o + (r() - 0.5) * 0.18, o: Math.abs(o) })
    }
    // les plus écartées d'abord : les feuilles centrales passent devant
    leaves.sort((u, v) => v.o - u.o)
    for (const lf of leaves) {
      const L = S * cl.L * (0.85 + r() * 0.3)
      const ci = Math.min(LEAF.length - 1, Math.floor(r() * 3.2) + cl.dark)
      drawLeaf(ctx, p.x, p.y, lf.a, L, L * (0.15 + r() * 0.04), LEAF[ci], k, r)
    }
  }
}

export function bambooAtlas() {
  return dynamicTexture('bamboo-fan-atlas-v1', () => {
    const S = 1024
    const c = makeCanvas(S, S)
    const ctx = ctx2d(c)
    ctx.clearRect(0, 0, S, S)
    const r = rng(7373)
    for (let q = 0; q < 4; q++) drawFan(ctx, (q % 2) * 512 + 6, Math.floor(q / 2) * 512 + 6, 500, r)
    return c
  })
}

/* ------------------------------ gabarit d'une touffe ------------------------------ */
export interface BambooTemplate extends CardSet {
  wood: THREE.BufferGeometry
}

/** Teintes de chaume : vert franc des jeunes tiges, vert-jaune des plus âgées. */
const CULM = [0x5d8a3a, 0x527f35, 0x67903f, 0x7a8f45, 0x4b7531]
const CULM_FOOT = new THREE.Color(0x4a4528)
const CULM_TOP = new THREE.Color(0x6f9a3c)
const TWIG = new THREE.Color(0x6b7438)

/**
 * Touffe de 5 à 7 chaumes. `density` réduit le nombre d'éventails selon le profil graphique
 * (les éventails restants grandissent un peu pour garder le même volume) ; `fine` : chaumes à
 * 8 côtés et bourrelets modelés aux nœuds (sinon 6 côtés, nœuds dessinés par le shader seul).
 */
export function bambooClump(seed: number, density = 1, fine = true): BambooTemplate {
  const r = rng(seed * 53 + 7)
  const tubes: Tube[] = []
  const cards: THREE.Matrix4[] = []
  const colors: THREE.Color[] = []
  const cells: number[] = []
  const up = new THREE.Vector3(0, 1, 0)
  const n = new THREE.Vector3()
  const bx = new THREE.Vector3()
  const by = new THREE.Vector3()
  const sizeK = 1 / Math.pow(density, 0.35)
  /** Éventail en `p`, orienté selon `dir` ; à plat (nappe vue d'en dessous) ou de chant (volume). */
  const fan = (p: THREE.Vector3, dir: THREE.Vector3, size: number, flat: boolean) => {
    if (flat) n.set((r() - 0.5) * 0.8, 1, (r() - 0.5) * 0.8).addScaledVector(dir, -0.25).normalize()
    else {
      n.crossVectors(dir, up)
      if (n.lengthSq() < 1e-4) n.set(1, 0, 0)
      n.normalize().applyAxisAngle(dir, (r() - 0.5) * 0.9)
    }
    by.copy(dir).addScaledVector(n, -dir.dot(n))
    if (by.lengthSq() < 1e-4) by.set(1, 0, 0).addScaledVector(n, -n.x)
    by.normalize()
    bx.crossVectors(by, n).normalize()
    const s = size * sizeK
    cards.push(new THREE.Matrix4().makeBasis(bx, by, n).scale(new THREE.Vector3(s, s, s)).setPosition(p))
    // plus clair et plus jaune en tête (lumière du ciel), quelques éventails jaunissants
    const b = 0.74 + 0.3 * (p.y / BAMBOO_H) + (r() - 0.5) * 0.16
    const yl = r() < 0.12 ? 1.1 : 1
    colors.push(new THREE.Color().setRGB(b * (0.95 + r() * 0.06) * yl, b, (b * (0.86 + r() * 0.08)) / yl))
    const c = Math.floor(r() * 4)
    cells.push((c % 2) * 0.5, Math.floor(c / 2) * 0.5)
  }

  const nc = 5 + Math.floor(r() * 3)
  const az0 = r() * Math.PI * 2
  for (let ci = 0; ci < nc; ci++) {
    const a = az0 + (ci / nc) * Math.PI * 2 + (r() - 0.5) * 0.8
    const o = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
    const foot = o.clone().multiplyScalar(0.12 + Math.sqrt(r()) * 0.45)
    const h = 6.8 + r() * 2.8
    const rad0 = 0.042 + r() * 0.018
    const lean = 0.025 + r() * 0.04
    const archDir = o.clone().applyAxisAngle(up, (r() - 0.5) * 1.4)
    const arch = (0.35 + r() * 0.7) * (h / 9)
    const axisAt = (y: number) => {
      const t = Math.max(0, y) / h
      return foot.clone().addScaledVector(o, lean * y).addScaledVector(archDir, arch * t * t * t).setY(y - arch * 0.35 * t ** 4)
    }
    const radAt = (y: number) => rad0 * (1 - 0.62 * Math.pow(Math.max(0, y) / h, 2.2))
    const base = new THREE.Color(CULM[Math.floor(r() * CULM.length)])
    const colorAt = (y: number) => {
      const c = base.clone()
      if (y < 0.5) c.lerp(CULM_FOOT, (1 - Math.max(0, y) / 0.5) * 0.6)
      if (y / h > 0.7) c.lerp(CULM_TOP, (y / h - 0.7) * 0.5)
      return c
    }
    // nœuds : entre-nœuds courts au pied, ~40 cm au milieu, une dizaine de cm en tête
    const ny: number[] = []
    for (let y = 0.05 + r() * 0.04; y < h - 0.08; ) {
      ny.push(y)
      const t = y / h
      y += (0.09 + 0.3 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.12 + 0.05)), 0.65)) * (0.9 + r() * 0.2)
    }
    // anneaux : bourrelet à chaque nœud, anneaux serrés de part et d'autre, milieu des longs entre-nœuds
    const pts: THREE.Vector3[] = []
    const radii: number[] = []
    const nodes: number[] = []
    const ringColors: THREE.Color[] = []
    const ring = (y: number, v: number, bulge = 1) => {
      pts.push(axisAt(y))
      radii.push(radAt(y) * bulge)
      nodes.push(v)
      ringColors.push(colorAt(y))
    }
    ring(-0.12, 0.5)
    ny.forEach((y, j) => {
      const below = j ? y - ny[j - 1] : y + 0.12
      const above = (j + 1 < ny.length ? ny[j + 1] : h) - y
      if (!fine) ring(y, j + 1)
      else {
        const gb = Math.min(0.012, below * 0.15)
        const ga = Math.min(0.012, above * 0.15)
        ring(y - gb, j + 1 - gb / below / (j ? 1 : 2))
        ring(y, j + 1, 1.06)
        ring(y + ga, j + 1 + ga / above)
      }
      if (above > 0.25) ring(y + above / 2, j + 1.5)
    })
    const last = ny[ny.length - 1]
    ring(h, ny.length + Math.min(0.5, (h - last) / 0.12))
    radii[radii.length - 1] *= 0.5
    tubes.push({ pts, radii, nodes, colors: ringColors, radial: fine ? 8 : 6 })

    // rameaux par paires aux nœuds de la moitié haute, alternés d'un nœud à l'autre
    const firstBranch = h * (0.46 + r() * 0.08)
    let alt = r() * Math.PI * 2
    for (const y of ny) {
      if (y < firstBranch || y > h - 0.25) continue
      alt += Math.PI + (r() - 0.5) * 0.5
      const tn = (y - firstBranch) / (h - firstBranch)
      const len = (0.45 + 0.85 * Math.sin(Math.PI * Math.min(1, 0.18 + tn * 0.78))) * (0.85 + r() * 0.3) * (h / 8.5)
      const pair: [number, number][] = [
        [0, 1],
        [(r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.3), 0.6],
      ]
      for (const [da, f] of pair) {
        const dirH = new THREE.Vector3(Math.cos(alt + da), 0, Math.sin(alt + da))
        const el = 0.75 - tn * 0.25 + (r() - 0.5) * 0.2
        const L = len * f
        const p0 = axisAt(y).addScaledVector(dirH, radAt(y) * 0.8)
        const bp: THREE.Vector3[] = []
        for (let q = 0; q <= 3; q++) {
          const s = q / 3
          // départ montant (~40°), puis la pointe ploie sous les feuilles
          bp.push(p0.clone().addScaledVector(dirH, Math.cos(el) * s * L).add(new THREE.Vector3(0, Math.sin(el) * s * L - 0.42 * L * s * s, 0)))
        }
        tubes.push({
          pts: bp,
          radii: [0.012 * f + 0.004, 0.009 * f + 0.003, 0.006 * f + 0.0025, 0.003],
          nodes: [0.5, 0.5, 0.5, 0.5],
          colors: bp.map(() => TWIG),
          radial: 3,
        })
        const count = Math.max(1, Math.round((f === 1 ? 4 : 2.5) * density))
        for (let q = 0; q < count; q++) {
          const s = count === 1 ? 1 : 0.4 + 0.6 * (q / (count - 1))
          const p = pointOn(bp, s).add(new THREE.Vector3((r() - 0.5) * 0.08, (r() - 0.5) * 0.06, (r() - 0.5) * 0.08))
          const dir = dirH
            .clone()
            .applyAxisAngle(up, (q % 2 ? 1 : -1) * (0.3 + r() * 0.7))
            .add(new THREE.Vector3(0, -0.15 + r() * 0.35, 0))
            .normalize()
          fan(p, dir, 0.5 + r() * 0.22, q % 3 !== 2)
        }
      }
    }
    // tête du chaume : éventails le long de l'arc et à la pointe
    for (const y of ny) {
      if (y < h - 1.3) continue
      const side = r() < 0.5 ? -1 : 1
      const dir = archDir.clone().applyAxisAngle(up, side * (0.5 + r() * 0.8)).add(new THREE.Vector3(0, -0.1 + r() * 0.3, 0)).normalize()
      fan(axisAt(y), dir, 0.45 + r() * 0.15, r() < 0.6)
    }
    const tipDir = axisAt(h).sub(axisAt(h - 0.4)).normalize()
    fan(axisAt(h - 0.05), tipDir, 0.55, false)
  }
  return { wood: tubesGeometry(tubes), cards, colors, cells }
}

/* ------------------------------ matériaux ------------------------------ */
/** Nœuds dessinés à partir de la valeur de nœud interpolée : cicatrice sombre, bourrelet clair,
 *  bande de cire mate juste en dessous, fibres longitudinales. */
const CULM_BANDS = /* glsl */ `
float culmPh = fract(vCulm.y);
float culmD = min(culmPh, 1.0 - culmPh);
float culmScar = 1.0 - smoothstep(0.0, 0.02, culmD);
float culmRidge = smoothstep(0.015, 0.03, culmPh) * (1.0 - smoothstep(0.04, 0.07, culmPh));
float culmWax = smoothstep(0.9, 0.955, culmPh) * (1.0 - smoothstep(0.975, 0.99, culmPh));
float culmFib = sin(vCulm.x * 150.796 + sin(vCulm.y * 2.3) * 3.0) * sin(vCulm.x * 56.549 + vCulm.y * 0.7);
// chaque entre-nœud a sa nuance (âge, exposition), avec un léger dégradé vers le nœud du dessus
float culmTone = fract(sin(floor(vCulm.y) * 91.7) * 4375.85) - 0.5;
diffuseColor.rgb *= (1.0 - 0.38 * culmScar) * (1.0 + 0.12 * culmRidge) * (1.0 + 0.035 * culmFib) * (1.0 + 0.1 * culmTone - 0.05 * culmPh);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.46, 0.36), culmWax * 0.22);
`

/** Bandes de nœuds (attribut aCulm) et cire mate : commun aux chaumes du bosquet et aux pièces isolées. */
function culmBands(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aCulm;\nvarying vec2 vCulm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCulm = aCulm;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCulm;')
      .replace('#include <color_fragment>', `#include <color_fragment>\n${CULM_BANDS}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.85, culmWax * 0.8);')
  }
  return mat
}

/** Chaumes et rameaux : surface lisse et cirée (mate dans la bande de cire), balancés par le vent. */
export function bambooCulmMaterial() {
  return cachedMaterial('bamboo-culm-v2', () => {
    const mat = culmBands(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0, envMapIntensity: 0.5 }))
    return windy(mat, 'bamboo-culm-v2', BAMBOO_WIND, `position.y / ${BAMBOO_H.toFixed(1)}`)
  })
}

/** Bambou coupé et séché (pièces isolées : shishi-odoshi, goulottes, louches), sans vent. */
export function bambooPieceMaterial() {
  return cachedMaterial('bamboo-piece-v1', () => {
    const mat = culmBands(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0, envMapIntensity: 0.55 }))
    mat.customProgramCacheKey = () => 'bamboo-piece-v1'
    return mat
  })
}

const PIECE_OUT = new THREE.Color(0x7c8a45)
const PIECE_IN = new THREE.Color(0xd9c99c)
const PIECE_CUT = new THREE.Color(0xc8b47e)

export interface BambooPieceOpts {
  len: number
  r: number
  /** hauteurs des nœuds (le bout inférieur est toujours fermé par un nœud) */
  nodes: number[]
  /** coupe en biais du bout supérieur (rad, 0 = droite) ; la partie longue est du côté +x */
  cut?: number
  /** épaisseur de paroi : bout supérieur creux, intérieur clair jusqu'au nœud du dessous */
  wall?: number
  radial?: number
  color?: THREE.ColorRepresentation
}

/**
 * Tronçon de bambou isolé, le long de +y de 0 à `len` : bourrelets aux nœuds, bandes du shader,
 * bout supérieur coupé (droit ou en biais), creux si `wall` (tranche de paroi, intérieur pâle,
 * diaphragme du nœud au fond), sinon fermé. Attributs : position, normale, couleur, aCulm.
 */
export function bambooPiece(o: BambooPieceOpts) {
  const radial = o.radial ?? 14
  const tanCut = Math.tan(o.cut ?? 0)
  const outCol = o.color !== undefined ? new THREE.Color(o.color) : PIECE_OUT
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  const culm: number[] = []
  const idx: number[] = []
  const knots = [0, ...o.nodes.filter((y) => y > 0.02 && y < o.len - 0.02)]
  const lastL = knots.length > 1 ? knots[knots.length - 1] - knots[knots.length - 2] : o.len
  /** valeur de nœud continue le long du tronçon (entière au nœud) */
  const nodeValue = (y: number) => {
    for (let i = 0; i < knots.length - 1; i++) if (y <= knots[i + 1]) return i + (y - knots[i]) / (knots[i + 1] - knots[i])
    return knots.length - 1 + Math.min(0.95, (y - knots[knots.length - 1]) / Math.max(lastL, o.len - knots[knots.length - 1] + 0.01))
  }
  /** hauteur du bout supérieur selon l'angle (plan de coupe) */
  const topY = (a: number, r = o.r) => o.len + tanCut * r * Math.cos(a)
  const vert = (x: number, y: number, z: number, nx: number, ny: number, nz: number, c: THREE.Color, u: number, v: number) => {
    pos.push(x, y, z)
    nor.push(nx, ny, nz)
    col.push(c.r, c.g, c.b)
    culm.push(u, v)
    return pos.length / 3 - 1
  }
  /** anneau de `radial + 1` sommets */
  const ring = (r: number, y: (a: number) => number, n: (c: number, s: number) => [number, number, number], c: THREE.Color, v: (a: number) => number) => {
    const out: number[] = []
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2
      const ca = Math.cos(a), sa = Math.sin(a)
      out.push(vert(ca * r, y(a), sa * r, ...n(ca, sa), c, i / radial, v(a)))
    }
    return out
  }
  const radialN = (c: number, s: number): [number, number, number] => [c, 0, s]
  // surface extérieure : bourrelet à chaque nœud, anneaux serrés autour
  const ys: { y: number; k: number }[] = [{ y: 0, k: 1.03 }]
  for (const y of knots.slice(1)) ys.push({ y: y - 0.01, k: 1 }, { y, k: 1.06 }, { y: y + 0.01, k: 1 })
  ys.push({ y: o.len - Math.abs(tanCut) * o.r - 0.005, k: 1 })
  ys.sort((a, b) => a.y - b.y)
  const rows = ys.map(({ y, k }) => ring(o.r * k, () => y, radialN, outCol, () => nodeValue(y)))
  rows.push(ring(o.r, (a) => topY(a), radialN, outCol, () => nodeValue(o.len)))
  for (let j = 1; j < rows.length; j++)
    for (let i = 0; i < radial; i++) {
      const a = rows[j - 1][i], b = rows[j - 1][i + 1], c = rows[j][i], d = rows[j][i + 1]
      idx.push(a, c, b, b, c, d)
    }
  // plan de coupe y = len + tan·x
  const cn = new THREE.Vector3(-tanCut, 1, 0).normalize()
  const cutN = (): [number, number, number] => [cn.x, cn.y, cn.z]
  const ri = o.r - (o.wall ?? 0)
  if (o.wall) {
    // tranche de la paroi
    const outer = ring(o.r, (a) => topY(a), cutN, PIECE_CUT, () => 0.5)
    const inner = ring(ri, (a) => topY(a, ri), cutN, PIECE_CUT, () => 0.5)
    for (let i = 0; i < radial; i++) idx.push(outer[i], inner[i], outer[i + 1], outer[i + 1], inner[i], inner[i + 1])
    // paroi intérieure jusqu'au diaphragme du dernier nœud, de plus en plus sombre vers le fond
    const floor = knots[knots.length - 1] + 0.012
    const inward = (c: number, s: number): [number, number, number] => [-c, 0, -s]
    const a0 = ring(ri, (a) => topY(a, ri), inward, PIECE_IN, () => 0.5)
    const a1 = ring(ri, () => floor, inward, PIECE_IN.clone().multiplyScalar(0.5), () => 0.5)
    for (let i = 0; i < radial; i++) idx.push(a0[i], a1[i], a0[i + 1], a0[i + 1], a1[i], a1[i + 1])
    const ctr = vert(0, floor, 0, 0, 1, 0, PIECE_IN.clone().multiplyScalar(0.32), 0, 0.5)
    const rim = ring(ri, () => floor, () => [0, 1, 0], PIECE_IN.clone().multiplyScalar(0.4), () => 0.5)
    for (let i = 0; i < radial; i++) idx.push(ctr, rim[i + 1], rim[i])
  } else {
    // bout fermé : coupe pleine juste au-dessus d'un nœud
    const ctr = vert(0, o.len, 0, cn.x, cn.y, cn.z, PIECE_CUT, 0, 0.5)
    const rim = ring(o.r, (a) => topY(a), cutN, PIECE_CUT, () => 0.5)
    for (let i = 0; i < radial; i++) idx.push(ctr, rim[i + 1], rim[i])
  }
  // bout inférieur, fermé par le nœud
  const foot = outCol.clone().multiplyScalar(0.7)
  const bc = vert(0, 0, 0, 0, -1, 0, foot, 0, 0.5)
  const brim = ring(o.r * 1.03, () => 0, () => [0, -1, 0], foot, () => 0.5)
  for (let i = 0; i < radial; i++) idx.push(bc, brim[i], brim[i + 1])
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('aCulm', new THREE.Float32BufferAttribute(culm, 2))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

export const bambooLeafMaterial = () =>
  cardMaterial('bamboo-leaves-v1', bambooAtlas(), BAMBOO_WIND, { roughness: 0.6, envMapIntensity: 0.4, glow: 0.09, bend: 0.45 })

/** Feuillage de toutes les touffes d'un même gabarit, en un seul maillage instancié. */
export const bambooLeafMesh = (tpl: BambooTemplate, clumps: THREE.Matrix4[], tints: THREE.Color[]) =>
  cardMesh(tpl, clumps, tints, bambooLeafMaterial(), BAMBOO_H)
