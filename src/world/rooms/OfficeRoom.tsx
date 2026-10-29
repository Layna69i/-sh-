/**
 * SALLE 07 — LE BUREAU DE SHIKAE NARA
 * Pièce intime et silencieuse : bureau bas face à la fenêtre ouverte sur la
 * forêt des Nara, carnets ouverts et annotations, ouvrages de psychologie,
 * petit shogi en cours d'analyse, thé refroidi, bougie presque consumée,
 * bois de cerf, couverture repliée… Les détails suggèrent sans rien affirmer.
 * À gauche de sa place, le coin des souvenirs (OfficeMemories) : portrait de famille
 * encadré et bandelette de Kaen, près de l'encrier et du carnet.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { M, kakejikuMat, handwritingMat, inkPanelMat } from '../assets'
import { useStatic, StaticMeshes } from '../Static'
import { Placer, writingDesk, cushion, bookshelf, bookStack, paperStack, inkSet, teaSet, antlers, tansu, ikebana, kakejiku, byobu, openScroll } from '../props/furniture'
import { Andons, Candles, type LanternItem } from '../props/Lanterns'
import { bookMats, useColliders, decorShogi } from './common'
import { useInteractable, openPanel } from '../../interaction/useInteractable'
import { boxAt, focusFrom } from '../../interaction/registry'
import { useGame } from '../../store/game'
import { audio } from '../../audio/engine'
import { ShadowPlay } from '../effects/ShadowPlay'
import { FamilyPortrait, KaenBandage, MEMORY } from './OfficeMemories'

const DESK = { x: 0, z: -54.3 }

/** Pose de caméra qui garde l'objet dans le tiers gauche de l'écran (le panneau occupe la droite). */
function sideFocus(target: [number, number, number], yaw: number, dist: number, height: number, side: number, fov: number) {
  const f = focusFrom(target, yaw, dist, height, fov)
  // vecteur droite de la caméra regardant l'objet depuis `yaw`
  const rx = Math.cos(yaw), rz = -Math.sin(yaw)
  const t: [number, number, number] = [target[0] + rx * side, target[1], target[2] + rz * side]
  return { ...f, position: [f.position[0] + rx * side * 0.35, f.position[1], f.position[2] + rz * side * 0.35] as [number, number, number], target: t }
}

export function OfficeRoom() {
  const parts = useStatic((b) => {
    const m = M()
    const books = bookMats()
    const P = new Placer(b)
    // encadrement de la fenêtre (mur nord) et shoji ouverts
    const W = 3.4
    P.box(m.woodBlack, W + 0.3, 0.12, 0.36, [0, 0.72, -56])
    P.box(m.woodBlack, W + 0.3, 0.14, 0.34, [0, 2.48, -56])
    for (const sx of [-1, 1]) P.box(m.woodBlack, 0.14, 1.9, 0.34, [(sx * (W + 0.14)) / 2, 1.6, -56])
    for (const sx of [-1, 1]) {
      const g = new THREE.PlaneGeometry(0.85, 1.7)
      P.geo(g, m.shoji, [sx * (W / 2 - 0.1), 1.6, -55.8])
      P.box(m.woodDark, 0.9, 1.74, 0.03, [sx * (W / 2 - 0.1), 1.6, -55.79 + 0.0])
    }
    P.box(m.woodMid, W, 0.04, 0.5, [0, 0.76, -55.75])
    // bureau bas face à la fenêtre
    const D = P.at(DESK.x, 0, DESK.z, Math.PI)
    writingDesk(D, 1.5, 0.62)
    const top = D.at(0, 0.32, 0)
    openScroll(top.at(-0.25, 0, 0.02, 0.15), handwritingMat(701, '観察'), 0.4, 0.5)
    // la moitié gauche du plateau est réservée aux souvenirs (portrait, bandelette)
    paperStack(top.at(-0.6, 0, -0.14), 7, 0.21, 0.3, 702)
    top.geo(new THREE.PlaneGeometry(0.24, 0.3).rotateX(-Math.PI / 2), handwritingMat(703, '心'), [0.1, 0.004, -0.1], [0, 0.25, 0])
    inkSet(top.at(0.12, 0, 0.18))
    teaSet(top.at(-0.62, 0, 0.12))
    bookStack(top.at(0.66, 0, 0.18), 3, 704, books)
    cushion(P.at(DESK.x, 0, DESK.z + 0.75), m.fabricGreen, 0.62, 0.62)
    // couverture repliée sur un second coussin
    cushion(P.at(DESK.x + 1.15, 0, DESK.z + 0.95), m.fabricDark, 0.6, 0.6)
    P.rbox(m.fabricIndigo, 0.5, 0.08, 0.36, 0.03, [DESK.x + 1.15, 0.14, DESK.z + 0.95], [0, 0.3, 0])
    // bibliothèque de psychologie et de stratégie (mur ouest)
    bookshelf(P.at(-5.75, 0, -51.0, Math.PI / 2), 2.4, 2.6, 0.4, 711, books, 6)
    bookshelf(P.at(-5.75, 0, -48.4, Math.PI / 2), 2.0, 2.6, 0.4, 712, books, 6)
    // mur est : tansu, bois de cerf, petit shogi
    tansu(P.at(5.7, 0, -51.4, -Math.PI / 2), 1.3, 0.85, 0.45, 713)
    antlers(P.at(5.88, 1.7, -51.4, -Math.PI / 2), 1.3)
    const S = P.at(3.6, 0, -49.6, -0.4)
    decorShogi(S, 13, true)
    cushion(S.at(0, 0, 0.6), m.fabricRed, 0.55, 0.55)
    paperStack(S.at(0.45, 0, 0.1), 2, 0.21, 0.3, 714)
    // figurine de cerf en bois (posée sur le plateau, au coin) et lettre pliée
    const fig = P.at(-0.68, 0.32, DESK.z + 0.14, 0.5)
    fig.box(m.woodLight, 0.09, 0.05, 0.035, [0, 0.07, 0])
    fig.box(m.woodLight, 0.02, 0.07, 0.02, [0.035, 0.12, 0])
    fig.box(m.woodLight, 0.035, 0.03, 0.025, [0.05, 0.16, 0])
    for (const lx of [-0.035, 0.035]) fig.box(m.woodLight, 0.012, 0.05, 0.012, [lx, 0.025, 0])
    P.box(m.paperSheet, 0.16, 0.006, 0.1, [0.62, 0.335, DESK.z + 0.2], [0, -0.4, 0])
    // rouleau, paravent, ikebana
    kakejiku(P.at(-3.3, 2.55, -55.82), kakejikuMat('王将', 715, { sub: 'Si le roi ne bouge pas…' }), 0.62, 1.8)
    byobu(P.at(-3.8, 0, -47.3, 0.25), inkPanelMat(716, { deer: true, moon: true, gold: true }, 1024, 400), 4, 0.5, 1.4)
    ikebana(P.at(3.6, 0, -55.5), 1.0)
    // tablette sous la fenêtre : bougie usée et carnet fermé
    P.box(m.woodDark, 0.22, 0.03, 0.3, [1.35, 0.79, -55.72])
  }, [])

  const andons: LanternItem[] = useMemo(() => [{ p: [-1.6, 0, -53.6] }, { p: [4.9, 0, -47.2] }], [])
  const candles: LanternItem[] = useMemo(() => [{ p: [0.42, 0.32, DESK.z - 0.12], s: 0.55 }, { p: [1.35, 0.8, -55.72], s: 0.7 }], [])

  useColliders(
    'office',
    [
      { x0: DESK.x - 0.8, x1: DESK.x + 0.8, z0: DESK.z - 0.4, z1: DESK.z + 0.35 },
      { x0: -6, x1: -5.4, z0: -52.3, z1: -47.3 },
      { x0: 5.3, x1: 6, z0: -52.1, z1: -50.7 },
      { x0: 3.1, x1: 4.1, z0: -50.1, z1: -49.0 },
      { x0: -4.9, x1: -2.7, z0: -47.8, z1: -46.8 },
    ],
    andons.map((a) => ({ x: a.p[0], z: a.p[2], r: 0.26 })),
  )

  useInteractable(() => ({
    id: 'office-notebook',
    zone: 'office',
    label: 'Ouvrir le carnet de Shikae',
    verb: 'Bureau de la fondatrice',
    // partie droite du bureau : la gauche porte le portrait et la bandelette (cibles distinctes)
    box: boxAt(DESK.x + 0.3, 0.45, DESK.z, 1.0, 0.6, 0.8),
    anchor: new THREE.Vector3(DESK.x, 0, DESK.z + 0.6),
    onInteract: () => openPanel('notebook', { position: [DESK.x + 0.15, 1.35, DESK.z + 1.05], target: [DESK.x - 0.1, 0.32, DESK.z - 0.05], fov: 52 }),
  }))
  useInteractable(() => ({
    id: 'office-portrait',
    zone: 'office',
    label: 'Regarder le portrait de famille',
    verb: 'Souvenir',
    box: boxAt(MEMORY.portrait.x, 0.5, MEMORY.portrait.z, 0.36, 0.4, 0.22),
    anchor: new THREE.Vector3(MEMORY.portrait.x, 0, MEMORY.portrait.z + 0.9),
    // le portrait est cadré dans le tiers gauche, à côté du panneau de texte
    onInteract: () => openPanel('garden', sideFocus([MEMORY.portrait.x, 0.5, MEMORY.portrait.z], MEMORY.portrait.ry, 0.72, 0.12, 0.13, 38), { note: 'portrait' }),
  }))
  useInteractable(() => ({
    id: 'office-bandage',
    zone: 'office',
    label: 'Regarder la bandelette de Kaen',
    verb: 'Souvenir',
    box: boxAt(MEMORY.tray.x, 0.36, MEMORY.tray.z, 0.28, 0.1, 0.22),
    anchor: new THREE.Vector3(MEMORY.tray.x, 0, MEMORY.tray.z + 0.8),
    onInteract: () => openPanel('garden', sideFocus([MEMORY.tray.x, 0.34, MEMORY.tray.z], MEMORY.tray.ry, 0.4, 0.32, 0.08, 40), { note: 'bandelette' }),
  }))
  useInteractable(() => ({
    id: 'office-window',
    zone: 'office',
    label: 'Contempler la forêt des Nara',
    verb: 'Fenêtre',
    box: boxAt(0, 1.6, -55.95, 3.4, 1.8, 0.4),
    maxDist: 4,
    anchor: new THREE.Vector3(0, 0, -55.3),
    onInteract: () => openPanel('garden', { position: [0, 1.55, -55.2], target: [0, 1.8, -70], fov: 60 }, { note: 'fenetre' }),
  }))
  useInteractable(() => ({
    id: 'office-shogi',
    zone: 'office',
    label: 'Observer la partie en cours',
    verb: 'Petit shogi',
    box: boxAt(3.6, 0.25, -49.6, 0.7, 0.5, 0.7),
    anchor: new THREE.Vector3(3.6, 0, -49.0),
    onInteract: () => {
      useGame.getState().notify('Une partie interrompue au milieu de l’analyse. Quelques pièces ont été déplacées, puis remises en place.', 'info')
      audio.piece()
    },
  }))

  return (
    <group>
      <StaticMeshes parts={parts} />
      <FamilyPortrait />
      <KaenBandage />
      <Andons id="office-andons" zone="office" items={andons} intensity={2.2} distance={6} />
      <Candles id="office-candles" zone="office" items={candles} intensity={1.0} distance={4} />
      <ShadowPlay zone="office" />
    </group>
  )
}
