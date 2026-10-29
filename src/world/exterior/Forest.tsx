/**
 * Forêt ancienne du Pays du Feu : relief, cèdres géants, érables, rochers
 * moussus, fougères, chemin de dalles irrégulières.
 * Tout est instancié ; les cèdres sont regroupés par cellules (écartées hors champ)
 * et passent à un feuillage allégé au loin.
 */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { M, T } from '../assets'
import { rng, range, smoothstep, clamp } from '../../core/math'
import { worldNoise, Noise2 } from '../../core/noise'
import { terrainHeight, footprintDistance, pathDistance, pathX, WORLD_BOUNDS, inCascade } from '../layout'
import { makeInstanced, xfMatrix } from '../geo'
import { setCircles, removeColliders } from '../../player/collision'
import { applyWind, windUniforms } from '../wind'
import { useSettings, QUALITY } from '../../store/settings'
import { mapleTemplate, leafMesh, barkMaterial } from '../maple'
import { sugiTemplate, sugiCardMesh, sugiBarkMaterial } from '../cedar'

/* ----------------------------- géométries ----------------------------- */

function coloredGeo(g: THREE.BufferGeometry, color: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color) {
  g.computeVertexNormals()
  const geo = g.index ? g.toNonIndexed() : g
  const pos = geo.attributes.position as THREE.BufferAttribute
  const nor = geo.attributes.normal as THREE.BufferAttribute
  const cols = new Float32Array(pos.count * 3)
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    n.fromBufferAttribute(nor, i)
    const c = color(p, n)
    cols[i * 3] = c.r
    cols[i * 3 + 1] = c.g
    cols[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  return geo
}

export function rockGeo(seed: number) {
  const n = new Noise2(seed)
  const g = new THREE.SphereGeometry(1, 16, 11)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const d = 1 + 0.32 * n.fbm(x * 1.1 + seed, y * 1.1 + z, 3)
    pos.setXYZ(i, x * d * 1.15, Math.max(-0.35, y * d * 0.62), z * d)
  }
  const moss = new THREE.Color(0x3d4d2c)
  const stone = new THREE.Color(0x6b6862)
  return coloredGeo(g, (_p, nn) => stone.clone().lerp(moss, smoothstep(0.35, 0.8, nn.y)))
}

function slabGeo(seed: number) {
  const r = rng(seed)
  const shape = new THREE.Shape()
  const sides = 6 + Math.floor(r() * 3)
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + r() * 0.3
    const rad = 0.3 + r() * 0.12
    const x = Math.cos(a) * rad * 1.15
    const y = Math.sin(a) * rad
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.035, bevelSegments: 2 })
  g.rotateX(-Math.PI / 2)
  g.translate(0, -0.05, 0)
  g.computeVertexNormals()
  return g
}

function fernGeo() {
  const a = new THREE.PlaneGeometry(1, 1)
  a.translate(0, 0.5, 0)
  const b = a.clone().rotateY(Math.PI / 2)
  const c = a.clone().rotateY(Math.PI / 4)
  const geo = new THREE.BufferGeometry()
  const parts = [a, b, c].map((g) => g.toNonIndexed())
  let count = 0
  parts.forEach((p) => (count += p.attributes.position.count))
  const pos = new Float32Array(count * 3)
  const nor = new Float32Array(count * 3)
  const uv = new Float32Array(count * 2)
  let o = 0
  for (const p of parts) {
    pos.set(p.attributes.position.array as Float32Array, o * 3)
    // normales vers le haut : éclairage doux et homogène des cartes
    for (let i = 0; i < p.attributes.position.count; i++) nor.set([0, 1, 0], (o + i) * 3)
    uv.set(p.attributes.uv.array as Float32Array, o * 2)
    o += p.attributes.position.count
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

/* ----------------------------- placement ----------------------------- */

interface TreeSpot {
  x: number
  z: number
  y: number
  s: number
  rot: number
  kind: 'cedar' | 'maple'
}

function placeTrees(density: number): TreeSpot[] {
  const r = rng(4242)
  const out: TreeSpot[] = []
  const cell = 5.2
  for (let gx = -118; gx < 118; gx += cell) {
    for (let gz = -140; gz < 150; gz += cell) {
      const x = gx + r() * cell
      const z = gz + r() * cell
      const roll = r()
      const dF = footprintDistance(x, z)
      const dP = pathDistance(x, z)
      if (dF < 8) continue
      if (dP < 5.4) continue
      if (x > -17 && x < 17 && z > 2 && z < 30) continue
      const dense = smoothstep(0, 30, Math.min(dF, dP))
      if (roll > (0.42 + 0.5 * dense) * density) continue
      const nearPath = dP < 16 || (dF < 16 && z > -10)
      const kind: TreeSpot['kind'] = nearPath && r() < 0.32 ? 'maple' : 'cedar'
      out.push({ x, z, y: terrainHeight(x, z) - 0.1, s: kind === 'cedar' ? range(r, 0.75, 1.25) : range(r, 0.8, 1.2), rot: r() * Math.PI * 2, kind })
    }
  }
  return out
}

/* ----------------------------- cèdres par cellules ----------------------------- */

/** Taille des cellules : chacune a sa propre sphère englobante, donc est écartée hors champ (vue et ombres). */
const CEDAR_CELL = 44
/** Au-delà de cette distance (au point le plus proche de la cellule) : touffes principales seules, en grandes cartes, et tronc sans branches. */
const CEDAR_LOD = 48

interface CedarCell {
  x0: number
  x1: number
  z0: number
  z1: number
  /** cryptomères détaillées : tronc et branches, touffes pleines d'aiguilles */
  near: THREE.Object3D[]
  /** version lointaine de la cellule seule (quand un voisin du bloc est proche) */
  far: THREE.Object3D[]
  isNear: boolean
}

/** Bloc de 2 × 2 cellules : quand toutes sont lointaines, une seule version allégée les couvre. */
interface CedarBlock {
  cells: CedarCell[]
  far: THREE.Object3D[]
}

/** Gabarits partagés par toutes les cellules (deux variantes, deux niveaux de détail). */
function cedarTemplates(density: number) {
  return {
    near: [sugiTemplate(1, 'near', density), sugiTemplate(2, 'near', density)],
    far: [sugiTemplate(1, 'far'), sugiTemplate(2, 'far')],
  }
}

function buildCedarCells(cedars: TreeSpot[], tpl: ReturnType<typeof cedarTemplates>) {
  const bark = sugiBarkMaterial()
  // teintes par arbre, tirées dans le même ordre qu'avant le découpage
  const tint = new Map<TreeSpot, THREE.Color>()
  const variant = new Map<TreeSpot, number>()
  for (const vi of [0, 1]) {
    const r = rng(77 + vi)
    cedars.forEach((t, i) => {
      if (i % 2 !== vi) return
      variant.set(t, vi)
      // nuance douce autour du vert de l'atlas : plus ou moins jaune, plus ou moins sombre
      const hue = (r() - 0.5) * 0.12
      const v = 0.86 + r() * 0.24
      tint.set(t, new THREE.Color().setRGB(v * (1 + hue), v, v * (1 - hue * 0.6)))
    })
  }
  const matrix = (t: TreeSpot) => xfMatrix({ p: [t.x, t.y, t.z], r: [0, t.rot, 0], s: t.s }, new THREE.Matrix4())
  /** Bois + aiguilles d'une liste d'arbres, pour chaque variante présente. */
  const trees = (list: TreeSpot[], tpls: typeof tpl.near, visible: boolean) => {
    const out: THREE.Object3D[] = []
    for (const vi of [0, 1]) {
      const vl = list.filter((t) => variant.get(t) === vi)
      if (!vl.length) continue
      const mats = vl.map(matrix)
      const wood = makeInstanced(tpls[vi].wood, bark, mats)
      const cards = sugiCardMesh(tpls[vi], mats, vl.map((t) => tint.get(t)!))
      wood.visible = cards.visible = visible
      out.push(wood, cards)
    }
    return out
  }
  const group = (key: (t: TreeSpot) => string) => {
    const m = new Map<string, TreeSpot[]>()
    for (const t of cedars) {
      const k = key(t)
      m.set(k, [...(m.get(k) ?? []), t])
    }
    return m
  }
  const ix = (t: TreeSpot) => Math.floor(t.x / CEDAR_CELL)
  const iz = (t: TreeSpot) => Math.floor(t.z / CEDAR_CELL)
  const cellTrees = group((t) => `${ix(t)},${iz(t)}`)
  const blockTrees = group((t) => `${Math.floor(ix(t) / 2)},${Math.floor(iz(t) / 2)}`)

  const cells = new Map<string, CedarCell>()
  for (const [k, list] of cellTrees) {
    cells.set(k, {
      x0: Math.min(...list.map((t) => t.x)),
      x1: Math.max(...list.map((t) => t.x)),
      z0: Math.min(...list.map((t) => t.z)),
      z1: Math.max(...list.map((t) => t.z)),
      near: trees(list, tpl.near, true),
      far: trees(list, tpl.far, false),
      isNear: true,
    })
  }
  const blocks: CedarBlock[] = []
  for (const [k, list] of blockTrees) {
    const [bx, bz] = k.split(',').map(Number)
    const members = [...cells.entries()].filter(([ck]) => {
      const [cx, cz] = ck.split(',').map(Number)
      return Math.floor(cx / 2) === bx && Math.floor(cz / 2) === bz
    })
    blocks.push({ cells: members.map(([, c]) => c), far: trees(list, tpl.far, false) })
  }
  return { cells: [...cells.values()], blocks }
}

/** Bascule proche / lointain par cellule (avec hystérésis), puis regroupe les blocs entièrement lointains. */
function updateCedarLod(forest: { cells: CedarCell[]; blocks: CedarBlock[] }, x: number, z: number) {
  for (const c of forest.cells) {
    const d = Math.hypot(Math.max(c.x0 - x, 0, x - c.x1), Math.max(c.z0 - z, 0, z - c.z1))
    c.isNear = c.isNear ? d < CEDAR_LOD + 6 : d < CEDAR_LOD - 6
  }
  for (const b of forest.blocks) {
    const merged = b.cells.every((c) => !c.isNear)
    b.far.forEach((o) => (o.visible = merged))
    for (const c of b.cells) {
      c.near.forEach((o) => (o.visible = c.isNear))
      c.far.forEach((o) => (o.visible = !c.isNear && !merged))
    }
  }
}

/**
 * Pendant la seule passe d'ombre, les cèdres proches sont remplacés par leur version lointaine
 * (même squelette, deux grandes cartes par touffe, tronc seul) : l'ombre, floue, garde la même
 * silhouette pour bien moins de cartes. three.js prépare la liste de rendu de l'image avant la
 * passe d'ombre, donc l'image elle-même reste dessinée avec la version détaillée.
 */
function useLiteCedarShadows(forest: { cells: CedarCell[] }) {
  const gl = useThree((st) => st.gl)
  useEffect(() => {
    const sm = gl.shadowMap
    const original = sm.render
    const swap = (lite: boolean) => {
      for (const c of forest.cells) {
        if (!c.isNear) continue
        c.near.forEach((o) => (o.visible = !lite))
        c.far.forEach((o) => (o.visible = lite))
      }
    }
    sm.render = function (...args: Parameters<typeof original>) {
      swap(true)
      try {
        original.apply(this, args)
      } finally {
        swap(false)
      }
    }
    return () => {
      sm.render = original
    }
  }, [gl, forest])
}

/* ----------------------------- composant ----------------------------- */

export function Forest() {
  const quality = useSettings((s) => s.quality)
  const Q = QUALITY[quality]
  const shadows = Q.shadows

  const data = useMemo(() => {
    const m = M()
    const trees = placeTrees(Q.trees)
    const cedars = trees.filter((t) => t.kind === 'cedar')
    const maples = trees.filter((t) => t.kind === 'maple')

    const meshes: THREE.Object3D[] = []
    // cryptomères : touffes d'aiguilles moins nombreuses en profils Moyen et Bas
    const cedarLod = buildCedarCells(cedars, cedarTemplates(Q.trees >= 1 ? 1 : Q.trees >= 0.7 ? 0.8 : 0.55))
    for (const c of cedarLod.cells) meshes.push(...c.near, ...c.far)
    for (const b of cedarLod.blocks) meshes.push(...b.far)
    // érables : deux gabarits d'Acer palmatum procéduraux (bois PBR + feuilles palmées), instanciés
    const leafDensity = Q.trees >= 1 ? 0.55 : Q.trees >= 0.7 ? 0.4 : 0.28
    const radial = Q.trees >= 1 ? 9 : 6
    const templates = [mapleTemplate({ seed: 31, height: 5.4, leaves: leafDensity, radial }), mapleTemplate({ seed: 32, height: 5.8, leaves: leafDensity, radial })]
    templates.forEach((tpl, vi) => {
      const list = maples.filter((_, i) => i % 2 === vi)
      if (!list.length) return
      const mats = list.map((t) => xfMatrix({ p: [t.x, t.y, t.z], r: [0, t.rot, 0], s: t.s }, new THREE.Matrix4()))
      meshes.push(makeInstanced(tpl.wood, barkMaterial(), mats))
      meshes.push(leafMesh(tpl, mats))
    })
    meshes.forEach((o) => {
      o.castShadow = shadows
      o.receiveShadow = true
    })

    // Rochers moussus
    const r = rng(9001)
    const rockMat = new THREE.MeshStandardMaterial({ map: m.stone.map, normalMap: m.stone.normalMap, vertexColors: true, roughness: 0.9 })
    const rockGeos = [rockGeo(3), rockGeo(8), rockGeo(13)]
    const rocks: { x: number; z: number; s: number }[][] = [[], [], []]
    for (let i = 0; i < 220; i++) {
      const x = range(r, -95, 95)
      const z = range(r, -120, 130)
      const dP = pathDistance(x, z)
      if (footprintDistance(x, z) < 3 || dP < 2.2 || inCascade(x, z, 1.2)) continue
      const big = dP < 8 && r() < 0.5
      rocks[i % 3].push({ x, z, s: big ? range(r, 0.6, 1.4) : range(r, 0.25, 0.8) })
    }
    rockGeos.forEach((g, i) => {
      const inst = makeInstanced(
        g,
        rockMat,
        rocks[i].map((k) => ({ p: [k.x, terrainHeight(k.x, k.z) + k.s * 0.12, k.z], r: [r() * 0.3, r() * 6, r() * 0.3], s: k.s })),
      )
      inst.castShadow = shadows
      inst.receiveShadow = true
      meshes.push(inst)
    })

    // Dalles du chemin
    const slabMat = M().stoneWet
    const slabs = [slabGeo(1), slabGeo(2), slabGeo(3), slabGeo(4)]
    const lists: THREE.Matrix4[][] = [[], [], [], []]
    let k = 0
    for (let z = 11.6; z < 98; z += 0.64) {
      const cx = pathX(z)
      const offs = r() < 0.5 ? [-0.62, 0.02, 0.64] : [-0.4, 0.42]
      for (const o of offs) {
        if (r() < 0.06) continue
        const x = cx + o + (r() - 0.5) * 0.14
        const zz = z + (r() - 0.5) * 0.18
        const s = range(r, 0.85, 1.15)
        lists[k++ % 4].push(xfMatrix({ p: [x, terrainHeight(x, zz) + 0.035, zz], r: [(r() - 0.5) * 0.04, r() * 6, (r() - 0.5) * 0.04], s: [s, 1, s] }))
      }
    }
    slabs.forEach((g, i) => {
      const inst = makeInstanced(g, slabMat, lists[i])
      inst.receiveShadow = true
      meshes.push(inst)
    })

    // Fougères
    const fernMat = new THREE.MeshStandardMaterial({ map: T().fern, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.95, color: 0x6f7f62 })
    applyWind(fernMat, 0.06, 1, 1.6)
    const fernXf: THREE.Matrix4[] = []
    const fernCol: THREE.Color[] = []
    const fernCount = Math.floor(2600 * Q.ferns)
    let tries = 0
    while (fernXf.length < fernCount && tries++ < fernCount * 4) {
      const nearP = r() < 0.55
      let x: number
      let z: number
      if (nearP) {
        z = range(r, 12, 96)
        x = pathX(z) + (r() < 0.5 ? -1 : 1) * range(r, 1.5, 9)
      } else {
        x = range(r, -70, 70)
        z = range(r, -90, 100)
      }
      if (pathDistance(x, z) < 1.45 || footprintDistance(x, z) < 0.6 || inCascade(x, z, 0.15)) continue
      if (worldNoise.fbm(x * 0.08, z * 0.08, 2) < -0.15 && !nearP) continue
      const s = range(r, 0.45, 1.15)
      fernXf.push(xfMatrix({ p: [x, terrainHeight(x, z) - 0.05, z], r: [0, r() * 6, 0], s: [s * 1.3, s, s * 1.3] }))
      fernCol.push(new THREE.Color().setHSL(0.26 + r() * 0.07, 0.28, 0.3 + r() * 0.16).multiplyScalar(1.3))
    }
    const ferns = makeInstanced(fernGeo(), fernMat, fernXf, fernCol)
    ferns.receiveShadow = true
    meshes.push(ferns)

    // Sol
    const ground = new THREE.PlaneGeometry(330, 360, 165, 180)
    ground.rotateX(-Math.PI / 2)
    const gp = ground.attributes.position as THREE.BufferAttribute
    const guv = ground.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i)
      const z = gp.getZ(i)
      gp.setY(i, terrainHeight(x, z))
      guv.setXY(i, x, -z)
    }
    ground.computeVertexNormals()
    const groundMesh = new THREE.Mesh(ground, m.ground)
    groundMesh.receiveShadow = true
    meshes.push(groundMesh)

    return { meshes, trees, cedarLod }
  }, [Q.trees, Q.ferns, shadows])

  // Collisions des troncs dans la zone praticable
  useEffect(() => {
    const B = WORLD_BOUNDS
    setCircles(
      'forest-trees',
      data.trees
        .filter((t) => t.x > B.x0 - 2 && t.x < B.x1 + 2 && t.z > B.z0 - 2 && t.z < B.z1 + 2)
        .map((t) => ({ x: t.x, z: t.z, r: (t.kind === 'cedar' ? 0.62 : 0.35) * t.s })),
    )
    return () => removeColliders('forest-trees')
  }, [data])

  useEffect(
    () => () => {
      data.meshes.forEach((o) => {
        const mesh = o as THREE.Mesh
        mesh.geometry?.dispose()
        if (o instanceof THREE.InstancedMesh) o.dispose()
      })
    },
    [data],
  )

  useLiteCedarShadows(data.cedarLod)

  // Niveau de détail des cèdres, réévalué quatre fois par seconde (avec hystérésis)
  const lodWait = useRef(0)
  useFrame((s, dt) => {
    windUniforms.uTime.value = s.clock.elapsedTime
    lodWait.current -= dt
    if (lodWait.current > 0) return
    lodWait.current = 0.25
    updateCedarLod(data.cedarLod, s.camera.position.x, s.camera.position.z)
  })

  return (
    <group>
      {data.meshes.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </group>
  )
}
