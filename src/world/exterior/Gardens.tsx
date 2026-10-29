/**
 * Abords végétalisés de la façade : pins noirs taillés en nuages (niwaki, pine.ts) au
 * pied de l'escalier, coussins d'azalées taillées (o-karikomi, azalea.ts) le long du
 * soubassement, bosquet de bambous (bamboo.ts) à l'ouest.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { M, T, cachedMaterial } from '../assets'
import { makeInstanced, xfMatrix, type Xf } from '../geo'
import { useStatic, StaticMeshes } from '../Static'
import { Placer } from '../props/furniture'
import { rockGeo } from './Forest'
import { FOREST_Y } from '../layout'
import { bambooClump, bambooCulmMaterial, bambooLeafMesh } from '../bamboo'
import { pineTemplate, pineBarkMaterial, pineCardMesh } from '../pine'
import { azaleaShellMaterial, azaleaCardMesh, AZALEA_GREENS, AZALEA_RED } from '../azalea'
import { setColliders, setCircles, removeColliders } from '../../player/collision'
import { Noise2 } from '../../core/noise'
import { rng } from '../../core/math'
import { useSettings, QUALITY } from '../../store/settings'

/** Pins : position du pied et sens de l'inclinaison (vers l'extérieur de l'escalier). */
const PINES: { x: number; z: number; lean: number; seed: number }[] = [
  { x: -7.4, z: 11.6, lean: -1, seed: 3 },
  { x: 7.5, z: 11.4, lean: 1, seed: 8 },
]
const HEDGE_ROWS: [number, number][] = [
  [-18.2, -4.7],
  [4.7, 10.5],
]
const GROVE = { x0: -23.5, x1: -14.6, z0: 7.2, z1: 16.5 }

/* --------------------------- géométries --------------------------- */
/** Touffe de feuillage : sphère bosselée, aplatie dessous. */
function tuftGeo(seed: number, seg = 10, amp = 0.16, freq = 1.8) {
  const n = new Noise2(seed)
  const g = new THREE.SphereGeometry(1, seg, Math.max(5, Math.round(seg * 0.7)))
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const d = 1 + amp * n.fbm(x * freq + seed, z * freq + y * freq * 0.8, 3)
    pos.setXYZ(i, x * d, (y < 0 ? y * 0.4 : y) * d, z * d)
  }
  g.computeVertexNormals()
  return g
}

/* --------------------------- matériaux --------------------------- */
const rockMat = () => cachedMaterial('garden-front-rock', () => new THREE.MeshStandardMaterial({ map: T().stone, normalMap: T().stoneN, color: 0x8a8577, roughness: 0.85 }))

/* --------------------------- placements --------------------------- */
function hedgeLayout() {
  const r = rng(616)
  const xfs: Xf[] = []
  const colors: THREE.Color[] = []
  const autumn: boolean[] = []
  const greens = AZALEA_GREENS
  for (const [a, b] of HEDGE_ROWS) {
    for (let x = a; x <= b; x += 1.05 + r() * 0.25) {
      const w = 0.72 + r() * 0.4
      const h = 0.55 + r() * 0.3
      xfs.push({ p: [x, FOREST_Y + h * 0.4, 6.3 + (r() - 0.5) * 0.3], r: [0, r() * 6, 0], s: [w * 1.15, h, w * 0.9] })
      // quelques azalées aux feuilles d'automne
      const red = r() < 0.16
      colors.push(new THREE.Color(red ? AZALEA_RED : greens[Math.floor(r() * greens.length)]))
      autumn.push(red)
      if (r() < 0.45) {
        const s = 0.38 + r() * 0.18
        xfs.push({ p: [x + 0.5, FOREST_Y + s * 0.35, 7.15 + (r() - 0.5) * 0.2], r: [0, r() * 6, 0], s: [s * 1.2, s * 0.8, s] })
        colors.push(new THREE.Color(greens[Math.floor(r() * greens.length)]))
        autumn.push(false)
      }
    }
  }
  return { xfs, colors, autumn }
}

function groveLayout() {
  const r = rng(4242)
  const out: { x: number; z: number; ry: number; s: number }[] = []
  for (let i = 0; i < 80 && out.length < 16; i++) {
    const x = GROVE.x0 + r() * (GROVE.x1 - GROVE.x0)
    const z = GROVE.z0 + r() * (GROVE.z1 - GROVE.z0)
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 1.3)) continue
    out.push({ x, z, ry: r() * Math.PI * 2, s: 0.9 + r() * 0.2 })
  }
  return out
}

/* --------------------------- composant --------------------------- */
export function Gardens() {
  const Q = QUALITY[useSettings((s) => s.quality)]
  const shadows = Q.shadows

  // moins de pousses, de rameaux et d'éventails (un peu plus grands) en profils Moyen et Bas
  const density = Q.trees >= 1 ? 1 : Q.trees >= 0.7 ? 0.8 : 0.55

  // pins taillés : bois à écorce PBR, nuages de pousses d'aiguilles
  const pines = useMemo(() => {
    const meshes: THREE.InstancedMesh[] = []
    for (const p of PINES) {
      const tpl = pineTemplate(p.seed, p.lean, density)
      const at = [xfMatrix({ p: [p.x, FOREST_Y, p.z] }, new THREE.Matrix4())]
      meshes.push(makeInstanced(tpl.wood, pineBarkMaterial(), at), pineCardMesh(tpl, at, [new THREE.Color(1, 1, 1)]))
    }
    return meshes
  }, [density])
  // azalées : coussins à feuilles triplanaires, rameaux feuillus posés sur la surface
  const hedges = useMemo(() => {
    const { xfs, colors, autumn } = hedgeLayout()
    const geo = tuftGeo(7, 22, 0.2, 3.4)
    const shell = makeInstanced(geo, azaleaShellMaterial(), xfs, colors)
    const cushions = xfs.map((x, i) => ({ m: xfMatrix(x, new THREE.Matrix4()), tint: colors[i], autumn: autumn[i] }))
    return [shell, azaleaCardMesh(geo, cushions, FOREST_Y, density)]
  }, [density])
  const grove = useMemo(() => {
    const spots = groveLayout()
    const templates = [11, 23, 37, 41].map((seed) => bambooClump(seed, density, Q.trees >= 1))
    // nuance propre à chaque touffe : plus ou moins jaune, plus ou moins sombre
    const r = rng(4343)
    const tints = spots.map(() => {
      const v = 0.9 + r() * 0.2
      const hue = (r() - 0.5) * 0.1
      return new THREE.Color().setRGB(v * (1 + hue), v, v * (1 - hue))
    })
    const meshes: THREE.InstancedMesh[] = []
    templates.forEach((t, k) => {
      const mine = spots.map((_, i) => i).filter((i) => i % templates.length === k)
      const mats = mine.map((i) => xfMatrix({ p: [spots[i].x, FOREST_Y - 0.05, spots[i].z], r: [0, spots[i].ry, 0], s: spots[i].s }, new THREE.Matrix4()))
      meshes.push(makeInstanced(t.wood, bambooCulmMaterial(), mats), bambooLeafMesh(t, mats, mine.map((i) => tints[i])))
    })
    return { spots, meshes }
  }, [density, Q.trees])

  useEffect(() => {
    for (const m of [...pines, ...hedges, ...grove.meshes]) {
      m.castShadow = shadows
      m.receiveShadow = true
    }
  }, [shadows, pines, hedges, grove])

  useEffect(() => () => pines.forEach((m) => m.geometry.dispose()), [pines])
  useEffect(() => () => hedges.forEach((m) => m.geometry.dispose()), [hedges])
  useEffect(() => () => grove.meshes.forEach((m) => m.geometry.dispose()), [grove])

  // pierres au pied des pins
  const parts = useStatic((b) => {
    const P = new Placer(b)
    PINES.forEach((p, i) => {
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + i
        const s = 0.28 + k * 0.09
        P.geo(rockGeo(60 + i * 3 + k), rockMat(), [p.x + Math.cos(a) * 0.8, FOREST_Y + s * 0.08, p.z + Math.sin(a) * 0.7], [0, a, 0], [s * 1.3, s, s], true)
      }
      P.geo(new THREE.CircleGeometry(1.2, 20).rotateX(-Math.PI / 2), M().moss, [p.x, FOREST_Y + 0.02, p.z])
    })
  }, [])

  useEffect(() => {
    setColliders(
      'front-hedges',
      HEDGE_ROWS.map(([a, b]) => ({ x0: a - 0.5, x1: b + 0.5, z0: 5.0, z1: 7.5 })),
    )
    setCircles('front-plants', [...PINES.map((p) => ({ x: p.x, z: p.z, r: 0.45 })), ...grove.spots.map((o) => ({ x: o.x, z: o.z, r: 0.6 * o.s }))])
    return () => {
      removeColliders('front-hedges')
      removeColliders('front-plants')
    }
  }, [grove])

  return (
    <group>
      <StaticMeshes parts={parts} />
      {[...pines, ...hedges, ...grove.meshes].map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </group>
  )
}
