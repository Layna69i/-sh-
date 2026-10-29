/**
 * Outils de géométrie : UV en mètres et fusion statique par matériau
 * (réduit drastiquement les appels de rendu pour le décor fixe).
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/** Boîte dont les UV sont exprimés en mètres sur chaque face. */
export function boxGeo(w: number, h: number, d: number, uvScale = 1) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  // ordre des faces : +x, -x, +y, -y, +z, -z
  const dims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ]
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k
      uv.setXY(i, uv.getX(i) * dims[f][0] * uvScale, uv.getY(i) * dims[f][1] * uvScale)
    }
  }
  return g
}

/** Sens des fibres d'une texture : 'v' (bois de fil vertical), 'u' (lames horizontales). */
export type GrainDir = 'u' | 'v'

/**
 * Boîte aux arêtes abattues (chanfrein de `c` m) : 6 faces, 12 biseaux, 8 coins, 44 triangles.
 * Normales plates par facette, ce qui fait accrocher la lumière sur les arêtes comme sur une
 * poutre rabotée. UV en mètres par projection sur l'axe dominant ; avec `grain`, la longueur
 * de chaque face suit le sens des fibres de la texture.
 */
export function chamferBoxGeo(w: number, h: number, d: number, c: number, grain?: GrainDir) {
  const ch = Math.min(c, w * 0.2, h * 0.2, d * 0.2)
  const H = [w / 2, h / 2, d / 2]
  const I = [H[0] - ch, H[1] - ch, H[2] - ch]
  const dims = [w, h, d]
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const n = new THREE.Vector3()
  // axes de projection par axe dominant : x → (z, y), y → (x, z), z → (x, y)
  const PROJ: [number, number][] = [
    [2, 1],
    [0, 2],
    [0, 1],
  ]
  const poly = (pts: number[][]) => {
    a.set(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2])
    b.set(pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2])
    n.crossVectors(a, b).normalize()
    let cx = 0, cy = 0, cz = 0
    for (const p of pts) (cx += p[0]), (cy += p[1]), (cz += p[2])
    if (n.x * cx + n.y * cy + n.z * cz < 0) {
      pts = pts.slice().reverse()
      n.negate()
    }
    const k = Math.abs(n.x) >= Math.abs(n.y) && Math.abs(n.x) >= Math.abs(n.z) ? 0 : Math.abs(n.y) >= Math.abs(n.z) ? 1 : 2
    const [i, j] = PROJ[k]
    // la longueur de la face suit les fibres : rotation de 90° (conserve l'orientation des normales)
    const longI = dims[i] > dims[j]
    const rot = grain === 'v' ? longI : grain === 'u' ? !longI : false
    const tri = (p: number[]) => {
      pos.push(p[0], p[1], p[2])
      nor.push(n.x, n.y, n.z)
      if (rot) uv.push(p[j], -p[i])
      else uv.push(p[i], p[j])
    }
    for (let t = 1; t < pts.length - 1; t++) {
      tri(pts[0])
      tri(pts[t])
      tri(pts[t + 1])
    }
  }
  const S = [-1, 1]
  // faces principales
  for (let k = 0; k < 3; k++)
    for (const s of S) {
      const [i, j] = PROJ[k]
      const q = (si: number, sj: number) => {
        const p = [0, 0, 0]
        p[k] = s * H[k]
        p[i] = si * I[i]
        p[j] = sj * I[j]
        return p
      }
      poly([q(-1, -1), q(1, -1), q(1, 1), q(-1, 1)])
    }
  // biseaux le long des 12 arêtes (arête parallèle à l'axe e)
  for (let e = 0; e < 3; e++) {
    const [p1, p2] = [0, 1, 2].filter((x) => x !== e)
    for (const s1 of S)
      for (const s2 of S) {
        const v = (se: number, onP1: boolean) => {
          const p = [0, 0, 0]
          p[e] = se * I[e]
          p[p1] = s1 * (onP1 ? H[p1] : I[p1])
          p[p2] = s2 * (onP1 ? I[p2] : H[p2])
          return p
        }
        poly([v(-1, true), v(1, true), v(1, false), v(-1, false)])
      }
  }
  // coins
  for (const sx of S)
    for (const sy of S)
      for (const sz of S)
        poly([
          [sx * H[0], sy * I[1], sz * I[2]],
          [sx * I[0], sy * H[1], sz * I[2]],
          [sx * I[0], sy * I[1], sz * H[2]],
        ])
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  return g
}

/** Boîte adaptée au matériau : chanfreinée et orientée selon le fil si le matériau le demande
 *  (`userData.chamfer` en mètres, `userData.grain`). */
export function materialBox(mat: THREE.Material, w: number, h: number, d: number) {
  const c = mat.userData.chamfer as number | undefined
  const grain = mat.userData.grain as GrainDir | undefined
  if (c) return chamferBoxGeo(w, h, d, c, grain)
  return boxGeo(w, h, d)
}

/** Plan horizontal avec UV = coordonnées monde (x, -z). */
export function planeXZ(w: number, d: number, cx = 0, cz = 0, segX = 1, segZ = 1) {
  const g = new THREE.PlaneGeometry(w, d, segX, segZ)
  g.rotateX(-Math.PI / 2)
  g.translate(cx, 0, cz)
  const pos = g.attributes.position as THREE.BufferAttribute
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i))
  return g
}

export interface Xf {
  p?: [number, number, number]
  r?: [number, number, number]
  s?: number | [number, number, number]
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _s = new THREE.Vector3()

export function xfMatrix(x: Xf, out = new THREE.Matrix4()) {
  _e.set(...(x.r ?? [0, 0, 0]))
  _q.setFromEuler(_e)
  _v.set(...(x.p ?? [0, 0, 0]))
  if (typeof x.s === 'number') _s.set(x.s, x.s, x.s)
  else _s.set(...(x.s ?? [1, 1, 1]))
  return out.compose(_v, _q, _s)
}

function normalize(g: THREE.BufferGeometry) {
  let geo = g.index ? g.toNonIndexed() : g.clone()
  for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name)
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2))
  if (!geo.attributes.normal) geo.computeVertexNormals()
  geo.clearGroups()
  return geo
}

export interface StaticPart {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  cast: boolean
  receive: boolean
}

export class StaticBuilder {
  private groups = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>()
  constructor(private defaults = { cast: false, receive: true }) {}

  add(geo: THREE.BufferGeometry, mat: THREE.Material, x?: Xf | THREE.Matrix4, opts?: { cast?: boolean; receive?: boolean }) {
    const g = normalize(geo)
    if (x) g.applyMatrix4(x instanceof THREE.Matrix4 ? x : xfMatrix(x, _m))
    let entry = this.groups.get(mat)
    if (!entry) {
      entry = { geos: [], cast: opts?.cast ?? this.defaults.cast, receive: opts?.receive ?? this.defaults.receive }
      this.groups.set(mat, entry)
    } else if (opts?.cast) entry.cast = true
    entry.geos.push(g)
    return this
  }

  box(mat: THREE.Material, w: number, h: number, d: number, p: [number, number, number], r?: [number, number, number], opts?: { cast?: boolean }) {
    const g = materialBox(mat, w, h, d)
    this.add(g, mat, { p, r }, opts)
    g.dispose()
    return this
  }

  cyl(mat: THREE.Material, rt: number, rb: number, h: number, seg: number, p: [number, number, number], r?: [number, number, number], opts?: { cast?: boolean }) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg)
    scaleUV(g, Math.PI * 2 * Math.max(rt, rb), h)
    this.add(g, mat, { p, r }, opts)
    g.dispose()
    return this
  }

  build(): StaticPart[] {
    const out: StaticPart[] = []
    for (const [material, e] of this.groups) {
      if (!e.geos.length) continue
      const geometry = e.geos.length === 1 ? e.geos[0] : mergeGeometries(e.geos, false)!
      if (e.geos.length > 1) e.geos.forEach((g) => g.dispose())
      geometry.computeBoundingSphere()
      out.push({ geometry, material, cast: e.cast, receive: e.receive })
    }
    this.groups.clear()
    return out
  }
}

export function scaleUV(g: THREE.BufferGeometry, su: number, sv: number) {
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv)
  return g
}

/** Construit un InstancedMesh à partir de transformations. */
export function makeInstanced(geo: THREE.BufferGeometry, mat: THREE.Material, xfs: (Xf | THREE.Matrix4)[], colors?: THREE.Color[]) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, xfs.length))
  mesh.count = xfs.length
  const m = new THREE.Matrix4()
  xfs.forEach((x, i) => mesh.setMatrixAt(i, x instanceof THREE.Matrix4 ? x : xfMatrix(x, m)))
  if (colors) colors.forEach((c, i) => mesh.setColorAt(i, c))
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
  return mesh
}

/** Courbe une géométrie (ex. linteau de torii) : y += k·x². */
export function bendY(g: THREE.BufferGeometry, k: number, power = 2) {
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    pos.setY(i, pos.getY(i) + k * Math.pow(Math.abs(x), power))
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

/** Lathe à partir d'un profil [rayon, hauteur]. */
export function latheGeo(profile: [number, number][], seg = 16) {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  )
  return g
}
