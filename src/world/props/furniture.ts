/**
 * Bibliothèque de mobilier japonais construit procéduralement.
 * Chaque fonction ajoute ses pièces à un StaticBuilder via un « Placer »
 * (transformation locale → monde), puis le tout est fusionné par matériau.
 * Les pièces vues de près (coussins, tables, coffres, nécessaires à thé et à encre, bonsaï,
 * ikebana, sabres) sont modelées avec leurs assemblages et leurs ferrures ; les feuillages des
 * petits sujets reprennent les dessins des atlas des arbres (découpe alpha).
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { M, cachedMaterial } from '../assets'
import { StaticBuilder, latheGeo, materialBox, scaleUV } from '../geo'
import { rng, range } from '../../core/math'
import { woodGeometry, mapleLeafAtlas, type Branch } from '../maple'
import { pineAtlas } from '../pine'
import { pbrParams } from '../pbr'

type V3 = [number, number, number]

export class Placer {
  readonly m: THREE.Matrix4
  constructor(
    readonly b: StaticBuilder,
    x = 0,
    y = 0,
    z = 0,
    ry = 0,
    parent?: THREE.Matrix4,
  ) {
    const local = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1))
    this.m = parent ? parent.clone().multiply(local) : local
  }
  at(x: number, y: number, z: number, ry = 0) {
    return new Placer(this.b, x, y, z, ry, this.m)
  }
  geo(g: THREE.BufferGeometry, mat: THREE.Material, p: V3 = [0, 0, 0], r: V3 = [0, 0, 0], s: number | V3 = 1, cast = false) {
    const lm = new THREE.Matrix4().compose(
      new THREE.Vector3(...p),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
      typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s),
    )
    this.b.add(g, mat, this.m.clone().multiply(lm), { cast })
    g.dispose()
    return this
  }
  box(mat: THREE.Material, w: number, h: number, d: number, p: V3, r: V3 = [0, 0, 0], cast = false) {
    return this.geo(materialBox(mat, w, h, d), mat, p, r, 1, cast)
  }
  cyl(mat: THREE.Material, rt: number, rb: number, h: number, seg: number, p: V3, r: V3 = [0, 0, 0], cast = false) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg)
    scaleUV(g, Math.PI * 2 * Math.max(rt, rb), h)
    return this.geo(g, mat, p, r, 1, cast)
  }
  rbox(mat: THREE.Material, w: number, h: number, d: number, radius: number, p: V3, r: V3 = [0, 0, 0]) {
    const g = new RoundedBoxGeometry(w, h, d, 2, radius)
    scaleUV(g, Math.max(w, d), Math.max(w, d))
    return this.geo(g, mat, p, r)
  }
}

/* ------------------------------ matériaux et formes communes ------------------------------ */
/** Laque (urushi) : fond profond, brillant, reflets nets. */
const lacquer = () => cachedMaterial('lacquer-black', () => new THREE.MeshStandardMaterial({ color: 0x15100e, roughness: 0.2, metalness: 0, envMapIntensity: 0.9 }))
/** Thé infusé, surface lisse. */
const tea = () => cachedMaterial('tea-liquor', () => new THREE.MeshStandardMaterial({ color: 0x5b5a24, roughness: 0.08, metalness: 0 }))
const petal = () => cachedMaterial('ikebana-petal', () => new THREE.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.6, side: THREE.DoubleSide }))
const stem = () => cachedMaterial('ikebana-stem', () => new THREE.MeshStandardMaterial({ color: 0x4d5a2c, roughness: 0.8 }))
/** Feuillages des petits sujets : dessins des atlas d'arbres, découpe alpha. */
const atlasLeaves = (key: string, atlas: () => THREE.Texture, color: THREE.ColorRepresentation) =>
  cachedMaterial(key, () => new THREE.MeshStandardMaterial({ map: atlas(), color, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75, metalness: 0 }))
/** Écorce de pin à l'échelle d'un bonsaï (plaques fines), repli procédural en profil Bas. */
const bonsaiBark = () =>
  cachedMaterial('bonsai-bark', () => {
    const p = pbrParams('pine_bark', { color: 0x8a8480, size: 0.35, normalScale: 1.2 })
    return p ? new THREE.MeshStandardMaterial(p) : M().bark
  })

/** Carte de feuillage occupant la case `cell` (0–3) d'un atlas 2 × 2, ancrée par le bas. */
function atlasCard(cell: number, size: number) {
  const g = new THREE.PlaneGeometry(size, size)
  g.translate(0, size * 0.38, 0)
  const uv = g.attributes.uv as THREE.BufferAttribute
  const u0 = (cell % 2) * 0.5
  const v0 = Math.floor(cell / 2) * 0.5
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.5, v0 + uv.getY(i) * 0.5)
  return g
}

/** Carte orientée : normale `n`, dessin dirigé vers `dir`, posée en `p`. */
function placeCard(P: Placer, g: THREE.BufferGeometry, mat: THREE.Material, p: THREE.Vector3, dir: THREE.Vector3, n: THREE.Vector3) {
  const by = dir.clone().addScaledVector(n, -dir.dot(n)).normalize()
  const bx = new THREE.Vector3().crossVectors(by, n).normalize()
  g.applyMatrix4(new THREE.Matrix4().makeBasis(bx, by, n).setPosition(p))
  P.geo(g, mat)
}

/** Rembourrage : boîte subdivisée dont les bords s'amincissent (coussins, dossiers). */
function pillowGeo(w: number, h: number, d: number, puff = 0.6) {
  const g = new THREE.BoxGeometry(w, h, d, 10, 2, 10)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const ax = Math.abs(x) / (w / 2)
    const az = Math.abs(z) / (d / 2)
    const t = Math.max(ax, az)
    // coins un peu rentrés, comme un tissu tendu sur la bourre
    const corner = ax * az
    pos.setXYZ(i, x * (1 - 0.04 * corner * corner), pos.getY(i) * (1 - puff * t * t * t), z * (1 - 0.04 * corner * corner))
  }
  g.computeVertexNormals()
  scaleUV(g, Math.max(w, d), Math.max(w, d))
  return g
}

/** Effile une pièce verticale : section multipliée par `k0` en bas, intacte en haut. */
function taper(g: THREE.BufferGeometry, k0: number) {
  g.computeBoundingBox()
  const { min, max } = g.boundingBox!
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - min.y) / (max.y - min.y)
    const k = k0 + (1 - k0) * t
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i), pos.getZ(i) * k)
  }
  g.computeVertexNormals()
  return g
}

/** Tube le long d'une courbe passant par `pts`. */
function tubeGeo(pts: THREE.Vector3[], r: number, seg = 16, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(pts)
  const g = new THREE.TubeGeometry(curve, seg, r, radial, false)
  scaleUV(g, curve.getLength(), Math.PI * 2 * r)
  return g
}

/** Anse en arc (demi-tore) dans le plan xy, ouverte vers le bas. */
function archGeo(r: number, t: number, arc = Math.PI) {
  const g = new THREE.TorusGeometry(r, t, 6, 14, arc)
  g.rotateZ((Math.PI - arc) / 2)
  return g
}

/** Rotation (angles d'Euler) qui amène -y sur `dir`. */
function hang(dir: THREE.Vector3): V3 {
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize()))
  return [e.x, e.y, e.z]
}

/* ------------------------------------------------------------------ */

/** Table basse : plateau épais, ceinture en retrait, pieds effilés vers le sol. */
export function lowTable(P: Placer, w: number, d: number, h = 0.34, mat = M().woodDark) {
  const top = 0.036
  P.box(mat, w, top, d, [0, h - top / 2, 0])
  P.box(mat, w - 0.05, 0.016, d - 0.05, [0, h - top - 0.008, 0])
  const inset = 0.075
  const ay = h - top - 0.04
  P.box(mat, w - 2 * inset, 0.05, 0.022, [0, ay, d / 2 - inset])
  P.box(mat, w - 2 * inset, 0.05, 0.022, [0, ay, -(d / 2 - inset)])
  P.box(mat, 0.022, 0.05, d - 2 * inset, [w / 2 - inset, ay, 0])
  P.box(mat, 0.022, 0.05, d - 2 * inset, [-(w / 2 - inset), ay, 0])
  const lx = w / 2 - 0.08
  const lz = d / 2 - 0.08
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.geo(taper(materialBox(mat, 0.068, h - top, 0.068), 0.68), mat, [sx * lx, (h - top) / 2, sz * lz])
  return { w, d }
}

/** Zabuton : coussin rembourré aux bords amincis, glands aux quatre coins, capiton central. */
export function cushion(P: Placer, mat = M().fabricDark, w = 0.62, d = 0.66) {
  const ochre = M().fabricOchre
  P.geo(pillowGeo(w, 0.1, d), mat, [0, 0.05, 0])
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const c: V3 = [sx * (w / 2 - 0.006), 0.05, sz * (d / 2 - 0.006)]
      P.geo(new THREE.SphereGeometry(0.012, 8, 6), ochre, c)
      const fringe = new THREE.ConeGeometry(0.016, 0.06, 8, 1, true)
      fringe.translate(0, -0.03, 0)
      P.geo(fringe, ochre, c, hang(new THREE.Vector3(sx, -1.6, sz)))
    }
  for (const a of [0.785, -0.785]) P.box(ochre, 0.03, 0.005, 0.005, [0, 0.099, 0], [0, a, 0])
}

/** Zaisu : chaise sans pieds — socle laqué, coussin, dossier cintré et rembourré, charnières. */
export function zaisu(P: Placer, mat = M().woodBlack, cushionMat = M().fabricRed) {
  P.rbox(mat, 0.56, 0.05, 0.56, 0.018, [0, 0.025, 0])
  P.geo(pillowGeo(0.5, 0.075, 0.48, 0.5), cushionMat, [0, 0.085, 0.02])
  // dossier : panneau qui enveloppe le dos et s'incline vers l'arrière
  const back = (w: number, h: number, t: number) => {
    const g = new THREE.BoxGeometry(w, h, t, 10, 6, 1)
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i) + h / 2
      pos.setXYZ(i, x, y, pos.getZ(i) + 0.07 * (x / (w / 2)) ** 2 + 0.02 * Math.sin((Math.PI * y) / h))
    }
    g.computeVertexNormals()
    scaleUV(g, w, h)
    return g
  }
  P.geo(back(0.52, 0.5, 0.03), mat, [0, 0.045, -0.26], [-0.32, 0, 0])
  P.geo(pillowGeo(0.42, 0.035, 0.36, 0.5), cushionMat, [0, 0.27, -0.285], [Math.PI / 2 - 0.32, 0, 0])
  for (const sx of [-1, 1]) P.box(M().iron, 0.04, 0.05, 0.012, [sx * 0.2, 0.06, -0.272], [-0.32, 0, 0])
}

export function pillar(P: Placer, h: number, w = 0.24, mat = M().woodDark, base = true) {
  P.box(mat, w, h, w, [0, h / 2, 0], [0, 0, 0], true)
  if (base) P.cyl(M().stoneDark, w * 0.85, w, 0.12, 8, [0, 0.06, 0])
}

/** Bibliothèque garnie (livres répartis sur 5 matériaux teintés). */
export function bookshelf(P: Placer, w: number, h: number, d: number, seed: number, bookMats: THREE.Material[], shelves = 6) {
  const m = M()
  const r = rng(seed)
  const t = 0.05
  P.box(m.woodDark, t, h, d, [-w / 2 + t / 2, h / 2, 0])
  P.box(m.woodDark, t, h, d, [w / 2 - t / 2, h / 2, 0])
  P.box(m.woodDark, w, t, d, [0, h - t / 2, 0])
  P.box(m.woodDark, w, 0.12, d, [0, 0.06, 0])
  P.box(m.woodDark, w, h, 0.02, [0, h / 2, -d / 2 + 0.01])
  const sh = (h - 0.17) / shelves
  for (let s = 0; s < shelves; s++) {
    const y0 = 0.12 + s * sh
    if (s > 0) P.box(m.woodDark, w - 2 * t, 0.035, d, [0, y0, 0])
    let x = -w / 2 + t + 0.01
    const end = w / 2 - t - 0.01
    const mode = r()
    while (x < end - 0.05) {
      if (mode < 0.18 && r() < 0.35) {
        // pile de rouleaux couchés
        const len = Math.min(end - x, range(r, 0.25, 0.5))
        for (let k = 0; k < 3 + Math.floor(r() * 3); k++) {
          const rr = range(r, 0.025, 0.04)
          P.cyl(k % 2 ? m.paperSheet : m.fabricOchre, rr, rr, d * 0.85, 8, [x + len / 2 + (r() - 0.5) * 0.04, y0 + 0.02 + rr + k * 0.05, 0], [Math.PI / 2, 0, 0])
        }
        x += len + 0.03
        continue
      }
      const bw = range(r, 0.025, 0.06)
      const bh = Math.min(sh - 0.05, range(r, sh * 0.55, sh * 0.92))
      const bd = d * range(r, 0.7, 0.92)
      const lean = r() < 0.08 ? 0.18 : 0
      const mat = bookMats[Math.floor(r() * bookMats.length)]
      P.box(mat, bw, bh, bd, [x + bw / 2, y0 + 0.02 + bh / 2, d / 2 - bd / 2 - 0.01], [0, 0, lean])
      x += bw + (lean ? 0.04 : 0.002)
      if (r() < 0.05) x += range(r, 0.05, 0.15)
    }
  }
}

/** Casier à rouleaux (makimono) : grille de cases dont dépassent les extrémités. */
export function scrollRack(P: Placer, w: number, h: number, d: number, cols: number, rows: number, seed: number) {
  const m = M()
  const r = rng(seed)
  const t = 0.035
  for (let c = 0; c <= cols; c++) P.box(m.woodDark, t, h, d, [-w / 2 + (c * w) / cols, h / 2, 0])
  for (let rr = 0; rr <= rows; rr++) P.box(m.woodDark, w + t, t, d, [0, (rr * h) / rows, 0])
  P.box(m.woodBlack, w, h, 0.02, [0, h / 2, -d / 2])
  const cw = w / cols
  const ch = h / rows
  const ends = [m.fabricRed, m.fabricIndigo, m.fabricOchre, m.paperSheet, m.fabricGreen]
  for (let c = 0; c < cols; c++)
    for (let rr = 0; rr < rows; rr++) {
      const n = 2 + Math.floor(r() * 5)
      for (let k = 0; k < n; k++) {
        const rad = range(r, 0.025, 0.04)
        const x = -w / 2 + c * cw + rad + 0.01 + r() * (cw - 2 * rad - 0.02)
        const y = rr * ch + rad + 0.02 + (k > 2 ? rad * 2 : 0)
        P.cyl(ends[Math.floor(r() * ends.length)], rad, rad, d * range(r, 0.8, 1.05), 8, [x, y, 0.02], [Math.PI / 2, 0, 0])
      }
    }
}

/** Paravent pliant (byōbu) en zigzag. */
export function byobu(P: Placer, mat: THREE.Material, panels = 6, pw = 0.5, h = 1.5) {
  const m = M()
  const ang = 0.38
  let x = -(panels * pw * Math.cos(ang)) / 2
  for (let i = 0; i < panels; i++) {
    const a = i % 2 === 0 ? ang : -ang
    const cx = x + (Math.cos(ang) * pw) / 2
    const cz = (i % 2 === 0 ? 1 : -1) * (Math.sin(ang) * pw) / 4
    const g = new THREE.PlaneGeometry(pw, h)
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / panels)
    P.geo(g, mat, [cx, h / 2 + 0.06, cz], [0, a, 0])
    P.box(m.woodBlack, pw + 0.03, 0.04, 0.04, [cx, h + 0.08, cz], [0, a, 0])
    P.box(m.woodBlack, pw + 0.03, 0.06, 0.04, [cx, 0.05, cz], [0, a, 0])
    x += Math.cos(ang) * pw
  }
}

export function kakejiku(P: Placer, mat: THREE.Material, w = 0.55, h = 1.65) {
  const g = new THREE.PlaneGeometry(w, h)
  P.geo(g, mat, [0, -h / 2, 0.012])
  P.cyl(M().woodBlack, 0.018, 0.018, w + 0.08, 8, [0, -h - 0.01, 0.025], [0, 0, Math.PI / 2])
  P.cyl(M().woodDark, 0.012, 0.012, w + 0.02, 6, [0, 0.0, 0.02], [0, 0, Math.PI / 2])
  P.cyl(M().rope, 0.004, 0.004, 0.3, 4, [0, 0.12, 0.02], [0, 0, 0])
}

export function tokonoma(P: Placer, w = 1.8, d = 0.7, mat = M().woodBlack) {
  P.box(mat, w, 0.14, d, [0, 0.07, 0])
  P.box(M().woodLight, w - 0.04, 0.012, d - 0.04, [0, 0.146, 0])
  P.box(M().woodMid, 0.13, 2.4, 0.13, [w / 2 + 0.06, 1.2, d / 2 - 0.06])
}

/**
 * Bonsaï de pin : pot rectangulaire non émaillé sur pieds, terre moussue bombée, tronc sinueux
 * à empattement (même bois que les arbres du domaine) et coussinets de pousses d'aiguilles.
 */
export function bonsai(P: Placer, s = 1) {
  const m = M()
  P.rbox(m.ceramicDark, 0.42 * s, 0.085 * s, 0.28 * s, 0.012 * s, [0, 0.0645 * s, 0])
  P.rbox(m.ceramicDark, 0.44 * s, 0.016 * s, 0.3 * s, 0.006 * s, [0, 0.1 * s, 0])
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.rbox(m.ceramicDark, 0.06 * s, 0.024 * s, 0.045 * s, 0.008 * s, [sx * 0.15 * s, 0.012 * s, sz * 0.095 * s])
  const soil = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2)
  soil.scale(0.2 * s, 0.03 * s, 0.13 * s)
  P.geo(soil, m.moss, [0, 0.104 * s, 0])
  P.geo(new THREE.DodecahedronGeometry(0.03 * s, 0), m.stoneDark, [-0.12 * s, 0.112 * s, 0.05 * s], [0.4, 0.7, 0], [1.3, 0.7, 1])
  // tronc : départ penché, contre-courbe, apex ; branches étagées terminées par un coussinet
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x * s, (0.105 + y) * s, z * s)
  const trunk = [v(0.03, 0, 0), v(0.08, 0.1, 0.01), v(0.02, 0.22, -0.01), v(-0.05, 0.33, 0.01), v(0.02, 0.45, 0)]
  const branches: Branch[] = [{ pts: trunk, radii: [0.032, 0.026, 0.02, 0.015, 0.009].map((x) => x * s) }]
  const pads: { c: THREE.Vector3; w: number }[] = [{ c: v(0.02, 0.5, 0), w: 0.1 }]
  const limbs: [number, THREE.Vector3, number][] = [
    [1, v(0.24, 0.14, 0.04), 0.12],
    [2, v(-0.2, 0.26, -0.03), 0.11],
    [3, v(0.17, 0.38, -0.05), 0.09],
    [2, v(-0.06, 0.3, 0.13), 0.08],
  ]
  for (const [i, tip, w] of limbs) {
    const a = trunk[i]
    const mid = a.clone().lerp(tip, 0.55).add(new THREE.Vector3(0, 0.025 * s, 0))
    branches.push({ pts: [a.clone(), mid, tip], radii: [0.011 * s, 0.008 * s, 0.005 * s] })
    pads.push({ c: tip.clone().add(new THREE.Vector3(0, 0.02 * s, 0)), w })
  }
  P.geo(woodGeometry(branches, 8), bonsaiBark())
  const needles = atlasLeaves('bonsai-needles', pineAtlas, 0xb4c0a6)
  const r = rng(Math.floor(s * 100))
  const up = new THREE.Vector3(0, 1, 0)
  for (const pd of pads) {
    for (let k = 0; k < 26; k++) {
      const rho = Math.sqrt(r())
      const a = r() * Math.PI * 2
      const off = new THREE.Vector3(Math.cos(a) * rho * pd.w * 1.2, 0, Math.sin(a) * rho * pd.w) .multiplyScalar(s)
      const p = pd.c.clone().add(off).add(new THREE.Vector3(0, (0.02 * Math.sqrt(1 - rho * rho) - 0.01) * s, 0))
      const dir = off.clone().normalize().multiplyScalar(0.3 + rho).addScaledVector(up, 1.2 - rho * 0.5).normalize()
      const n = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(Math.cos(a + 1.3), 0, Math.sin(a + 1.3))).normalize()
      for (const nn of [n, new THREE.Vector3().crossVectors(dir, n).normalize()]) placeCard(P, atlasCard(Math.floor(r() * 4), 0.09 * s), needles, p, dir, nn)
    }
  }
}

/**
 * Ikebana d'automne : vase de céramique au col évasé, eau, branche d'érable aux feuilles
 * rouges (atlas des érables) et deux chrysanthèmes blancs à double couronne de pétales.
 */
export function ikebana(P: Placer, s = 1) {
  const m = M()
  P.geo(
    latheGeo([[0, 0], [0.07, 0], [0.09, 0.08], [0.06, 0.2], [0.045, 0.28], [0.062, 0.305], [0.058, 0.312], [0.05, 0.3], [0.04, 0.285], [0, 0.285]], 20),
    m.ceramic,
    [0, 0, 0],
    [0, 0, 0],
    s,
  )
  P.geo(new THREE.CircleGeometry(0.041 * s, 16).rotateX(-Math.PI / 2), m.ink, [0, 0.288 * s, 0])
  const r = rng(Math.floor(s * 37))
  const leaves = atlasLeaves('ikebana-maple', mapleLeafAtlas, 0xffffff)
  const base = new THREE.Vector3(0, 0.29 * s, 0)
  // branche d'érable : deux rameaux ligneux, bouquets de feuilles sur la moitié haute
  for (let i = 0; i < 2; i++) {
    const a = r() * Math.PI * 2
    const tilt = 0.35 + r() * 0.4
    const len = (0.45 + r() * 0.3) * s
    const dir = new THREE.Vector3(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt))
    const pts = [base.clone(), base.clone().addScaledVector(dir, len * 0.5).add(new THREE.Vector3((r() - 0.5) * 0.06 * s, 0, (r() - 0.5) * 0.06 * s)), base.clone().addScaledVector(dir, len)]
    P.geo(tubeGeo(pts, 0.006 * s, 10, 5), m.woodDark)
    const curve = new THREE.CatmullRomCurve3(pts)
    for (let k = 0; k < 6; k++) {
      const p = curve.getPoint(0.45 + k * 0.1)
      const out = new THREE.Vector3(r() - 0.5, r() * 0.6, r() - 0.5).normalize()
      const n = new THREE.Vector3(r() - 0.5, 1, r() - 0.5).normalize()
      placeCard(P, atlasCard(Math.floor(r() * 4), (0.12 + r() * 0.05) * s), leaves, p, out, n)
    }
  }
  // chrysanthèmes : tige, capitule de pétales en deux couronnes, cœur doré
  for (let i = 0; i < 2; i++) {
    const a = r() * Math.PI * 2
    const tilt = 0.15 + r() * 0.3
    const len = (0.28 + r() * 0.12) * s
    const dir = new THREE.Vector3(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt))
    const head = base.clone().addScaledVector(dir, len)
    P.geo(tubeGeo([base.clone(), base.clone().addScaledVector(dir, len * 0.5), head], 0.004 * s, 8, 4), stem())
    const F = P.at(head.x, head.y, head.z)
    for (const [n, rr, lift] of [
      [16, 0.04, 0.4],
      [12, 0.028, 0.85],
    ] as const)
      for (let k = 0; k < n; k++) {
        const pa = (k / n) * Math.PI * 2 + (rr < 0.035 ? 0.3 : 0)
        const g = new THREE.PlaneGeometry(0.011 * s, rr * s)
        g.translate(0, (rr * s) / 2, 0)
        // pétale couché vers l'extérieur, relevé selon la couronne
        g.rotateX(-(Math.PI / 2 - lift))
        g.rotateY(-pa + Math.PI / 2)
        F.geo(g, petal())
      }
    F.geo(new THREE.SphereGeometry(0.011 * s, 8, 6), m.fabricOchre, [0, 0.004 * s, 0], [0, 0, 0], [1, 0.6, 1])
  }
}

/** Fumizukue : plateau à rebords relevés aux extrémités, pieds en panneau sur patins, tiroir. */
export function writingDesk(P: Placer, w = 1.1, d = 0.5) {
  const m = M()
  P.box(m.woodMid, w, 0.03, d, [0, 0.305, 0])
  for (const sx of [-1, 1]) {
    P.box(m.woodMid, 0.028, 0.02, d, [sx * (w / 2 - 0.014), 0.33, 0])
    P.box(m.woodMid, 0.03, 0.26, d - 0.08, [sx * (w / 2 - 0.06), 0.16, 0])
    P.box(m.woodDark, 0.055, 0.026, d - 0.02, [sx * (w / 2 - 0.06), 0.013, 0])
  }
  P.box(m.woodDark, w - 0.18, 0.06, 0.02, [0, 0.255, d / 2 - 0.05])
  P.box(m.woodDark, w - 0.18, 0.014, d - 0.12, [0, 0.228, -0.01])
  P.geo(archGeo(0.018, 0.0028), m.bronze, [0, 0.245, d / 2 - 0.036], [0, 0, Math.PI])
  P.box(m.bronze, 0.05, 0.016, 0.003, [0, 0.262, d / 2 - 0.039])
}

/** Nécessaire à encre : pierre (plateau de broyage, réservoir), bâton d'encre, pinceau sur son repose-pinceau, pot à eau. */
export function inkSet(P: Placer) {
  const m = M()
  P.rbox(m.stoneDark, 0.1, 0.024, 0.17, 0.006, [0, 0.012, 0])
  P.box(m.ink, 0.074, 0.003, 0.098, [0, 0.0245, 0.022])
  P.box(m.ink, 0.074, 0.003, 0.03, [0, 0.019, -0.06])
  P.box(m.ink, 0.02, 0.012, 0.075, [-0.005, 0.032, 0.03], [0, 0.18, 0])
  P.box(m.gold, 0.012, 0.0125, 0.03, [-0.005, 0.0321, 0.035], [0, 0.18, 0])
  // repose-pinceau, pinceau (manche de bambou, virole, touffe de poils)
  P.rbox(m.ceramic, 0.018, 0.012, 0.05, 0.005, [0.092, 0.006, 0.06])
  const B = P.at(0.092, 0.017, 0.0, 0)
  B.cyl(m.woodLight, 0.0052, 0.0052, 0.17, 8, [0, 0, 0.02], [Math.PI / 2, 0, 0])
  B.cyl(m.ink, 0.0062, 0.0062, 0.014, 8, [0, 0, -0.068], [Math.PI / 2, 0, 0])
  const hair = new THREE.ConeGeometry(0.0062, 0.034, 8)
  B.geo(hair, m.ink, [0, 0, -0.092], [-Math.PI / 2, 0, 0])
  // pot à eau (suiteki)
  P.geo(latheGeo([[0, 0], [0.016, 0], [0.022, 0.01], [0.02, 0.022], [0.008, 0.028], [0.005, 0.034], [0, 0.034]], 14), m.ceramic, [0.088, 0, -0.062])
}

/** Service à thé : théière (kyūsu) à anse latérale, bec et couvercle, deux tasses épaisses garnies de thé. */
export function teaSet(P: Placer) {
  const m = M()
  P.geo(latheGeo([[0, 0], [0.04, 0], [0.055, 0.012], [0.062, 0.035], [0.058, 0.06], [0.045, 0.075], [0.036, 0.078], [0, 0.078]], 22), m.ceramicDark)
  P.geo(latheGeo([[0.036, 0], [0.034, 0.008], [0.02, 0.014], [0.008, 0.016], [0, 0.016]], 18), m.ceramicDark, [0, 0.076, 0])
  P.geo(new THREE.SphereGeometry(0.008, 8, 6), m.ceramicDark, [0, 0.096, 0], [0, 0, 0], [1, 0.8, 1])
  P.geo(tubeGeo([new THREE.Vector3(0.05, 0.03, 0), new THREE.Vector3(0.075, 0.045, 0), new THREE.Vector3(0.092, 0.07, 0)], 0.0075, 10, 8), m.ceramicDark)
  P.cyl(m.ceramicDark, 0.011, 0.014, 0.08, 10, [0, 0.042, -0.095], [Math.PI / 2 - 0.15, 0, 0])
  for (const [x, z] of [
    [0.14, 0.05],
    [0.12, -0.08],
  ]) {
    P.geo(latheGeo([[0, 0], [0.022, 0], [0.025, 0.004], [0.031, 0.054], [0.028, 0.056], [0.025, 0.012], [0, 0.012]], 18), m.ceramic, [x, 0, z])
    P.geo(new THREE.CircleGeometry(0.026, 16).rotateX(-Math.PI / 2), tea(), [x, 0.044, z])
  }
}

export function paperStack(P: Placer, n = 8, w = 0.21, d = 0.3, seed = 1) {
  const r = rng(seed)
  for (let i = 0; i < n; i++) P.box(M().paperSheet, w, 0.004, d, [(r() - 0.5) * 0.02, 0.002 + i * 0.0045, (r() - 0.5) * 0.02], [0, (r() - 0.5) * 0.12, 0])
}

export function bookStack(P: Placer, n: number, seed: number, mats: THREE.Material[]) {
  const r = rng(seed)
  let y = 0
  for (let i = 0; i < n; i++) {
    const h = range(r, 0.025, 0.05)
    P.box(mats[Math.floor(r() * mats.length)], range(r, 0.16, 0.24), h, range(r, 0.22, 0.3), [(r() - 0.5) * 0.03, y + h / 2, (r() - 0.5) * 0.03], [0, (r() - 0.5) * 0.3, 0])
    y += h
  }
}

export function openScroll(P: Placer, mat: THREE.Material, w = 0.34, l = 0.62) {
  const g = new THREE.PlaneGeometry(w, l)
  g.rotateX(-Math.PI / 2)
  P.geo(g, mat, [0, 0.004, 0])
  P.cyl(M().woodDark, 0.018, 0.018, w + 0.06, 8, [0, 0.018, -l / 2], [0, 0, Math.PI / 2])
  P.cyl(M().paperSheet, 0.024, 0.024, w, 8, [0, 0.024, l / 2], [0, 0, Math.PI / 2])
}

/**
 * Tansu : coffre à tiroirs — plateau débordant, socle, façades en retrait, poignées en anse
 * (warabite) sur platines, serrure ronde, équerres d'angle et poignées de transport latérales.
 */
export function tansu(P: Placer, w = 1.0, h = 0.9, d = 0.45, seed = 3) {
  const m = M()
  const r = rng(seed)
  P.box(m.woodMid, w, h - 0.05, d, [0, 0.05 + (h - 0.05) / 2, 0], [0, 0, 0], true)
  P.box(m.woodMid, w + 0.03, 0.03, d + 0.02, [0, h + 0.015, 0])
  P.box(m.woodDark, w + 0.01, 0.05, d + 0.01, [0, 0.025, 0])
  const rows = 3 + Math.floor(r() * 2)
  let locked = false
  for (let i = 0; i < rows; i++) {
    const y = 0.08 + ((i + 0.5) * (h - 0.12)) / rows
    const dh = (h - 0.12) / rows - 0.02
    const split = i === 0 && r() < 0.6
    const parts = split ? 2 : 1
    for (let k = 0; k < parts; k++) {
      const dw = (w - 0.06) / parts
      const x = -w / 2 + 0.03 + dw * (k + 0.5)
      P.box(m.woodDark, dw - 0.02, dh, 0.014, [x, y, d / 2 + 0.007])
      // poignée : platine, anse qui pend
      const hx = parts === 1 && dw > 0.6 ? [x - dw * 0.28, x + dw * 0.28] : [x]
      for (const px of hx) {
        P.box(m.iron, 0.075, 0.028, 0.003, [px, y + dh * 0.12, d / 2 + 0.0155])
        P.geo(archGeo(0.026, 0.0035), m.iron, [px, y + dh * 0.12 + 0.004, d / 2 + 0.02], [0, 0, Math.PI])
      }
      if (!locked && parts === 1) {
        locked = true
        P.cyl(m.iron, 0.028, 0.028, 0.003, 18, [x, y - dh * 0.18, d / 2 + 0.0155], [Math.PI / 2, 0, 0])
        P.box(lacquer(), 0.006, 0.016, 0.002, [x, y - dh * 0.18, d / 2 + 0.0175])
      }
    }
  }
  for (const sx of [-1, 1]) {
    P.box(m.iron, 0.02, h - 0.05, 0.02, [(sx * w) / 2, 0.05 + (h - 0.05) / 2, d / 2])
    // équerres d'angle (haut et bas de la façade)
    for (const y of [h - 0.03, 0.08]) {
      P.box(m.iron, 0.07, 0.022, 0.003, [sx * (w / 2 - 0.035), y, d / 2 + 0.0155])
      P.box(m.iron, 0.003, 0.07, 0.022, [sx * (w / 2 + 0.0015), y + (y > h / 2 ? -0.025 : 0.025), d / 2 - 0.035])
    }
    // poignée de transport sur le flanc
    P.box(m.iron, 0.003, 0.03, 0.12, [sx * (w / 2 + 0.0015), h - 0.12, 0])
    P.geo(archGeo(0.045, 0.005), m.iron, [sx * (w / 2 + 0.008), h - 0.115, 0], [0, Math.PI / 2, Math.PI])
  }
}

function shurikenGeo() {
  const s = new THREE.Shape()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const r = i % 2 === 0 ? 0.06 : 0.018
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  s.closePath()
  const hole = new THREE.Path()
  hole.absarc(0, 0, 0.008, 0, Math.PI * 2, true)
  s.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 })
  return g
}

function kunaiBladeGeo() {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.lineTo(0.022, 0.03)
  s.lineTo(0, 0.17)
  s.lineTo(-0.022, 0.03)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 1 })
}

export function kunai(P: Placer) {
  const m = M()
  P.geo(kunaiBladeGeo(), m.iron, [0, 0.11, -0.002])
  P.cyl(m.rope, 0.008, 0.008, 0.1, 6, [0, 0.055, 0])
  P.geo(new THREE.TorusGeometry(0.016, 0.004, 6, 12), m.iron, [0, -0.012, 0])
}

export function shuriken(P: Placer) {
  P.geo(shurikenGeo(), M().iron)
}

/** Présentoir mural d'armes shinobi. */
export function weaponDisplay(P: Placer, w = 1.2) {
  const m = M()
  P.box(m.woodBlack, w, 0.7, 0.04, [0, 0.35, 0])
  P.box(m.fabricRed, w - 0.1, 0.6, 0.01, [0, 0.35, 0.025])
  for (let i = 0; i < 5; i++) kunai(P.at(-w / 2 + 0.16 + i * 0.12, 0.2, 0.035, 0))
  for (let i = 0; i < 3; i++) shuriken(P.at(w / 2 - 0.4 + i * 0.13, 0.5, 0.03))
  for (let i = 0; i < 2; i++) P.geo(shurikenGeo(), m.iron, [w / 2 - 0.33 + i * 0.13, 0.25, 0.03], [0, 0, 0.4])
}

/**
 * Katana-kake : socle et montants laqués, et deux sabres (daishō) — fourreau laqué à peine
 * courbe, embout de fer, tsuba entre deux rondelles dorées, poignée tressée, pommeau.
 */
export function katanaStand(P: Placer) {
  const m = M()
  const lq = lacquer()
  P.rbox(lq, 0.62, 0.04, 0.2, 0.01, [0, 0.02, 0])
  for (const sx of [-1, 1]) {
    P.rbox(lq, 0.045, 0.38, 0.13, 0.01, [sx * 0.25, 0.21, 0])
    P.box(m.gold, 0.048, 0.006, 0.133, [sx * 0.25, 0.402, 0])
  }
  for (let k = 0; k < 2; k++) {
    const y = 0.25 + k * 0.1
    const L = k === 0 ? 0.98 : 0.68
    const grip = k === 0 ? 0.26 : 0.18
    const x0 = -0.34 + k * 0.08
    const x1 = x0 + L
    const xg = x1 - grip
    const sori = 0.014
    const at = (x: number) => new THREE.Vector3(x, y + sori * (((x - (x0 + x1) / 2) / (L / 2)) ** 2 - 1), 0.02)
    // fourreau (saya) et embout (kojiri)
    P.geo(tubeGeo([at(x0 + 0.02), at((x0 + xg) / 2), at(xg - 0.012)], 0.016, 20, 10), lq)
    P.geo(new THREE.SphereGeometry(0.0165, 10, 8), m.iron, at(x0 + 0.02).toArray() as V3, [0, 0, 0], [1.4, 1, 1])
    // tsuba et rondelles, habaki
    const tp = at(xg - 0.006)
    P.cyl(m.iron, 0.036, 0.036, 0.006, 20, tp.toArray() as V3, [0, 0, Math.PI / 2])
    for (const dx of [-0.006, 0.006]) P.cyl(m.gold, 0.02, 0.02, 0.003, 14, [tp.x + dx, tp.y, tp.z], [0, 0, Math.PI / 2])
    // poignée (tsuka) : âme claire, tresse sombre en anneaux, pommeau (kashira)
    P.geo(tubeGeo([at(xg + 0.004), at(xg + grip / 2), at(x1 - 0.012)], 0.0145, 10, 10), m.fabricIndigo)
    for (let w = xg + 0.02; w < x1 - 0.02; w += 0.022) {
      const t = new THREE.TorusGeometry(0.0148, 0.0035, 5, 12)
      t.rotateY(Math.PI / 2)
      P.geo(t, m.fabricDark, at(w).toArray() as V3, [0, 0, 0.55])
    }
    P.geo(new THREE.SphereGeometry(0.0155, 10, 8), m.iron, at(x1 - 0.008).toArray() as V3, [0, 0, 0], [0.8, 1, 1])
  }
}

export function incenseBurner(P: Placer) {
  const m = M()
  P.geo(latheGeo([[0, 0], [0.06, 0], [0.08, 0.05], [0.07, 0.09], [0.075, 0.1]], 12), m.bronze)
  for (let i = 0; i < 3; i++) P.cyl(m.bronze, 0.008, 0.008, 0.03, 4, [Math.cos((i * Math.PI * 2) / 3) * 0.05, -0.01, Math.sin((i * Math.PI * 2) / 3) * 0.05])
  P.cyl(m.woodDark, 0.002, 0.002, 0.14, 4, [0, 0.16, 0], [0.1, 0, 0.05])
}

export function antlers(P: Placer, s = 1) {
  const m = M().woodLight
  for (const side of [-1, 1]) {
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.06 * side * s, 0.12 * s, 0.02 * s),
      new THREE.Vector3(0.15 * side * s, 0.26 * s, -0.02 * s),
      new THREE.Vector3(0.2 * side * s, 0.42 * s, 0.02 * s),
    ]
    P.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.016 * s, 5), m)
    const tine = (from: number, dir: THREE.Vector3) => {
      const p = new THREE.CatmullRomCurve3(pts).getPoint(from)
      P.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p, p.clone().addScaledVector(dir, 0.08 * s), p.clone().addScaledVector(dir, 0.14 * s).add(new THREE.Vector3(0, 0.04 * s, 0))]), 4, 0.01 * s, 4), m)
    }
    tine(0.35, new THREE.Vector3(0.2 * side, 0.6, 0.6).normalize())
    tine(0.7, new THREE.Vector3(-0.3 * side, 0.8, -0.2).normalize())
  }
  P.box(M().woodBlack, 0.22 * s, 0.28 * s, 0.03 * s, [0, -0.02, -0.04])
}

export function railing(P: Placer, len: number, h = 0.9, mat = M().woodDark, posts = 1.8) {
  const n = Math.max(1, Math.round(len / posts))
  for (let i = 0; i <= n; i++) P.box(mat, 0.09, h, 0.09, [-len / 2 + (i * len) / n, h / 2, 0])
  P.box(mat, len + 0.1, 0.07, 0.1, [0, h, 0])
  P.box(mat, len, 0.05, 0.06, [0, h * 0.45, 0])
  P.box(mat, len, 0.04, 0.05, [0, 0.12, 0])
}

/** Panneau d'affichage en bois avec feuillets épinglés. */
export function noticeBoard(P: Placer, w: number, h: number, sheets: THREE.Material[], seed = 4) {
  const m = M()
  const r = rng(seed)
  P.box(m.woodMid, w, h, 0.05, [0, 0, 0])
  P.box(m.woodBlack, w + 0.16, 0.1, 0.1, [0, h / 2 + 0.05, 0.02])
  P.box(m.woodBlack, w + 0.08, 0.06, 0.08, [0, -h / 2 - 0.03, 0.02])
  P.box(m.woodBlack, 0.12, 0.08, 0.12, [-w / 2 - 0.04, h / 2 + 0.14, 0.02])
  P.box(m.woodBlack, 0.12, 0.08, 0.12, [w / 2 + 0.04, h / 2 + 0.14, 0.02])
  const cols = Math.max(2, Math.floor(w / 0.38))
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < 2; j++) {
      if (r() < 0.15) continue
      const g = new THREE.PlaneGeometry(0.28, 0.36)
      const x = -w / 2 + ((i + 0.5) * w) / cols + (r() - 0.5) * 0.05
      const y = h / 2 - 0.28 - j * (h / 2) + (r() - 0.5) * 0.05
      P.geo(g, sheets[Math.floor(r() * sheets.length)], [x, y, 0.03 + r() * 0.004], [0, 0, (r() - 0.5) * 0.12])
      P.cyl(m.fabricRed, 0.01, 0.01, 0.01, 6, [x, y + 0.15, 0.038], [Math.PI / 2, 0, 0])
    }
  }
}

/** Brasero (hibachi) : la braise est un matériau émissif séparé. */
export function hibachi(P: Placer, r0 = 0.28) {
  const m = M()
  P.geo(latheGeo([[0, 0.05], [r0 * 0.7, 0.05], [r0, 0.18], [r0 * 1.02, 0.36], [r0 * 0.92, 0.37], [r0 * 0.88, 0.28], [0, 0.26]], 18), m.bronze)
  P.geo(new THREE.CircleGeometry(r0 * 0.86, 16), m.ember, [0, 0.3, 0], [-Math.PI / 2, 0, 0])
  for (let i = 0; i < 3; i++) P.cyl(m.bronze, 0.03, 0.03, 0.06, 6, [Math.cos((i * Math.PI * 2) / 3) * r0 * 0.7, 0.03, Math.sin((i * Math.PI * 2) / 3) * r0 * 0.7])
}

/** Estrade de bois (enseignant, autel). */
export function dais(P: Placer, w: number, d: number, h = 0.35, mat = M().woodDark) {
  P.box(mat, w, h, d, [0, h / 2, 0], [0, 0, 0], true)
  P.box(M().woodBlack, w + 0.04, 0.05, d + 0.04, [0, h - 0.02, 0])
  P.box(mat, w * 0.4, h / 2, 0.35, [0, h / 4, d / 2 + 0.17])
}
