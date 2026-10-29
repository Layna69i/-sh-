/**
 * SALLE 04 — LE DOJO DE L'ÉLOQUENCE
 * Plancher ciré, estrade de l'enseignant et pupitre, rangées de petits bureaux
 * d'élèves, grandes bannières des neuf disciplines, rouleaux et paravents.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { M, bannerMat, kakejikuMat, inkPanelMat, handwritingMat } from '../assets'
import { useStatic, StaticMeshes } from '../Static'
import { Placer, cushion, writingDesk, inkSet, paperStack, dais, kakejiku, byobu, ikebana, hibachi, tansu, lowTable, openScroll } from '../props/furniture'
import { Chochin, Andons, Candles, type LanternItem } from '../props/Lanterns'
import { useColliders } from './common'
import { useInteractable, openPanel } from '../../interaction/useInteractable'
import { boxAt } from '../../interaction/registry'
import { DISCIPLINES } from '../../data/types'
import { applyCloth } from '../wind'
import { ShadowPlay } from '../effects/ShadowPlay'

const DESK_X = [-23.2, -21.0, -18.8, -16.6]
const DESK_Z = [-40.0, -38.0, -36.0, -34.0, -32.0]
const BANNERS_N = [-24.4, -20.8, -17.2, -13.6]
const BANNERS_S = [-26.5, -23.8, -16.6, -13.9, -11.4]

export function DojoRoom() {
  const parts = useStatic((b) => {
    const m = M()
    const P = new Placer(b)
    // estrade de l'enseignant (mur ouest)
    dais(P.at(-26.6, 0, -36, Math.PI / 2), 7.0, 2.4, 0.42, m.woodMid)
    const D = P.at(-26.9, 0.42, -36, Math.PI / 2)
    lowTable(D, 1.3, 0.55, 0.36, m.woodBlack)
    openScroll(D.at(0, 0.36, 0, 0), handwritingMat(410, '弁'), 0.34, 0.56)
    inkSet(D.at(0.45, 0.36, 0.05))
    cushion(D.at(0, 0, -0.62), m.fabricRed)
    kakejiku(P.at(-27.82, 3.6, -36, Math.PI / 2), kakejikuMat('言霊', 412, { sub: 'Le pouvoir des mots' }), 0.75, 2.2)
    byobu(P.at(-27.3, 0.42, -32.4, Math.PI / 2 + 0.2), inkPanelMat(414, { pine: true, gold: true }, 1024, 400), 4, 0.5, 1.4)
    byobu(P.at(-27.3, 0.42, -39.6, Math.PI / 2 - 0.2), inkPanelMat(415, { moon: true, gold: true }, 1024, 400), 4, 0.5, 1.4)
    ikebana(P.at(-26.0, 0.42, -33.0), 1.1)
    // bureaux des élèves
    DESK_X.forEach((x, i) =>
      DESK_Z.forEach((z, j) => {
        const S = P.at(x, 0, z, -Math.PI / 2)
        writingDesk(S, 0.85, 0.4)
        cushion(S.at(0, 0, 0.5), (i + j) % 3 === 0 ? m.fabricIndigo : m.fabricDark, 0.52, 0.52)
        if ((i * 5 + j) % 3 !== 1) paperStack(S.at(-0.15, 0.32, 0), 3, 0.18, 0.26, i * 7 + j)
        if ((i * 5 + j) % 4 === 0) inkSet(S.at(0.25, 0.32, 0))
      }),
    )
    // rouleaux et meubles
    tansu(P.at(-11.0, 0, -44.9, -Math.PI / 2), 1.4, 1.0, 0.5, 21)
    tansu(P.at(-11.0, 0, -27.3, -Math.PI / 2), 1.2, 0.9, 0.5, 22)
    kakejiku(P.at(-21.0, 3.0, -26.18, Math.PI), kakejikuMat('観', 417, { sub: 'Observer' }), 0.6, 1.9)
    hibachi(P.at(-12.4, 0, -40.8))
    hibachi(P.at(-12.4, 0, -31.2))
  }, [])

  // Bannières des disciplines (tissu animé) suspendues aux murs nord et sud
  const banners = useMemo(
    () =>
      DISCIPLINES.map((d, i) => {
        const mat = bannerMat(`dojo-${d.id}`, { kanji: d.kanji, sub: d.label.split(' ')[0] }, '#1a1c20', '#e2d6bb').clone()
        applyCloth(mat, 0.03, 0.5 + i * 0.03)
        const north = i < BANNERS_N.length
        const x = north ? BANNERS_N[i] : BANNERS_S[i - BANNERS_N.length]
        return { id: d.id, mat, pos: [x, 3.25, north ? -45.75 : -26.25] as [number, number, number], rot: north ? 0 : Math.PI }
      }),
    [],
  )
  const chochin: LanternItem[] = useMemo(
    () => [
      ...[-22.0, -17.5].flatMap((x) => [{ p: [x, 3.6, -40.5] as [number, number, number] }, { p: [x, 3.6, -31.5] as [number, number, number] }]),
      { p: [-25.2, 2.9, -38.4], s: 1.3 },
      { p: [-25.2, 2.9, -33.6], s: 1.3 },
    ],
    [],
  )
  const andons: LanternItem[] = useMemo(() => [{ p: [-14.5, 0, -44.6] }, { p: [-14.5, 0, -27.4] }, { p: [-25.4, 0, -44.8] }, { p: [-25.4, 0, -27.2] }], [])
  const candles: LanternItem[] = useMemo(() => [{ p: [-26.95, 0.78, -36.55] }, { p: [-26.95, 0.78, -35.45] }], [])

  useColliders(
    'dojo',
    [
      { x0: -28, x1: -25.2, z0: -39.6, z1: -32.4 },
      ...DESK_X.flatMap((x) => DESK_Z.map((z) => ({ x0: x - 0.25, x1: x + 0.25, z0: z - 0.45, z1: z + 0.45 }))),
      { x0: -11.3, x1: -10, z0: -45.8, z1: -44.0 },
      { x0: -11.3, x1: -10, z0: -28.0, z1: -26.6 },
    ],
    [...andons.map((a) => ({ x: a.p[0], z: a.p[2], r: 0.26 })), { x: -12.4, z: -40.8, r: 0.32 }, { x: -12.4, z: -31.2, r: 0.32 }],
  )

  useInteractable(() => ({
    id: 'dojo-lectern',
    zone: 'dojo',
    label: 'Catalogue des enseignements',
    verb: 'Pupitre du maître',
    box: boxAt(-26.6, 0.7, -36, 1.4, 1.2, 2.2),
    maxDist: 4.2,
    anchor: new THREE.Vector3(-25.2, 0, -36),
    onInteract: () => openPanel('courses', { position: [-23.6, 1.85, -36.4], target: [-27.2, 1.1, -36], fov: 58 }),
  }))

  return (
    <group>
      <StaticMeshes parts={parts} />
      {banners.map((bn) => (
        <group key={bn.id} position={bn.pos} rotation={[0, bn.rot, 0]}>
          <mesh material={bn.mat} position={[0, 0, 0.06]}>
            <planeGeometry args={[1.1, 2.75, 4, 12]} />
          </mesh>
          <mesh material={M().woodBlack} position={[0, 1.42, 0.07]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 1.25, 6]} />
          </mesh>
        </group>
      ))}
      <Chochin id="dojo-chochin" zone="dojo" items={chochin} intensity={5} distance={8} />
      <Andons id="dojo-andons" zone="dojo" items={andons} intensity={2} distance={6} />
      <Candles id="dojo-candles" zone="dojo" items={candles} intensity={0.8} />
      <ShadowPlay zone="dojo" />
    </group>
  )
}
