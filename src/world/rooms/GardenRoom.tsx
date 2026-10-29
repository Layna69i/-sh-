/**
 * SALLE 09 — LE JARDIN DU SILENCE
 * Cour intérieure : sable ratissé en relief qui épouse le contour des pierres (GardenSand),
 * pierres organiques texturées et moussues (rocks.ts), érables japonais procéduraux (maple.ts),
 * bassin et carpes koï, shishi-odoshi animé, pas japonais, lanternes de pierre, banc de
 * contemplation, engawa. Des objets révèlent des réflexions.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { M, cachedMaterial, dynamicTexture } from '../assets'
import { useStatic, StaticMeshes } from '../Static'
import { Placer } from '../props/furniture'
import { StoneLanterns, Chochin, type LanternItem } from '../props/Lanterns'
import { useColliders } from './common'
import { useInteractable, openPanel } from '../../interaction/useInteractable'
import { boxAt, focusFrom } from '../../interaction/registry'
import { FallingLeaves } from '../exterior/Atmosphere'
import { waterMaterial } from '../exterior/Domain'
import { makeCanvas, ctx2d, JP_FONT } from '../../textures/util'
import { rng } from '../../core/math'
import { useSettings } from '../../store/settings'
import { rockGeometry, rockMaterial, mergeRocks, type RockKind } from '../rocks'
import { buildMaple, barkMaterial } from '../maple'
import { GardenSand, type SandObstacle } from './GardenSand'
import { POND, POND_Y, pondEdge, ROCKS, PATH, MAPLES, LANTERNS, STELE, TSUKUBAI, SHISHI, BENCH } from './gardenLayout'
import { ShishiOdoshi, tsukubai } from './ShishiOdoshi'
import { ShadowPlay } from '../effects/ShadowPlay'
import { Koi } from './Koi'

function inscriptionMat() {
  return cachedMaterial('garden-inscription', () => {
    const tex = dynamicTexture('garden-inscription', () => {
      const c = makeCanvas(128, 256)
      const ctx = ctx2d(c)
      ctx.fillStyle = '#5a5650'
      ctx.fillRect(0, 0, 128, 256)
      ctx.fillStyle = 'rgba(20,18,16,0.85)'
      ctx.font = `800 72px ${JP_FONT}`
      ctx.textAlign = 'center'
      ctx.fillText('静', 64, 100)
      ctx.fillText('観', 64, 190)
      return c
    })
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })
  })
}

const DETAIL = {
  high: { big: 22, rim: 9, step: 8, maple: { leaves: 1, radial: 12 } },
  medium: { big: 14, rim: 6, step: 5, maple: { leaves: 0.65, radial: 9 } },
  low: { big: 8, rim: 4, step: 3, maple: { leaves: 0.4, radial: 6 } },
}

/** Pierres du jardin : grandes pierres et margelle du bassin, puis pas japonais (deux passes). */
function useGardenRocks() {
  const quality = useSettings((s) => s.quality)
  const D = DETAIL[quality]
  const data = useMemo(() => {
    const r = rng(911)
    const big = ROCKS.map((k) => ({ k, g: rockGeometry(k.seed, k.kind as RockKind, k.s * 1.7, D.big) }))
    const rim: { geo: THREE.BufferGeometry; x: number; y: number; z: number; ry: number }[] = []
    const rimN = 26
    for (let i = 0; i < rimN; i++) {
      const a = (i / rimN) * Math.PI * 2 + (r() - 0.5) * 0.08
      const [x, z] = pondEdge(a)
      const g = rockGeometry(40 + i, 'rim', 0.62 + r() * 0.28, D.rim)
      rim.push({ geo: g.geometry, x, y: -0.02, z, ry: r() * 6.28 })
    }
    const steps = PATH.map((st) => ({ geo: rockGeometry(st.seed, 'step', st.r * 2.05, D.step).geometry, x: st.x, y: -0.015, z: st.z, ry: st.ry }))
    const garden = mergeRocks([...big.map((b) => ({ geo: b.g.geometry, x: b.k.x, y: 0, z: b.k.z, ry: b.k.ry })), ...rim])
    const path = mergeRocks(steps)
    for (const b of big) b.g.geometry.dispose()
    for (const x of [...rim, ...steps]) x.geo.dispose()
    const sand: SandObstacle[] = big.map((b) => ({ x: b.k.x, z: b.k.z, fp: b.g.footprint, ry: b.k.ry, ring: 0.42 + b.k.s * 0.55, mound: 0.012 }))
    return { garden, path, sand, mats: { garden: rockMaterial({ moss: 0.75, wet: 0.5 }), path: rockMaterial({ moss: 0.12, wet: 0.2, color: 0xb8b4ae }) } }
  }, [D])
  useEffect(
    () => () => {
      data.garden.dispose()
      data.path.dispose()
      data.mats.garden.dispose()
      data.mats.path.dispose()
    },
    [data],
  )
  return data
}

/** Érables japonais : bois PBR + feuillage instancié animé. */
function Maples() {
  const quality = useSettings((s) => s.quality)
  const D = DETAIL[quality].maple
  const trees = useMemo(
    () =>
      MAPLES.map((t) => ({
        t,
        b: buildMaple({ seed: t.seed, height: 4.3 * t.s, leaves: D.leaves * (t.s < 0.8 ? 0.8 : 1), radial: D.radial }),
      })),
    [D],
  )
  useEffect(
    () => () =>
      trees.forEach(({ b }) => {
        b.wood.dispose()
        b.leaves.geometry.dispose()
        b.leaves.dispose()
      }),
    [trees],
  )
  const bark = barkMaterial()
  return (
    <>
      {trees.map(({ t, b }) => (
        <group key={t.seed} position={[t.x, 0, t.z]}>
          <mesh geometry={b.wood} material={bark} castShadow receiveShadow />
          <primitive object={b.leaves} />
        </group>
      ))}
    </>
  )
}

export function GardenRoom() {
  const rocks = useGardenRocks()

  const parts = useStatic((b) => {
    const m = M()
    const P = new Placer(b)
    // engawa (vérandas) le long des façades
    const deck = (x0: number, x1: number, z0: number, z1: number) => {
      P.box(m.planks, x1 - x0, 0.06, z1 - z0, [(x0 + x1) / 2, 0.1, (z0 + z1) / 2])
      const along = x1 - x0 > z1 - z0
      if (along) P.box(m.woodDark, x1 - x0, 0.14, 0.12, [(x0 + x1) / 2, 0.06, z0 + 0.06])
      else P.box(m.woodDark, 0.12, 0.14, z1 - z0, [x1 - 0.06, 0.06, (z0 + z1) / 2])
    }
    deck(-10, 10, -27.5, -26.15)
    P.box(m.woodDark, 20, 0.14, 0.12, [0, 0.06, -27.44])
    deck(-9.85, -8.55, -46, -27.5)
    P.box(m.woodDark, 0.12, 0.14, 18.5, [-8.61, 0.06, -36.75])
    deck(8.55, 9.85, -46, -27.5)
    P.box(m.woodDark, 0.12, 0.14, 18.5, [8.61, 0.06, -36.75])
    deck(-6, 6, -45.85, -44.6)
    P.box(m.woodDark, 12, 0.14, 0.12, [0, 0.06, -44.66])
    // stèle gravée
    P.box(m.stoneDark, 0.42, 1.1, 0.22, [STELE.x, 0.55, STELE.z], [0, STELE.ry, 0], true)
    P.geo(new THREE.PlaneGeometry(0.3, 0.8), inscriptionMat(), [STELE.x + Math.sin(STELE.ry) * 0.112, 0.62, STELE.z + Math.cos(STELE.ry) * 0.112], [0, STELE.ry, 0])
    // banc de contemplation
    const B = P.at(BENCH.x, 0, BENCH.z, Math.PI)
    B.box(m.woodMid, 1.8, 0.08, 0.5, [0, 0.45, 0])
    for (const sx of [-0.7, 0.7]) B.box(m.stoneDark, 0.3, 0.42, 0.4, [sx, 0.21, 0])
    // bassin à ablutions (tsukubai)
    tsukubai(P, TSUKUBAI.x, TSUKUBAI.z)
  }, [])

  const pond = useMemo(() => {
    const shape = new THREE.Shape()
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2
      const w = 1 + 0.12 * Math.sin(a * 3)
      const x = Math.cos(a) * POND.rx * w * 0.97
      const y = Math.sin(a) * POND.rz * w * 0.97
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
    const g = new THREE.ShapeGeometry(shape)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const water = waterMaterial(0x0b1416, 0x4a2a40)
  // les koïs sont dessinés après l'eau : elle ne doit pas masquer ce qui est dessous
  water.depthWrite = false
  useFrame((s) => {
    if (water.normalMap) water.normalMap.offset.set(s.clock.elapsedTime * 0.012, s.clock.elapsedTime * 0.008)
  })

  const lanterns: LanternItem[] = LANTERNS
  const eaves: LanternItem[] = useMemo(() => [{ p: [-6.6, 2.7, -27.0] }, { p: [6.6, 2.7, -27.0] }, { p: [-9.2, 2.6, -36] }, { p: [9.2, 2.6, -36] }, { p: [0, 2.6, -45.2] }], [])

  useColliders(
    'garden',
    [],
    [
      { x: POND.x - 1.2, z: POND.z, r: 1.9 },
      { x: POND.x + 1.3, z: POND.z, r: 1.8 },
      ...ROCKS.map((k) => ({ x: k.x, z: k.z, r: k.s * 0.8 })),
      ...lanterns.map((l) => ({ x: l.p[0], z: l.p[2], r: 0.4 })),
      ...MAPLES.map((t) => ({ x: t.x, z: t.z, r: 0.28 * t.s })),
      { x: STELE.x, z: STELE.z, r: 0.35 },
      { x: TSUKUBAI.x, z: TSUKUBAI.z, r: 0.5 },
      { x: BENCH.x - 0.7, z: BENCH.z, r: 0.3 },
      { x: BENCH.x + 0.7, z: BENCH.z, r: 0.3 },
    ],
  )

  const note = (id: string, label: string, verb: string, box: THREE.Box3, target: [number, number, number], yaw: number, dist = 2.4) =>
    useInteractable(() => ({
      id: `garden-${id}`,
      zone: 'garden',
      label,
      verb,
      box,
      anchor: box.getCenter(new THREE.Vector3()).setY(0),
      onInteract: () => openPanel('garden', focusFrom(target, yaw, dist, 0.6, 55), { note: id }),
    }))
  note('lanterne', 'Écouter la lanterne de pierre', 'Tōrō', boxAt(-1.2, 1.0, -31.4, 0.8, 2.0, 0.8), [-1.2, 1.3, -31.4], Math.PI * 0.85)
  note('pierre', 'Lire la stèle', 'Stèle gravée', boxAt(-1.9, 0.6, -30.6, 0.7, 1.2, 0.6), [-1.9, 0.7, -30.6], 0.3, 1.8)
  note('shishi', 'Observer le shishi-odoshi', 'Fontaine de bambou', boxAt(6.2, 0.5, -37.2, 1.4, 1.0, 1.0), [6.2, 0.5, -37.2], Math.PI * 0.75, 2)
  note('banc', 'S’asseoir un instant', 'Banc de contemplation', boxAt(-3.2, 0.45, -44.0, 2.0, 0.9, 0.7), [-3.2, 0.6, -40.5], Math.PI, 3.2)
  note('bassin', 'Regarder le bassin', 'Bassin', boxAt(POND.x, 0.2, POND.z, POND.rx * 2, 0.4, POND.rz * 2), [POND.x, 0.1, POND.z], 0.9, 4)
  note('erable', 'Contempler l’érable', 'Momiji', boxAt(MAPLES[0].x, 2.0, MAPLES[0].z, 2.6, 4.0, 2.6), [MAPLES[0].x, 2.4, MAPLES[0].z], -0.6, 4.5)

  return (
    <group>
      <StaticMeshes parts={parts} />
      <GardenSand rocks={rocks.sand} />
      <mesh geometry={rocks.garden} material={rocks.mats.garden} castShadow receiveShadow />
      <mesh geometry={rocks.path} material={rocks.mats.path} castShadow receiveShadow />
      <mesh geometry={pond} material={water} position={[POND.x, POND_Y, POND.z]} receiveShadow />
      <Maples />
      <ShishiOdoshi x={SHISHI.x} z={SHISHI.z} ry={SHISHI.ry} />
      <Koi x={POND.x} z={POND.z} rx={POND.rx * 0.8} rz={POND.rz * 0.72} y={0.07} />
      <StoneLanterns id="garden-toro" zone="garden" items={lanterns} intensity={6} distance={8} />
      <Chochin id="garden-eaves" zone="garden" items={eaves} intensity={5} distance={8} />
      <FallingLeaves count={60} area={9} center={[0, 0, -36]} />
      <Sparkles count={30} scale={[10, 2, 8]} position={[POND.x, 0.8, POND.z]} size={3} speed={0.2} noise={1} color="#ffd890" opacity={0.75} />
      <ShadowPlay zone="garden" />
    </group>
  )
}
