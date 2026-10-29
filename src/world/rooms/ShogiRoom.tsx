/**
 * SALLE 03 — LA CHAMBRE DU SHOGI
 * Pièce très sombre : goban sous une lanterne unique, coussins, paravents
 * peints, rideaux, théâtre d'ombres rétroéclairé, rouleaux de stratégie.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { M, inkPanelMat, kakejikuMat, bannerMat, handwritingMat } from '../assets'
import { useStatic, StaticMeshes } from '../Static'
import { Placer, cushion, byobu, kakejiku, lowTable, teaSet, openScroll, scrollRack, incenseBurner, tansu } from '../props/furniture'
import { Chochin, Andons, Candles, type LanternItem } from '../props/Lanterns'
import { useColliders } from './common'
import { useInteractable, openPanel } from '../../interaction/useInteractable'
import { boxAt } from '../../interaction/registry'
import { ShogiBoard3D } from '../shogi/ShogiBoard3D'
import { useGame } from '../../store/game'
import { applyCloth } from '../wind'
import { ShadowPlay } from '../effects/ShadowPlay'

export const SHOGI_BOARD_POS: [number, number, number] = [17, 0, -18.2]

export function ShogiRoom() {
  const [bx, , bz] = SHOGI_BOARD_POS
  const active = useGame((s) => s.panel?.id === 'shogi')
  const decor = useStatic((b) => {
    const m = M()
    const P = new Placer(b)
    // coussins des joueurs
    cushion(P.at(bx, 0, bz + 0.62), m.fabricRed, 0.62, 0.62)
    cushion(P.at(bx, 0, bz - 0.62), m.fabricIndigo, 0.62, 0.62)
    // tapis de jeu (feutre sombre sous le goban)
    P.box(m.fabricDark, 2.2, 0.012, 2.4, [bx, 0.006, bz])
    // paravents peints
    byobu(P.at(bx, 0, bz - 2.35), inkPanelMat(41, { deer: true, moon: true, gold: true }, 1024, 400), 6, 0.55, 1.55)
    byobu(P.at(bx - 3.6, 0, bz - 4.6, 0.5), inkPanelMat(43, { pine: true, gold: true }, 1024, 400), 6, 0.5, 1.5)
    // théâtre d'ombres : grand écran de papier rétroéclairé (mur est)
    const screen = new THREE.PlaneGeometry(4.4, 2.5)
    P.geo(screen, m.shojiLit, [23.83, 1.5, -18], [0, -Math.PI / 2, 0])
    P.box(m.woodBlack, 0.08, 0.1, 4.6, [23.82, 2.8, -18])
    P.box(m.woodBlack, 0.08, 0.12, 4.6, [23.82, 0.2, -18])
    for (const z of [-20.25, -15.75]) P.box(m.woodBlack, 0.08, 2.7, 0.1, [23.82, 1.5, z])
    for (let k = 1; k < 4; k++) P.box(m.woodBlack, 0.05, 2.5, 0.04, [23.8, 1.5, -20.2 + k * 1.1])
    // rouleaux de stratégie
    kakejiku(P.at(10.18, 2.6, -13.4, Math.PI / 2), kakejikuMat('一手', 31, { sub: 'Un coup' }))
    kakejiku(P.at(10.18, 2.6, -22.6, Math.PI / 2), kakejikuMat('先読', 32, { sub: 'Lire à l’avance' }))
    kakejiku(P.at(20.5, 2.6, -25.82, 0), kakejikuMat('', 33, { ink: true }))
    kakejiku(P.at(13.6, 2.6, -25.82, 0), kakejikuMat('王将', 34))
    // étagère de rouleaux et table d'étude
    scrollRack(P.at(21.7, 0, -10.35, Math.PI), 2.4, 1.6, 0.4, 5, 3, 12)
    const T = P.at(13.0, 0, -12.2, 0.15)
    lowTable(T, 1.1, 0.6, 0.32, m.woodBlack)
    openScroll(T.at(-0.15, 0.32, 0, 0.1), handwritingMat(301, '定跡'), 0.32, 0.5)
    teaSet(T.at(0.32, 0.32, 0.05))
    cushion(T.at(0, 0, 0.6), m.fabricDark)
    incenseBurner(P.at(bx + 1.5, 0, bz - 1.4))
    tansu(P.at(23.55, 0, -11.6, -Math.PI / 2), 1.2, 0.8, 0.45, 9)
    // boîtes à pièces sur le tapis
    P.box(m.woodMid, 0.12, 0.05, 0.08, [bx + 0.55, 0.035, bz + 0.25])
    P.box(m.woodMid, 0.12, 0.05, 0.08, [bx - 0.55, 0.035, bz - 0.25])
  }, [])

  // Rideaux (tissu animé) le long du mur ouest, de part et d'autre de la porte
  const curtain = useMemo(() => {
    const mm = bannerMat('shogi-curtain', {}, '#3a1714', '#6a3a2a').clone()
    applyCloth(mm, 0.03, 0.4)
    return mm
  }, [])
  const curtain2 = useMemo(() => {
    const mm = bannerMat('shogi-curtain-b', { kanji: '将' }, '#121418', '#a07a46').clone()
    applyCloth(mm, 0.03, 0.45)
    return mm
  }, [])

  const hanging: LanternItem[] = useMemo(() => [{ p: [bx, 2.05, bz], s: 1.25 }], [bx, bz])
  const andons: LanternItem[] = useMemo(
    () => [
      { p: [bx - 1.7, 0, bz + 1.3] },
      { p: [bx + 1.7, 0, bz + 1.3] },
      { p: [bx - 1.7, 0, bz - 1.3] },
      { p: [bx + 1.7, 0, bz - 1.3] },
    ],
    [bx, bz],
  )
  const candles: LanternItem[] = useMemo(() => [{ p: [13.45, 0.32, -12.1] }, { p: [12.5, 0.32, -12.35] }], [])

  useColliders(
    'shogi',
    [
      { x0: bx - 1.15, x1: bx + 1.15, z0: bz - 1.05, z1: bz + 1.05 },
      { x0: bx - 1.75, x1: bx + 1.75, z0: bz - 2.55, z1: bz - 2.15 },
      { x0: 12.2, x1: 15.4, z0: -23.6, z1: -22.0 },
      { x0: 12.3, x1: 13.7, z0: -12.6, z1: -11.8 },
      { x0: 20.4, x1: 23.0, z0: -10.6, z1: -10.1 },
      { x0: 23.2, x1: 24, z0: -12.3, z1: -10.9 },
    ],
    andons.map((a) => ({ x: a.p[0], z: a.p[2], r: 0.26 })),
  )

  useInteractable(() => ({
    id: 'shogi-board',
    zone: 'shogi',
    label: 'S’asseoir au plateau',
    verb: 'Shogi · Table stratégique',
    box: boxAt(bx, 0.3, bz, 1.4, 0.6, 1.2),
    maxDist: 3.4,
    anchor: new THREE.Vector3(bx, 0, bz + 0.6),
    onInteract: () => openPanel('shogi', { position: [bx + 0.26, 1.12, bz + 0.6], target: [bx + 0.26, 0.16, bz - 0.08], fov: 46 }),
  }))

  return (
    <group>
      <StaticMeshes parts={decor} />
      <group position={SHOGI_BOARD_POS}>
        <ShogiBoard3D interactive={active} />
      </group>
      {[-24.6, -22.9, -14.1, -12.4].map((z, i) => (
        <mesh key={z} material={i % 2 ? curtain2 : curtain} position={[10.2, 2.45, z]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.5, 4.2, 4, 14]} />
        </mesh>
      ))}
      <Chochin id="shogi-hanging" zone="shogi" items={hanging} intensity={3.2} distance={5.5} />
      <Andons id="shogi-andon" zone="shogi" items={andons} intensity={0.45} distance={3.5} />
      <Candles id="shogi-candles" zone="shogi" items={candles} intensity={0.5} />
      <ShadowPlay zone="shogi" />
    </group>
  )
}
