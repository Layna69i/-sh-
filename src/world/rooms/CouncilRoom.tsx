/**
 * SALLE 06 — LA SALLE DU CONSEIL
 * Longue table de délibération et sièges, siège du Roi devant un paravent doré,
 * étendards des huit pièces du shogi qui forment la hiérarchie de l'école.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { M, bannerMat, inkPanelMat, kakejikuMat, handwritingMat } from '../assets'
import { useStatic, StaticMeshes } from '../Static'
import { Placer, lowTable, zaisu, byobu, kakejiku, hibachi, incenseBurner, openScroll, paperStack, teaSet, ikebana, tokonoma } from '../props/furniture'
import { Chochin, Andons, Candles, type LanternItem } from '../props/Lanterns'
import { useColliders, decorShogi } from './common'
import { useInteractable, openPanel } from '../../interaction/useInteractable'
import { boxAt } from '../../interaction/registry'
import { SEED_RANKS } from '../../data/seed'
import { applyCloth } from '../wind'

const TABLE = { x: 16.4, z: -36, w: 6.2, d: 1.5 }

export function CouncilRoom() {
  const parts = useStatic((b) => {
    const m = M()
    const P = new Placer(b)
    const T = P.at(TABLE.x, 0, TABLE.z)
    lowTable(T, TABLE.w, TABLE.d, 0.38, m.woodBlack)
    T.box(m.fabricRed, TABLE.w - 0.6, 0.006, 0.36, [0, 0.383, 0])
    for (let i = 0; i < 4; i++) {
      const x = -TABLE.w / 2 + 0.95 + i * 1.45
      zaisu(T.at(x, 0, 1.15, Math.PI), m.woodBlack, m.fabricDark)
      zaisu(T.at(x, 0, -1.15, 0), m.woodBlack, m.fabricDark)
      paperStack(T.at(x, 0.38, 0.45), 3, 0.21, 0.3, i + 10)
      paperStack(T.at(x, 0.38, -0.45), 3, 0.21, 0.3, i + 20)
    }
    // siège du Roi (extrémité est) et paravent doré
    zaisu(T.at(TABLE.w / 2 + 0.85, 0, 0, Math.PI / 2), m.woodBlack, m.fabricRed)
    byobu(P.at(TABLE.x + TABLE.w / 2 + 2.15, 0, TABLE.z, -Math.PI / 2), inkPanelMat(611, { gold: true, pine: true, moon: true, layers: 3, paper: '#b89a5c' }, 1024, 420), 6, 0.6, 1.75)
    decorShogi(T.at(TABLE.w / 2 - 0.55, 0.38, 0), 6, false)
    openScroll(T.at(-0.3, 0.38, 0, Math.PI / 2), handwritingMat(612, '評定'), 0.34, 0.7)
    teaSet(T.at(1.4, 0.38, 0.1))
    incenseBurner(T.at(-TABLE.w / 2 + 0.25, 0.38, 0))
    // tokonoma et rouleau (mur nord)
    tokonoma(P.at(13.0, 0, -45.45), 2.4, 0.9)
    kakejiku(P.at(13.0, 3.1, -45.82), kakejikuMat('評定', 613, { sub: 'Délibérer' }), 0.65, 2.0)
    ikebana(P.at(13.55, 0.15, -45.45), 1.2)
    hibachi(P.at(21.8, 0, -30.4))
    hibachi(P.at(21.8, 0, -41.6))
  }, [])

  // Étendards des huit grades (tissu animé), du Pion au Roi
  const standards = useMemo(
    () =>
      SEED_RANKS.map((r, i) => {
        const mat = bannerMat(`council-${r.id}`, { kanji: r.kanji, sub: r.name }, i === 7 ? '#3a1714' : '#15171a', i === 7 ? '#e7c27a' : '#dcd2b8').clone()
        applyCloth(mat, 0.025, 0.45 + i * 0.04)
        // mur sud (intérieur, sans fenêtres), de part et d'autre du passage vers la Chambre du Shogi
        const x = [10.9, 12.3, 13.7, 15.1, 18.9, 20.3, 21.7, 23.1][i]
        return { id: r.id, mat, pos: [x, 3.1, -26.26] as [number, number, number], rot: Math.PI }
      }),
    [],
  )
  const chochin: LanternItem[] = useMemo(
    () => [{ p: [TABLE.x - 1.8, 3.4, TABLE.z], s: 1.25 }, { p: [TABLE.x + 1.8, 3.4, TABLE.z], s: 1.25 }],
    [],
  )
  const andons: LanternItem[] = useMemo(() => [{ p: [TABLE.x + TABLE.w / 2 + 1.0, 0, TABLE.z - 1.6] }, { p: [TABLE.x + TABLE.w / 2 + 1.0, 0, TABLE.z + 1.6] }, { p: [11.2, 0, -44.8] }, { p: [11.2, 0, -27.2] }], [])
  const candles: LanternItem[] = useMemo(() => [-1.6, 0, 1.6].map((dx) => ({ p: [TABLE.x + dx, 0.38, TABLE.z - 0.05] as [number, number, number] })), [])

  useColliders(
    'council',
    [
      { x0: TABLE.x - TABLE.w / 2 - 0.1, x1: TABLE.x + TABLE.w / 2 + 1.2, z0: TABLE.z - TABLE.d / 2 - 0.7, z1: TABLE.z + TABLE.d / 2 + 0.7 },
      { x0: TABLE.x + TABLE.w / 2 + 1.8, x1: TABLE.x + TABLE.w / 2 + 2.6, z0: TABLE.z - 1.8, z1: TABLE.z + 1.8 },
      { x0: 11.8, x1: 14.2, z0: -46, z1: -45.0 },
    ],
    [...andons.map((a) => ({ x: a.p[0], z: a.p[2], r: 0.26 })), { x: 21.8, z: -30.4, r: 0.32 }, { x: 21.8, z: -41.6, r: 0.32 }],
  )

  useInteractable(() => ({
    id: 'council-table',
    zone: 'council',
    label: 'Membres et hiérarchie',
    verb: 'Table du Conseil',
    box: boxAt(TABLE.x, 0.5, TABLE.z, TABLE.w + 1.6, 1.0, TABLE.d + 1.4),
    maxDist: 4,
    anchor: new THREE.Vector3(TABLE.x - TABLE.w / 2 - 0.4, 0, TABLE.z),
    onInteract: () => openPanel('council', { position: [TABLE.x - TABLE.w / 2 - 1.6, 2.4, TABLE.z + 1.6], target: [TABLE.x + 0.4, 0.4, TABLE.z], fov: 58 }),
  }))

  return (
    <group>
      <StaticMeshes parts={parts} />
      {standards.map((s) => (
        <group key={s.id} position={s.pos} rotation={[0, s.rot, 0]}>
          <mesh material={s.mat} position={[0, 0, 0.06]}>
            <planeGeometry args={[0.95, 2.6, 4, 12]} />
          </mesh>
          <mesh material={M().gold} position={[0, 1.35, 0.07]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.022, 0.022, 1.15, 6]} />
          </mesh>
        </group>
      ))}
      <Chochin id="council-chochin" zone="council" items={chochin} intensity={5} distance={8} />
      <Andons id="council-andons" zone="council" items={andons} intensity={2} distance={6} />
      <Candles id="council-candles" zone="council" items={candles} intensity={0.8} />
    </group>
  )
}
