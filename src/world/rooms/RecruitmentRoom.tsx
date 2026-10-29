/**
 * SALLE 08 — LE BUREAU DE RECRUTEMENT
 * Petite salle administrative : bureau d'accueil avec formulaires, pinceaux
 * et sceaux, calligraphies 門 (la porte) et 志 (la volonté), casier des
 * candidatures, noren à l'entrée.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { M, kakejikuMat, bannerMat, handwritingMat } from '../assets'
import { useStatic, StaticMeshes } from '../Static'
import { Placer, lowTable, cushion, inkSet, paperStack, kakejiku, scrollRack, tansu, ikebana } from '../props/furniture'
import { Andons, Candles, Chochin, type LanternItem } from '../props/Lanterns'
import { useColliders } from './common'
import { useInteractable, openPanel } from '../../interaction/useInteractable'
import { boxAt } from '../../interaction/registry'
import { applyCloth } from '../wind'

const DESK = { x: -15.6, z: -4.6 }

export function RecruitmentRoom() {
  const parts = useStatic((b) => {
    const m = M()
    const P = new Placer(b)
    const T = P.at(DESK.x, 0, DESK.z, Math.PI / 2)
    lowTable(T, 1.8, 0.8, 0.36, m.woodDark)
    paperStack(T.at(-0.45, 0.36, 0.05), 14, 0.21, 0.3, 801)
    T.geo(new THREE.PlaneGeometry(0.26, 0.34).rotateX(-Math.PI / 2), handwritingMat(802, '志願'), [0.1, 0.364, 0.05], [0, 0.1, 0])
    inkSet(T.at(0.55, 0.36, 0.05))
    for (let i = 0; i < 3; i++) T.box(m.fabricRed, 0.035, 0.06, 0.035, [0.7 - i * 0.06, 0.39, -0.25])
    cushion(T.at(0, 0, -0.75), m.fabricIndigo)
    cushion(T.at(0, 0, 0.75), m.fabricDark)
    kakejiku(P.at(-18.82, 2.75, -4.5, Math.PI / 2), kakejikuMat('門', 803, { sub: 'La porte' }), 0.6, 1.8)
    kakejiku(P.at(-17.8, 3.6, -8.82, 0), kakejikuMat('志', 804, { sub: 'La volonté' }), 0.55, 1.7)
    scrollRack(P.at(-15.0, 0, -8.68, 0), 2.6, 1.7, 0.4, 6, 4, 805)
    tansu(P.at(-12.0, 0, -8.55, 0), 1.2, 0.95, 0.45, 806)
    ikebana(P.at(-18.4, 0, -0.6), 1.0)
  }, [])

  const noren = useMemo(() => {
    const mm = bannerMat('recruit-noren', { kanji: '入門' }, '#24344a', '#e0d6bf').clone()
    applyCloth(mm, 0.05, 0.9)
    return mm
  }, [])
  const andons: LanternItem[] = useMemo(() => [{ p: [-18.3, 0, -8.3] }, { p: [-11.0, 0, -0.7] }], [])
  const candles: LanternItem[] = useMemo(() => [{ p: [DESK.x - 0.05, 0.36, DESK.z - 0.75] }], [])
  const chochin: LanternItem[] = useMemo(() => [{ p: [DESK.x, 2.9, DESK.z] }], [])

  useColliders(
    'recruitment',
    [
      { x0: DESK.x - 0.5, x1: DESK.x + 0.5, z0: DESK.z - 1.0, z1: DESK.z + 1.0 },
      { x0: -16.4, x1: -13.6, z0: -9, z1: -8.4 },
      { x0: -12.7, x1: -11.3, z0: -9, z1: -8.25 },
    ],
    andons.map((a) => ({ x: a.p[0], z: a.p[2], r: 0.26 })),
  )

  useInteractable(() => ({
    id: 'recruitment-desk',
    zone: 'recruitment',
    label: 'Déposer une candidature',
    verb: 'Bureau d’admission',
    box: boxAt(DESK.x, 0.45, DESK.z, 1.0, 0.7, 2.0),
    anchor: new THREE.Vector3(DESK.x + 0.8, 0, DESK.z),
    onInteract: () => openPanel('recruitment', { position: [DESK.x + 1.5, 1.45, DESK.z + 0.2], target: [DESK.x - 0.2, 0.4, DESK.z], fov: 55 }),
  }))

  return (
    <group>
      <StaticMeshes parts={parts} />
      {/* noren devant le passage vers le hall */}
      <mesh material={noren} position={[-10.24, 1.75, -4.5]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.7, 0.85, 6, 6]} />
      </mesh>
      <Andons id="recruit-andons" zone="recruitment" items={andons} intensity={2} distance={6} />
      <Candles id="recruit-candles" zone="recruitment" items={candles} intensity={0.8} />
      <Chochin id="recruit-chochin" zone="recruitment" items={chochin} intensity={4} distance={6} />
    </group>
  )
}
