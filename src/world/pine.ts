/**
 * Pin noir du Japon (kuromatsu, Pinus thunbergii) taillé en nuages (niwaki), pour le pied de
 * l'escalier. Bois : tronc sinueux à empattement, écorce PBR en plaques ; charpentières coudées
 * (taille répétée) qui portent chacune un nuage ; dans chaque nuage, des rameaux rayonnent à plat.
 * Feuillage : pousses en brosse (aiguilles par deux, bourgeon terminal) dessinées sur un atlas,
 * en cartes croisées réparties sur le dôme aplati de chaque nuage — dessus dense, dessous dégagé,
 * comme après l'éclaircissage (momiage). Vent faible, commun au bois et aux aiguilles.
 */
import * as THREE from 'three'
import { rng } from '../core/math'
import { makeCanvas, ctx2d } from '../textures/util'
import { dynamicTexture, cachedMaterial, M } from './assets'
import { PBR, pbrParams } from './pbr'
import { woodGeometry, type Branch } from './maple'
import { cardMaterial, cardMesh, windy, type CardSet, type TreeWind } from './cards'

/** Hauteur de référence du gabarit (m), pour le vent. */
export const PINE_H = 4.6
/** Arbre taillé, rigide : il se balance à peine, ses aiguilles frémissent un peu. */
const PINE_WIND: TreeWind = [0.06, 0.8, 0.012]

interface Cloud {
  c: THREE.Vector3
  rx: number
  rz: number
  th: number
  ang: number
}

/** Squelette : même tronc et mêmes nuages que l'ancien modèle (silhouette inchangée au pied de l'escalier). */
function pineSkeleton(seed: number, lean: number) {
  // même suite aléatoire que l'ancien modèle pour les nuages ; les coudes ont leur propre suite
  const r = rng(seed)
  const rk = rng(seed * 7 + 2)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean * 0.35, 1.1, 0.1),
    new THREE.Vector3(lean * 0.95, 2.2, 0.35),
    new THREE.Vector3(lean * 1.05, 3.3, 0.05),
    new THREE.Vector3(lean * 0.75, 4.3, -0.2),
  ])
  const branches: Branch[] = []
  const clouds: Cloud[] = []
  const tp: THREE.Vector3[] = []
  const tr: number[] = []
  for (let i = 0; i <= 18; i++) {
    const t = i / 18
    tp.push(curve.getPoint(t))
    // tronc trapu, à peine bosselé (cicatrices de taille)
    tr.push((0.2 * Math.pow(1 - t, 0.75) + 0.05) * (1 + 0.06 * Math.sin(i * 2.7 + seed)))
  }
  branches.push({ pts: tp, radii: tr })
  const N = 7
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < N; i++) {
    const top = i === N - 1
    const t = 0.38 + (i / (N - 1)) * 0.62
    const base = curve.getPoint(t)
    const a = i * 2.4 + r() * 0.6 + (lean > 0 ? 0 : Math.PI)
    const dir = new THREE.Vector3(Math.cos(a), 0.15 + r() * 0.2, Math.sin(a) * 0.8).normalize()
    const len = top ? 0 : 0.9 + r() * 0.9
    const tip = base.clone().addScaledVector(dir, len)
    if (!top) {
      // charpentière coudée : départ montant, coude, puis extrémité presque horizontale
      const dh = new THREE.Vector3(dir.x, 0, dir.z).normalize()
      const side = new THREE.Vector3().crossVectors(up, dh)
      const k1 = base.clone().addScaledVector(dh, len * 0.35).addScaledVector(side, (rk() - 0.5) * 0.25).add(new THREE.Vector3(0, len * 0.16, 0))
      const k2 = base.clone().addScaledVector(dh, len * 0.7).addScaledVector(side, (rk() - 0.5) * 0.3).add(new THREE.Vector3(0, len * (dir.y * 0.55), 0))
      const r0 = 0.085 - i * 0.006
      branches.push({ pts: [base.clone().addScaledVector(dh, tr[Math.round(t * 18)] * 0.5), k1, k2, tip.clone()], radii: [r0, r0 * 0.78, r0 * 0.6, r0 * 0.45] })
    }
    const w = top ? 0.85 : 0.7 + r() * 0.55
    const th = 0.34 + r() * 0.1
    const ang = r() * 6
    clouds.push({ c: tip.clone().add(new THREE.Vector3(0, 0.14, 0)), rx: w * 1.25, rz: w, th, ang })
  }
  // rameaux rayonnant à plat dans chaque nuage (visibles par en dessous)
  const r2 = rng(seed * 13 + 1)
  for (const cl of clouds) {
    const n = 6 + Math.floor(r2() * 3)
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r2() * 0.6
      const ex = Math.cos(a) * cl.rx * (0.55 + r2() * 0.25)
      const ez = Math.sin(a) * cl.rz * (0.55 + r2() * 0.25)
      const ca = Math.cos(cl.ang), sa = Math.sin(cl.ang)
      const off = new THREE.Vector3(ex * ca + ez * sa, 0, -ex * sa + ez * ca)
      const from = cl.c.clone().add(new THREE.Vector3(0, -0.12, 0))
      const mid = from.clone().addScaledVector(off, 0.5).add(new THREE.Vector3(0, 0.05, 0))
      const end = from.clone().add(off).add(new THREE.Vector3(0, 0.02 + r2() * 0.06, 0))
      branches.push({ pts: [from, mid, end], radii: [0.026, 0.016, 0.007] })
    }
  }
  return { branches, clouds }
}

/* ------------------------------ atlas des pousses ------------------------------ */
const NEEDLE = ['#1b311e', '#213a22', '#294627', '#31522d', '#3c5f33', '#4b6c3a']

/** Pousse de pin noir : rameau ligneux, aiguilles raides groupées par deux, bourgeon terminal. */
function drawShoot(ctx: CanvasRenderingContext2D, ox: number, oy: number, S: number, r: () => number) {
  const k = S / 512
  const bx = ox + S * 0.5
  const by = oy + S * 0.96
  const tx = ox + S * (0.5 + (r() - 0.5) * 0.08)
  const ty = oy + S * 0.5
  const shootAng = Math.atan2(ty - by, tx - bx)
  const needles: { s: number; x: number; y: number; a: number; L: number }[] = []
  for (let i = 0; i < 170; i++) {
    // brosse : aiguilles tout le long de la pousse, à angle à peu près constant, resserrées en pointe
    const s = 0.15 + 0.85 * r()
    const side = r() < 0.5 ? -1 : 1
    const a = shootAng + side * (0.3 + r() * 0.35) * (1 - 0.6 * Math.pow(s, 4))
    const L = S * (0.2 + r() * 0.09) * (0.85 + 0.2 * (1 - Math.abs(s - 0.6)))
    needles.push({ s, x: bx + (tx - bx) * s + (r() - 0.5) * 3 * k, y: by + (ty - by) * s, a, L })
  }
  needles.sort((u, v) => u.s - v.s)
  // rameau
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#4f4232'
  ctx.lineWidth = 5 * k
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(tx, ty)
  ctx.stroke()
  for (const nd of needles) {
    const dry = r() < 0.05 && nd.s < 0.5
    const ci = Math.min(NEEDLE.length - 1, Math.floor(nd.s * 3 + r() * 2.6))
    ctx.strokeStyle = dry ? '#7d6a42' : NEEDLE[ci]
    ctx.lineWidth = 1.7 * k
    // fascicule de deux aiguilles légèrement divergentes, à peine arquées
    for (const d of [-1, 1]) {
      const a = nd.a + d * (0.03 + r() * 0.05)
      const bend = (r() - 0.5) * 0.12
      ctx.beginPath()
      ctx.moveTo(nd.x, nd.y)
      ctx.quadraticCurveTo(
        nd.x + Math.cos(a + bend) * nd.L * 0.55,
        nd.y + Math.sin(a + bend) * nd.L * 0.55,
        nd.x + Math.cos(a) * nd.L,
        nd.y + Math.sin(a) * nd.L,
      )
      ctx.stroke()
    }
  }
  // bourgeon terminal (les « chandelles » de l'automne suivant), écailles brun pâle
  ctx.save()
  ctx.translate(tx, ty)
  ctx.rotate(shootAng)
  const g = ctx.createLinearGradient(0, 0, S * 0.07, 0)
  g.addColorStop(0, '#6e5a3e')
  g.addColorStop(1, '#b09a72')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(S * 0.03, 0, S * 0.04, S * 0.012, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function pineAtlas() {
  return dynamicTexture('pine-shoot-atlas-v1', () => {
    const S = 1024
    const c = makeCanvas(S, S)
    const ctx = ctx2d(c)
    ctx.clearRect(0, 0, S, S)
    const r = rng(8181)
    for (let q = 0; q < 4; q++) drawShoot(ctx, (q % 2) * 512 + 6, Math.floor(q / 2) * 512 + 6, 500, r)
    return c
  })
}

/* ------------------------------ gabarit ------------------------------ */
export interface PineTemplate extends CardSet {
  wood: THREE.BufferGeometry
}

/** `density` réduit le nombre de pousses selon le profil (les restantes grandissent un peu). */
export function pineTemplate(seed: number, lean: number, density = 1): PineTemplate {
  const { branches, clouds } = pineSkeleton(seed, lean)
  const wood = woodGeometry(branches, 10)
  const r = rng(seed * 71 + 9)
  const cards: THREE.Matrix4[] = []
  const colors: THREE.Color[] = []
  const cells: number[] = []
  const up = new THREE.Vector3(0, 1, 0)
  const dir = new THREE.Vector3()
  const n = new THREE.Vector3()
  const n2 = new THREE.Vector3()
  const bx = new THREE.Vector3()
  const by = new THREE.Vector3()
  const sizeK = 1 / Math.pow(density, 0.35)
  const push = (p: THREE.Vector3, normal: THREE.Vector3, size: number, light: number) => {
    by.copy(dir).addScaledVector(normal, -dir.dot(normal)).normalize()
    bx.crossVectors(by, normal).normalize()
    cards.push(new THREE.Matrix4().makeBasis(bx, by, normal).scale(new THREE.Vector3(size, size, size)).setPosition(p))
    const b = light * (0.92 + r() * 0.16)
    colors.push(new THREE.Color().setRGB(b * (0.97 + r() * 0.06), b, b * (0.92 + r() * 0.06)))
    const c = Math.floor(r() * 4)
    cells.push((c % 2) * 0.5, Math.floor(c / 2) * 0.5)
  }
  for (const cl of clouds) {
    const ca = Math.cos(cl.ang), sa = Math.sin(cl.ang)
    const count = Math.round(Math.PI * cl.rx * cl.rz * 72 * density)
    for (let i = 0; i < count; i++) {
      const rho = Math.sqrt(r())
      const a = r() * Math.PI * 2
      const ex = Math.cos(a) * rho * cl.rx
      const ez = Math.sin(a) * rho * cl.rz
      const off = new THREE.Vector3(ex * ca + ez * sa, 0, -ex * sa + ez * ca)
      const dome = Math.sqrt(Math.max(0, 1 - rho * rho))
      const p = cl.c.clone().add(off).add(new THREE.Vector3(0, -cl.th * 0.35 + cl.th * 0.65 * dome * (0.75 + r() * 0.25), 0))
      // pousses dressées au cœur du nuage, de plus en plus couchées vers le bord
      const radial = off.lengthSq() > 1e-6 ? off.clone().normalize() : new THREE.Vector3(1, 0, 0)
      dir.copy(radial).multiplyScalar(0.25 + rho * 1.1).addScaledVector(up, 1.2 - rho * 0.6)
      dir.add(new THREE.Vector3((r() - 0.5) * 0.35, (r() - 0.5) * 0.2, (r() - 0.5) * 0.35)).normalize()
      // deux cartes croisées autour de l'axe de la pousse : brosse lisible sous tous les angles
      n.crossVectors(dir, new THREE.Vector3(Math.cos(a + 1.3), 0, Math.sin(a + 1.3)))
      if (n.lengthSq() < 1e-4) n.set(1, 0, 0)
      n.normalize()
      n2.crossVectors(dir, n).normalize()
      const size = (0.23 + r() * 0.08) * sizeK
      // dessus du nuage plus clair (ciel), dessous et cœur plus sombres
      const light = 0.66 + 0.22 * dome * (p.y > cl.c.y ? 1 : 0.6)
      push(p, n, size, light)
      push(p, n2, size, light)
    }
  }
  return { wood, cards, colors, cells }
}

/* ------------------------------ matériaux ------------------------------ */
/** Écorce de pin noir : plaques grises (texture désaturée au traitement), repli procédural en Bas. */
export function pineBarkMaterial() {
  return cachedMaterial('pine-bark-v1', () => {
    const p = pbrParams('pine_bark', { color: 0x9a948e, normalScale: 1.5 })
    const mat = new THREE.MeshStandardMaterial(p ?? { map: M().bark.map, normalMap: M().bark.normalMap, color: 0x6e6862, roughness: 0.95 })
    return windy(mat, `pine-bark-v1-${!!PBR().pine_bark}`, PINE_WIND, `position.y / ${PINE_H.toFixed(1)}`)
  })
}

export const pineNeedleMaterial = () =>
  cardMaterial('pine-needles-v1', pineAtlas(), PINE_WIND, { roughness: 0.78, envMapIntensity: 0.25, glow: 0.03, bend: 0.5 })

export const pineCardMesh = (tpl: PineTemplate, trees: THREE.Matrix4[], tints: THREE.Color[]) =>
  cardMesh(tpl, trees, tints, pineNeedleMaterial(), PINE_H)
