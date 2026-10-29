/**
 * Érable japonais (Acer palmatum) procédural.
 * Bois : tronc à empattement, ramification récursive en étages horizontaux, effilement continu,
 * tubes à anneaux en repère de transport parallèle (pas de torsion), UV en mètres pour l'écorce PBR.
 * Feuillage : milliers de cartes instanciées portées par les rameaux terminaux ; chaque carte
 * porte un bouquet de feuilles palmées (5 à 7 lobes dentés) dessinées sur un atlas, en rouges,
 * bordeaux et orangés ; normales bombées vers l'extérieur de la couronne, vent et frémissement
 * dans le shader (repris dans le matériau d'ombre pour que l'ombre bouge avec les feuilles).
 */
import * as THREE from 'three'
import { rng } from '../core/math'
import { makeCanvas, ctx2d } from '../textures/util'
import { dynamicTexture, cachedMaterial, M } from './assets'
import { PBR, PBR_SIZE } from './pbr'
import { windUniforms } from './wind'

export interface MapleOpts {
  seed: number
  /** hauteur visée (m) */
  height: number
  /** densité du feuillage (1 = arbre « héros ») */
  leaves: number
  /** finesse des tubes (segments radiaux du tronc) */
  radial: number
}

export interface Branch {
  pts: THREE.Vector3[]
  radii: number[]
}

/** Squelette : liste de branches (polylignes et rayons) et points d'attache des feuilles. */
function skeleton(o: MapleOpts) {
  const r = rng(o.seed * 131 + 7)
  const branches: Branch[] = []
  const tips: { p: THREE.Vector3; d: THREE.Vector3 }[] = []
  const H = o.height
  const up = new THREE.Vector3(0, 1, 0)
  const tmp = new THREE.Vector3()
  const grow = (start: THREE.Vector3, dir: THREE.Vector3, len: number, r0: number, depth: number) => {
    const steps = depth === 0 ? 6 : depth < 3 ? 5 : 4
    const pts = [start.clone()]
    const radii = [r0]
    const d = dir.clone()
    const p = start.clone()
    const r1 = r0 * (depth === 0 ? 0.62 : 0.58)
    for (let i = 1; i <= steps; i++) {
      // courbure naturelle : flexion aléatoire, port étalé (étages), légère retombée des rameaux
      tmp.set(r() - 0.5, (r() - 0.5) * 0.5, r() - 0.5).multiplyScalar(depth === 0 ? 0.22 : 0.38)
      d.add(tmp)
      if (depth >= 1) d.y = d.y * 0.86 - 0.02 * depth
      if (depth === 0) d.lerp(up, 0.15)
      d.normalize()
      p.addScaledVector(d, len / steps)
      pts.push(p.clone())
      radii.push(r0 + (r1 - r0) * (i / steps))
    }
    branches.push({ pts, radii })
    if (depth >= 5 || r1 < 0.005) {
      for (let i = 1; i < pts.length; i++) tips.push({ p: pts[i].clone(), d: d.clone() })
      return
    }
    // feuillage intérieur porté par les branches moyennes
    if (depth >= 3) tips.push({ p: pts[pts.length - 1].clone(), d: d.clone() })
    // ramifications : bout de branche + départs latéraux
    const kids = depth === 0 ? 4 : depth < 4 ? 3 : 2
    for (let k = 0; k < kids; k++) {
      const t = k === 0 ? 1 : 0.45 + r() * 0.5
      const at = Math.min(steps, Math.max(1, Math.round(t * steps)))
      const base = pts[at]
      const cd = d.clone()
      // écartement autour de l'axe parent, biaisé vers l'horizontale (port en nappes)
      const axis = new THREE.Vector3(r() - 0.5, 0, r() - 0.5).normalize()
      const spread = depth === 0 ? 0.55 + r() * 0.45 : 0.45 + r() * 0.5
      cd.applyAxisAngle(axis, spread * (k === 0 && depth > 0 ? 0.4 : 1))
      cd.applyAxisAngle(up, (k / kids) * Math.PI * 2 + r() * 0.9)
      if (depth === 0) cd.y = Math.max(0.35, cd.y)
      cd.normalize()
      const lr = depth === 0 ? H * (0.32 + r() * 0.08) : len * (0.64 + r() * 0.1)
      grow(base, cd, lr, radii[at] * (k === 0 ? 0.82 : 0.66), depth + 1)
    }
  }
  const lean = new THREE.Vector3((r() - 0.5) * 0.3, 1, (r() - 0.5) * 0.3).normalize()
  grow(new THREE.Vector3(0, -0.05, 0), lean, H * 0.34, 0.12 * (H / 4), 0)
  return { branches, tips }
}

/** Tubes du bois, fusionnés ; UV : u = tour (m), v = longueur (m). */
export function woodGeometry(branches: Branch[], radialTrunk: number) {
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const T = new THREE.Vector3()
  const N = new THREE.Vector3()
  const B = new THREE.Vector3()
  const prevT = new THREE.Vector3()
  for (let bi = 0; bi < branches.length; bi++) {
    const { pts, radii } = branches[bi]
    const radial = Math.max(4, Math.round(radialTrunk * Math.min(1, Math.sqrt(radii[0] / 0.1))))
    const base = pos.length / 3
    let vlen = 0
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)]
      const b = pts[Math.min(pts.length - 1, i + 1)]
      T.subVectors(b, a).normalize()
      if (i === 0) {
        N.set(0, 1, 0)
        if (Math.abs(T.dot(N)) > 0.9) N.set(1, 0, 0)
        N.crossVectors(T, N).normalize()
      } else {
        // transport parallèle du repère
        const ax = new THREE.Vector3().crossVectors(prevT, T)
        const s = ax.length()
        if (s > 1e-5) N.applyAxisAngle(ax.normalize(), Math.asin(Math.min(1, s)))
      }
      prevT.copy(T)
      B.crossVectors(T, N).normalize()
      if (i > 0) vlen += pts[i].distanceTo(pts[i - 1])
      let rad = radii[i]
      // empattement et contreforts au pied du tronc
      if (bi === 0 && i === 0) rad *= 1.65
      if (bi === 0 && i === 1) rad *= 1.12
      const circ = Math.PI * 2 * rad
      for (let k = 0; k <= radial; k++) {
        const ang = (k / radial) * Math.PI * 2
        const c = Math.cos(ang), s = Math.sin(ang)
        const flare = bi === 0 && i === 0 ? 1 + 0.18 * Math.max(0, Math.sin(ang * 3 + 1)) : 1
        const nx = N.x * c + B.x * s, ny = N.y * c + B.y * s, nz = N.z * c + B.z * s
        pos.push(pts[i].x + nx * rad * flare, pts[i].y + ny * rad * flare, pts[i].z + nz * rad * flare)
        nor.push(nx, ny, nz)
        uv.push((k / radial) * Math.max(circ, 0.05), vlen)
      }
      if (i > 0) {
        const r0 = base + (i - 1) * (radial + 1)
        const r1 = base + i * (radial + 1)
        // faces tournées vers l'extérieur (sens trigonométrique vu du dehors)
        for (let k = 0; k < radial; k++) idx.push(r0 + k, r0 + k + 1, r1 + k, r0 + k + 1, r1 + k + 1, r1 + k)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

/* ------------------------------ atlas de feuilles ------------------------------ */
const LEAF_COLORS = ['#b3241b', '#8f1a17', '#c83a1e', '#a52a1c', '#d2582a', '#e07a34', '#72161a', '#bd3020']

/** Une feuille palmée : `lobes` lobes lancéolés dentés rayonnant depuis le pétiole. */
function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number, color: string, r: () => number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  const lobes = r() < 0.6 ? 7 : 5
  const span = lobes === 7 ? Math.PI * 1.55 : Math.PI * 1.25
  // pétiole
  ctx.strokeStyle = '#5a1810'
  ctx.lineWidth = size * 0.025
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, size * 0.42)
  ctx.stroke()
  const grad = ctx.createRadialGradient(0, 0, size * 0.04, 0, 0, size)
  grad.addColorStop(0, '#4a1210')
  grad.addColorStop(0.35, color)
  grad.addColorStop(1, color)
  ctx.fillStyle = grad
  for (let l = 0; l < lobes; l++) {
    const a = -Math.PI / 2 - span / 2 + (l / (lobes - 1)) * span
    const len = size * (1 - Math.abs(l - (lobes - 1) / 2) / lobes * 0.75) * (0.92 + r() * 0.12)
    const w = len * 0.24
    ctx.save()
    ctx.rotate(a + Math.PI / 2)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    // bord gauche denté puis bord droit, pointe effilée
    const teeth = 9
    for (let t = 1; t <= teeth; t++) {
      const f = t / teeth
      const ww = w * Math.sin(Math.PI * Math.pow(f, 0.8)) * (t % 2 ? 1 : 0.8)
      ctx.lineTo(-ww, -len * f)
    }
    for (let t = teeth; t >= 1; t--) {
      const f = t / teeth
      const ww = w * Math.sin(Math.PI * Math.pow(f, 0.8)) * (t % 2 ? 1 : 0.8)
      ctx.lineTo(ww, -len * f)
    }
    ctx.closePath()
    ctx.fill()
    // nervure médiane
    ctx.strokeStyle = 'rgba(255,190,140,0.28)'
    ctx.lineWidth = size * 0.012
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -len * 0.9)
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
}

/** Atlas 2×2 : quatre bouquets de feuilles différents (canal alpha = découpe). */
export function mapleLeafAtlas() {
  return dynamicTexture('maple-leaf-atlas-v2', () => {
    const S = 1024
    const c = makeCanvas(S, S)
    const ctx = ctx2d(c)
    ctx.clearRect(0, 0, S, S)
    const r = rng(4242)
    for (let q = 0; q < 4; q++) {
      const ox = (q % 2) * 512
      const oy = Math.floor(q / 2) * 512
      const n = 5 + Math.floor(r() * 3)
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2
        const d = 40 + r() * 120
        const x = ox + 256 + Math.cos(a) * d
        const y = oy + 256 + Math.sin(a) * d
        const size = 95 + r() * 55
        // les feuilles restent dans leur case (pas de débord sur la voisine)
        const sz = Math.min(size, x - ox - 8, ox + 504 - x, y - oy - 8, oy + 504 - y)
        if (sz < 50) continue
        drawLeaf(ctx, x, y, sz, a + Math.PI / 2 + (r() - 0.5) * 0.8, LEAF_COLORS[Math.floor(r() * LEAF_COLORS.length)], r)
      }
    }
    return c
  })
}

/* ------------------------------ matériaux ------------------------------ */
export function barkMaterial() {
  return cachedMaterial('maple-bark', () => {
    const s = PBR().trident_maple_bark
    if (!s) return M().bark
    const rep = 1 / PBR_SIZE.trident_maple_bark
    const c = (t: THREE.Texture) => {
      const x = t.clone()
      x.repeat.set(rep, rep)
      x.needsUpdate = true
      return x
    }
    const arm = c(s.arm)
    return new THREE.MeshStandardMaterial({
      color: 0xb8aea6,
      map: c(s.map),
      normalMap: c(s.normalMap),
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughnessMap: arm,
      aoMap: arm,
      roughness: 1,
    })
  })
}

// Centre de couronne et hauteur de l'arbre portés par instance (dans l'espace du maillage) :
// un même maillage peut ainsi regrouper les feuilles de plusieurs arbres.
const LEAF_VERT_HEAD = /* glsl */ `
uniform float uTime;
attribute vec4 aTree;
`
const LEAF_VERT_BODY = /* glsl */ `
{
  vec3 ip = instanceMatrix[3].xyz;
  float hk = clamp((ip.y - aTree.y + aTree.w * 0.5) / aTree.w, 0.0, 1.0);
  float ph = ip.x * 1.7 + ip.z * 1.3;
  float t = uTime;
  // balancement de la couronne puis frémissement de chaque carte (pointe plus mobile)
  vec3 sway = vec3(sin(t * 0.9 + ph * 0.2) * 0.7 + sin(t * 2.1 + ph * 0.5) * 0.3, 0.0, cos(t * 0.7 + ph * 0.3) * 0.5) * 0.045 * hk;
  float fl = sin(t * 7.3 + ph * 5.0) * 0.5 + sin(t * 11.0 + ph * 3.0) * 0.5;
  transformed += sway;
  transformed.y += fl * 0.012 * uv.y;
}
`
const CELL_HEAD = 'attribute vec2 aCell;'
const CELL_BODY = '#ifdef USE_MAP\nvMapUv += aCell;\n#endif'

/** Matériaux du feuillage instancié (couleur, ombre) : normales bombées depuis le centre de la couronne. */
export function leafMaterials() {
  return cachedMaterial('maple-leaves-v3', () => {
    const atlas = mapleLeafAtlas()
    const uniforms = { uTime: windUniforms.uTime }
    const mat = new THREE.MeshStandardMaterial({ map: atlas, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.62, metalness: 0, envMapIntensity: 0.6 })
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms)
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${LEAF_VERT_HEAD}\n${CELL_HEAD}`)
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
{
  // normale de la carte mêlée à la direction centre → feuille : la couronne s'éclaire comme un volume
  vec3 ip = instanceMatrix[3].xyz;
  vec3 outward = normalize(ip - aTree.xyz + vec3(0.0, 0.25 * aTree.w, 0.0));
  mat3 im = mat3(instanceMatrix);
  vec3 localOut = normalize(transpose(im) * outward);
  objectNormal = normalize(mix(objectNormal, localOut, 0.65));
}`,
        )
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${LEAF_VERT_BODY}`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>\n${CELL_BODY}`)
      // lumière transmise : le contre-jour rougeoie un peu au lieu de virer au noir
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.06;')
    }
    mat.customProgramCacheKey = () => 'maple-leaves-v3'
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: 0.45, side: THREE.DoubleSide })
    depth.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms)
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${LEAF_VERT_HEAD}\n${CELL_HEAD}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${LEAF_VERT_BODY}`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>\n${CELL_BODY}`)
    }
    depth.customProgramCacheKey = () => 'maple-leaves-depth-v3'
    mat.userData.depth = depth
    return mat
  })
}

/** Gabarit d'arbre : bois et cartes de feuilles en coordonnées locales. */
export interface MapleTemplate {
  wood: THREE.BufferGeometry
  cards: THREE.Matrix4[]
  colors: THREE.Color[]
  cells: number[]
  center: THREE.Vector3
  height: number
}

export function mapleTemplate(o: MapleOpts): MapleTemplate {
  const { branches, tips } = skeleton(o)
  const wood = woodGeometry(branches, o.radial)
  const r = rng(o.seed * 17 + 3)
  const box = new THREE.Box3()
  for (const t of tips) box.expandByPoint(t.p)
  const center = box.getCenter(new THREE.Vector3())
  const radius = box.getSize(new THREE.Vector3()).length() / 2
  const per = Math.max(1, Math.round(4 * o.leaves))
  const cards: THREE.Matrix4[] = []
  const colors: THREE.Color[] = []
  const cells: number[] = []
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  const z = new THREE.Vector3(0, 0, 1)
  for (const t of tips) {
    for (let j = 0; j < per; j++) {
      p.copy(t.p).add(new THREE.Vector3((r() - 0.5) * 0.28, (r() - 0.35) * 0.16, (r() - 0.5) * 0.28))
      // orientation : vers le haut et l'extérieur, avec du désordre
      n.copy(p).sub(center).setY(0).normalize().multiplyScalar(0.6).add(new THREE.Vector3((r() - 0.5) * 0.9, 1, (r() - 0.5) * 0.9)).normalize()
      q.setFromUnitVectors(z, n)
      q.multiply(new THREE.Quaternion().setFromAxisAngle(z, r() * Math.PI * 2))
      const sc = (0.3 + r() * 0.16) * (o.height / 4)
      s.set(sc, sc, sc)
      cards.push(new THREE.Matrix4().compose(p, q, s))
      // teinte : extérieur et sommet plus vifs/orangés, cœur plus sombre (bordeaux)
      const out = THREE.MathUtils.clamp(p.distanceTo(center) / radius, 0, 1)
      const top = THREE.MathUtils.clamp((p.y - box.min.y) / Math.max(0.1, box.max.y - box.min.y), 0, 1)
      const bright = 0.72 + 0.3 * out + 0.12 * top + (r() - 0.5) * 0.14
      colors.push(new THREE.Color().setRGB(bright * (1 + (r() - 0.5) * 0.08), bright * (0.92 + r() * 0.12 + top * 0.06), bright * (0.9 + r() * 0.1)))
      const c = Math.floor(r() * 4)
      cells.push((c % 2) * 0.5, Math.floor(c / 2) * 0.5)
    }
  }
  return { wood, cards, colors, cells, center, height: o.height }
}

/**
 * Feuillage de plusieurs arbres d'un même gabarit en un seul maillage instancié
 * (`trees` : matrices des arbres dans l'espace du maillage).
 */
export function leafMesh(tpl: MapleTemplate, trees: THREE.Matrix4[]) {
  const card = new THREE.PlaneGeometry(1, 1)
  const uvs = card.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * 0.5, uvs.getY(i) * 0.5)
  const count = tpl.cards.length * trees.length
  const mat = leafMaterials()
  const mesh = new THREE.InstancedMesh(card, mat, Math.max(1, count))
  mesh.count = count
  const cell = new Float32Array(Math.max(1, count) * 2)
  const tree = new Float32Array(Math.max(1, count) * 4)
  const m = new THREE.Matrix4()
  const c = new THREE.Vector3()
  const sc = new THREE.Vector3()
  let k = 0
  for (const T of trees) {
    c.copy(tpl.center).applyMatrix4(T)
    sc.setFromMatrixScale(T)
    for (let i = 0; i < tpl.cards.length; i++, k++) {
      m.multiplyMatrices(T, tpl.cards[i])
      mesh.setMatrixAt(k, m)
      mesh.setColorAt(k, tpl.colors[i])
      cell[k * 2] = tpl.cells[i * 2]
      cell[k * 2 + 1] = tpl.cells[i * 2 + 1]
      tree.set([c.x, c.y, c.z, tpl.height * sc.y], k * 4)
    }
  }
  card.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2))
  card.setAttribute('aTree', new THREE.InstancedBufferAttribute(tree, 4))
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.customDepthMaterial = mat.userData.depth as THREE.MeshDepthMaterial
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.computeBoundingSphere()
  return mesh
}

export interface MapleBuild {
  wood: THREE.BufferGeometry
  leaves: THREE.InstancedMesh
}

/** Un érable posé en (0, 0, 0) ; à placer par le groupe parent. */
export function buildMaple(o: MapleOpts): MapleBuild {
  const tpl = mapleTemplate(o)
  return { wood: tpl.wood, leaves: leafMesh(tpl, [new THREE.Matrix4()]) }
}
