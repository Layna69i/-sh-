/**
 * Cryptomère du Japon (sugi, Cryptomeria japonica) procédurale, pour la forêt des Nara.
 * Bois : tronc effilé à empattement et une quarantaine de branches en spirale (phyllotaxie),
 * horizontales et ployant sous leur poids, avec rameaux latéraux ; flèche terminale.
 * Feuillage : touffes de cartes croisées au bout des rameaux, portant des plumets d'aiguilles
 * dessinés un à un sur un atlas ; deux niveaux de détail issus du même squelette (même
 * silhouette de près et de loin). Le vent est calculé après l'instanciation, avec la même
 * formule pour le bois et les aiguilles : tronc, branches et touffes bougent ensemble.
 */
import * as THREE from 'three'
import { rng } from '../core/math'
import { makeCanvas, ctx2d } from '../textures/util'
import { dynamicTexture, cachedMaterial, M } from './assets'
import { PBR, pbrParams } from './pbr'
import { cardMaterial, cardMesh, windy, type CardSet, type TreeWind } from './cards'
import { woodGeometry, type Branch } from './maple'

/** Hauteur du gabarit (m) : les instances sont mises à l'échelle par arbre. */
export const SUGI_H = 25.5

interface Tuft {
  p: THREE.Vector3
  r: number
  out: THREE.Vector3
  /** touffe principale (bout de branche, flèche) : seule gardée au loin */
  main: boolean
}

/** Squelette déterministe (le même pour les deux niveaux de détail). */
function sugiSkeleton(seed: number) {
  const r = rng(seed * 97 + 5)
  const branches: Branch[] = []
  const tufts: Tuft[] = []
  const trunkR = (y: number) => 0.44 * Math.pow(Math.max(0, 1 - y / SUGI_H), 0.85) + 0.055
  // tronc droit, très légèrement sinueux
  const tp: THREE.Vector3[] = []
  const tr: number[] = []
  const lx = (r() - 0.5) * 0.25, lz = (r() - 0.5) * 0.25
  for (let i = 0; i <= 16; i++) {
    const y = -0.1 + (i / 16) * (SUGI_H + 0.1)
    const k = y / SUGI_H
    tp.push(new THREE.Vector3(lx * k * k + Math.sin(k * 5 + seed) * 0.06, y, lz * k * k + Math.cos(k * 4 + seed) * 0.06))
    tr.push(trunkR(y))
  }
  branches.push({ pts: tp, radii: tr })
  const axisAt = (y: number) => {
    const k = y / SUGI_H
    return new THREE.Vector3(lx * k * k + Math.sin(k * 5 + seed) * 0.06, y, lz * k * k + Math.cos(k * 4 + seed) * 0.06)
  }
  // branches en spirale, de plus en plus courtes vers la flèche
  const n = 40
  const y0 = 8.6
  const y1 = SUGI_H - 1.6
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const y = y0 + Math.pow(t, 0.92) * (y1 - y0) + (r() - 0.5) * 0.35
    const reach = 3.3 * Math.pow(1 - t, 0.85) + 0.6 + (r() - 0.5) * 0.5
    const az = i * 2.39996 + (r() - 0.5) * 0.5
    const elev = THREE.MathUtils.lerp(-0.12, 0.42, t) + (r() - 0.5) * 0.12
    const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az))
    const base = axisAt(y).addScaledVector(dir, trunkR(y) * 0.6)
    const pts: THREE.Vector3[] = []
    const radii: number[] = []
    const r0 = 0.03 + 0.05 * (reach / 3.9)
    for (let k = 0; k <= 4; k++) {
      const s = k / 4
      // départ un peu montant, puis ploiement sous le poids des aiguilles
      const p = base.clone().addScaledVector(dir, s * reach)
      p.y += Math.sin(elev) * s * reach - 0.12 * reach * s * s * (1 - t * 0.6)
      pts.push(p)
      radii.push(r0 * (1 - s * 0.72))
    }
    branches.push({ pts, radii })
    const tuftR = 0.62 + 0.42 * (reach / 3.9)
    tufts.push({ p: pts[4].clone(), r: tuftR, out: dir.clone(), main: true })
    if (reach > 1.4) tufts.push({ p: pts[3].clone().add(new THREE.Vector3(0, 0.08, 0)), r: tuftR * 0.8, out: dir.clone(), main: false })
    // rameaux latéraux
    for (const side of [-1, 1]) {
      if (reach < 1.6 || r() < 0.45) continue
      const at = side < 0 ? 2 : 3
      const sd = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), side * (0.7 + r() * 0.4))
      const sl = reach * (0.3 + r() * 0.12)
      const a = pts[at]
      const b = a.clone().addScaledVector(sd, sl * 0.5).add(new THREE.Vector3(0, 0.05, 0))
      const c = a.clone().addScaledVector(sd, sl).add(new THREE.Vector3(0, -0.04 * sl, 0))
      branches.push({ pts: [a.clone(), b, c], radii: [radii[at] * 0.6, radii[at] * 0.4, radii[at] * 0.22] })
      tufts.push({ p: c, r: tuftR * 0.75, out: sd, main: false })
    }
  }
  // flèche : touffes serrées autour de l'axe
  for (let i = 0; i < 6; i++) {
    const y = SUGI_H - 3.4 + i * 0.62
    const a = i * 2.1
    tufts.push({ p: axisAt(y).add(new THREE.Vector3(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15)), r: 0.62 - i * 0.06, out: new THREE.Vector3(Math.cos(a), 0.3, Math.sin(a)).normalize(), main: true })
  }
  return { branches, tufts }
}

/* ------------------------------ atlas des plumets ------------------------------ */
const NEEDLE = ['#1c3523', '#25432b', '#2d4f30', '#3a5f37', '#4e7440', '#5f8448']

/** Plumet de sugi : axe, rameaux alternes, aiguilles courtes en éventail vers l'avant. */
function drawSpray(ctx: CanvasRenderingContext2D, ox: number, oy: number, S: number, r: () => number) {
  const twigs: { pts: [number, number][]; w: number; t0: number }[] = []
  const bend = (r() - 0.5) * S * 0.18
  const axis: [number, number][] = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    axis.push([ox + S * 0.5 + bend * Math.sin(t * Math.PI) + (r() - 0.5) * 2, oy + S * (0.94 - t * 0.86)])
  }
  twigs.push({ pts: axis, w: 3.2, t0: 0 })
  for (let k = 0; k < 13; k++) {
    const t = 0.08 + (k / 13) * 0.82
    const i = Math.round(t * 24)
    const [bx, by] = axis[i]
    const side = k % 2 ? 1 : -1
    const ang = -Math.PI / 2 + side * (0.75 + r() * 0.3)
    const len = S * (0.3 - t * 0.17) * (0.8 + r() * 0.35)
    const pts: [number, number][] = []
    for (let j = 0; j <= 10; j++) {
      const s = j / 10
      const a = ang - side * s * 0.35
      pts.push([bx + Math.cos(a) * len * s, by + Math.sin(a) * len * s])
    }
    twigs.push({ pts, w: 2.2, t0: t })
    // petits rameaux secondaires sur les plus longs
    if (len > S * 0.14) {
      const [cx, cy] = pts[5]
      const a2 = ang - side * 0.7
      const l2 = len * 0.4
      const sub: [number, number][] = []
      for (let j = 0; j <= 6; j++) sub.push([cx + Math.cos(a2) * l2 * (j / 6), cy + Math.sin(a2) * l2 * (j / 6)])
      twigs.push({ pts: sub, w: 1.6, t0: t })
    }
  }
  // tiges
  ctx.lineCap = 'round'
  for (const tw of twigs) {
    ctx.strokeStyle = '#3b3420'
    ctx.lineWidth = tw.w
    ctx.beginPath()
    tw.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.stroke()
  }
  // aiguilles : en éventail vers l'avant de chaque tige, plus claires vers les pointes
  for (const tw of twigs) {
    for (let i = 1; i < tw.pts.length; i++) {
      const [x0, y0] = tw.pts[i - 1]
      const [x1, y1] = tw.pts[i]
      const seg = Math.hypot(x1 - x0, y1 - y0)
      const a = Math.atan2(y1 - y0, x1 - x0)
      const steps = Math.max(1, Math.round(seg / 3.2))
      for (let s = 0; s < steps; s++) {
        const f = (s + r()) / steps
        const px = x0 + (x1 - x0) * f
        const py = y0 + (y1 - y0) * f
        const along = i / tw.pts.length
        for (const side of [-1, 0, 1]) {
          const na = a + side * (0.55 + r() * 0.35) + (r() - 0.5) * 0.2
          const len = (side === 0 ? 7 : 11 + r() * 5) * (1 - along * 0.25) * (S / 512)
          const ci = Math.min(NEEDLE.length - 1, Math.floor(along * 3 + tw.t0 * 2 + r() * 2.2))
          ctx.strokeStyle = NEEDLE[ci]
          ctx.lineWidth = 2.1 * (S / 512)
          ctx.beginPath()
          ctx.moveTo(px, py)
          // aiguille légèrement arquée (pointe vers l'avant)
          ctx.quadraticCurveTo(px + Math.cos(na) * len * 0.6, py + Math.sin(na) * len * 0.6, px + Math.cos(na + side * -0.25) * len, py + Math.sin(na + side * -0.25) * len)
          ctx.stroke()
        }
      }
    }
  }
}

export function sugiAtlas() {
  return dynamicTexture('sugi-spray-atlas-v1', () => {
    const S = 1024
    const c = makeCanvas(S, S)
    const ctx = ctx2d(c)
    ctx.clearRect(0, 0, S, S)
    const r = rng(5151)
    for (let q = 0; q < 4; q++) drawSpray(ctx, (q % 2) * 512 + 6, Math.floor(q / 2) * 512 + 6, 500, r)
    return c
  })
}

/* ------------------------------ gabarits ------------------------------ */
export interface SugiTemplate extends CardSet {
  wood: THREE.BufferGeometry
}

/**
 * `detail` : 'near' (touffes pleines, bois complet) ou 'far' (deux grandes cartes par touffe,
 * tronc seul) ; `density` réduit le nombre de cartes proches selon le profil graphique.
 */
export function sugiTemplate(seed: number, detail: 'near' | 'far', density = 1): SugiTemplate {
  const { branches, tufts } = sugiSkeleton(seed)
  const wood = detail === 'near' ? woodGeometry(branches, 8) : woodGeometry([branches[0]], 6)
  const r = rng(seed * 31 + (detail === 'near' ? 1 : 2))
  const cards: THREE.Matrix4[] = []
  const colors: THREE.Color[] = []
  const cells: number[] = []
  const up = new THREE.Vector3(0, 1, 0)
  const n = new THREE.Vector3()
  const p = new THREE.Vector3()
  const bx = new THREE.Vector3()
  const by = new THREE.Vector3()
  for (const tf of tufts) {
    // au loin : touffes principales seules, deux grandes cartes chacune (même silhouette)
    if (detail === 'far' && !tf.main) continue
    const count = detail === 'near' ? Math.max(2, Math.round((tf.main ? 4 + tf.r * 3 : 3 + tf.r * 1.5) * density)) : 2
    for (let k = 0; k < count; k++) {
      // une moitié de cartes presque horizontales (nappe), l'autre croisée (volume vu de côté)
      const flat = k % 2 === 0
      if (flat) n.copy(tf.out).multiplyScalar(0.45).add(up).add(new THREE.Vector3((r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.7)).normalize()
      else n.copy(tf.out).add(new THREE.Vector3((r() - 0.5) * 1.2, (r() - 0.3) * 0.8, (r() - 0.5) * 1.2)).normalize()
      // repère de la carte : normale n, axe du plumet (+y de la carte) vers l'extérieur de la branche
      by.copy(tf.out).addScaledVector(n, -tf.out.dot(n))
      if (by.lengthSq() < 1e-4) by.set(1, 0, 0).addScaledVector(n, -n.x)
      by.normalize().applyAxisAngle(n, (r() - 0.5) * 1.3)
      bx.crossVectors(by, n).normalize()
      const spread = detail === 'near' ? tf.r * 0.55 : tf.r * 0.25
      p.copy(tf.p).add(new THREE.Vector3((r() - 0.5) * spread * 2, (r() - 0.5) * spread * 0.9, (r() - 0.5) * spread * 2)).addScaledVector(tf.out, -tf.r * 0.15)
      const size = tf.r * (detail === 'near' ? 1.85 + r() * 0.5 : 3.1 + r() * 0.5)
      cards.push(new THREE.Matrix4().makeBasis(bx, by, n).scale(new THREE.Vector3(size, size, size)).setPosition(p))
      // nuances : cœur et bas plus sombres, extrémités et sommet plus clairs et plus jaunes
      const h = p.y / SUGI_H
      const out = Math.min(1, Math.hypot(p.x, p.z) / 3.5)
      const b = 0.72 + 0.22 * out + 0.14 * h + (r() - 0.5) * 0.12
      colors.push(new THREE.Color().setRGB(b * (0.96 + r() * 0.08), b * (1 + r() * 0.04), b * (0.9 + r() * 0.06)))
      const c = Math.floor(r() * 4)
      cells.push((c % 2) * 0.5, Math.floor(c / 2) * 0.5)
    }
  }
  return { wood, cards, colors, cells }
}

/* ------------------------------ matériaux ------------------------------ */
/** Vent de la cryptomère : ~26 cm au sommet, frémissement léger des plumets. */
const SUGI_WIND: TreeWind = [0.26, 1, 0.02]

export const sugiCardMaterial = () =>
  cardMaterial('sugi-cards-v1', sugiAtlas(), SUGI_WIND, { roughness: 0.86, envMapIntensity: 0.3, glow: 0.05, bend: 0.6 })

/** Écorce de cryptomère (PBR, texture 1 × 2 m), balancée par le même vent que les aiguilles. */
export function sugiBarkMaterial() {
  return cachedMaterial('sugi-bark-v1', () => {
    const p = pbrParams('japanese_cedar_bark', { color: 0xc4b4a6, normalScale: 1.3, aspect: [1, 2] })
    const mat = new THREE.MeshStandardMaterial(p ?? { map: M().bark.map, normalMap: M().bark.normalMap, color: 0xb59e8c, roughness: 0.95 })
    return windy(mat, `sugi-bark-v1-${!!PBR().japanese_cedar_bark}`, SUGI_WIND, `position.y / ${SUGI_H.toFixed(1)}`)
  })
}

/**
 * Feuillage d'un ensemble d'arbres d'un même gabarit, en un seul maillage instancié.
 * `trees` : matrices des arbres (base au sol) ; `tints` : teinte de chaque arbre.
 */
export const sugiCardMesh = (tpl: SugiTemplate, trees: THREE.Matrix4[], tints: THREE.Color[]) => cardMesh(tpl, trees, tints, sugiCardMaterial(), SUGI_H)
