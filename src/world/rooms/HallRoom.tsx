/**
 * SALLE 01 — LE HALL DES OMBRES
 * Grand hall à galeries : autel et bannière de l'emblème, panneaux d'encre aux
 * silhouettes de shinobi, emblème gravé au sol, tables de shogi, plan de
 * l'école et tableau des annonces.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { Sparkles } from '@react-three/drei'
import { M, bannerMat, shadowPanelMat, cachedMaterial, dynamicTexture, kakejikuMat } from '../assets'
import { useStatic, StaticMeshes } from '../Static'
import { Placer, lowTable, cushion, railing, bonsai, dais, incenseBurner, noticeBoard, weaponDisplay, katanaStand, hibachi, ikebana } from '../props/furniture'
import { Chochin, Andons, Candles, type LanternItem } from '../props/Lanterns'
import { HallAtmosphere } from './HallAtmosphere'
import { decorShogi, useColliders, planBoardMat, noticeSheetMats } from './common'
import { useInteractable, openPanel } from '../../interaction/useInteractable'
import { boxAt, focusFrom } from '../../interaction/registry'
import { applyCloth } from '../wind'
import { makeCanvas, ctx2d, JP_FONT, LATIN_FONT } from '../../textures/util'
import { drawEmblem } from '../../textures/generators'
import { useGame } from '../../store/game'
import { audio } from '../../audio/engine'
import { ShadowPlay } from '../effects/ShadowPlay'

const POSTS_Z = [-1.8, -7.6, -11.0, -14.6, -21.6, -25.0]
const TABLES: [number, number][] = [
  [-8.9, -9.3],
  [-8.9, -13.0],
  [-8.9, -21.5],
  [8.9, -9.3],
  [8.9, -12.9],
  [8.9, -21.5],
]

function deviseMat() {
  return cachedMaterial('hall-devise', () => {
    const tex = dynamicTexture('hall-devise', () => {
      const W = 1024
      const H = 512
      const c = makeCanvas(W, H)
      const ctx = ctx2d(c)
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, '#2b2018')
      g.addColorStop(1, '#1b140f')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = '#a07c45'
      ctx.lineWidth = 8
      ctx.strokeRect(16, 16, W - 32, H - 32)
      ctx.lineWidth = 2
      ctx.strokeRect(32, 32, W - 64, H - 64)
      drawEmblem(ctx, W / 2, 120, 62, '#c9a45f')
      ctx.fillStyle = '#e2cd9c'
      ctx.textAlign = 'center'
      ctx.font = `italic 500 50px ${LATIN_FONT}`
      ctx.fillText('« Si le roi ne bouge pas,', W / 2, 260)
      ctx.fillText('ses sujets ne le suivront pas. »', W / 2, 320)
      ctx.font = `600 30px ${LATIN_FONT}`
      ctx.fillStyle = '#b89a66'
      ctx.fillText('— Shikae Nara, fondatrice', W / 2, 390)
      ctx.font = `800 44px ${JP_FONT}`
      ctx.fillText('王 将', W / 2, 458)
      return c
    })
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05 })
  })
}

export function HallRoom() {
  const parts = useStatic((b) => {
    const m = M()
    const P = new Placer(b)
    // --- galeries (balcons) est/ouest
    for (const s of [-1, 1]) {
      const xIn = s * 7.8
      const xMid = s * 8.9
      P.box(m.planks, 2.2, 0.08, 25.7, [xMid, 4.56, -13])
      P.box(m.woodDark, 2.2, 0.22, 25.7, [xMid, 4.41, -13], [0, 0, 0], true)
      P.box(m.woodBlack, 0.22, 0.34, 25.7, [xIn, 4.38, -13])
      railing(P.at(xIn, 4.6, -13, Math.PI / 2), 25.6, 0.85, m.woodBlack, 1.6)
      for (const z of POSTS_Z) {
        P.box(m.woodBlack, 0.3, 4.4, 0.3, [xIn, 2.2, z], [0, 0, 0], true)
        P.cyl(m.stoneDark, 0.24, 0.27, 0.14, 8, [xIn, 0.07, z])
        P.box(m.woodBlack, 1.0, 0.16, 0.2, [xIn + s * 0.5, 4.1, z])
      }
      // panneaux peints et bannières au-dessus des galeries
      ;[-3.5, -7.5, -11.5, -15.5, -19.5, -23.5].forEach((z, i) => {
        const g = new THREE.PlaneGeometry(i % 2 ? 1.5 : 1.9, i % 2 ? 3.4 : 3.2)
        const mat = i % 2 ? bannerMat('hall-side', { emblem: true, kanji: '影' }, undefined, undefined, 1.5 / 3.4) : shadowPanelMat(20 + i + (s > 0 ? 10 : 0))
        P.geo(g, mat, [s * 9.83, 6.75, z], [0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0])
        if (i % 2 === 0) {
          P.box(m.woodBlack, 0.05, 0.08, 2.0, [s * 9.8, 8.4, z])
          P.box(m.woodBlack, 0.05, 0.08, 2.0, [s * 9.8, 5.1, z])
        } else P.cyl(m.woodBlack, 0.03, 0.03, 1.7, 6, [s * 9.78, 8.5, z], [Math.PI / 2, 0, 0])
      })
    }
    // --- escalier vers la galerie est (accès fermé)
    const steps = 15
    for (let i = 0; i < steps; i++) {
      const x = 3.85 + i * 0.27
      const y = (i + 1) * 0.3
      P.box(m.woodDark, 0.3, 0.05, 1.55, [x, y - 0.025, -1.05])
      P.box(m.woodBlack, 0.27, 0.3, 0.04, [x - 0.12, y - 0.15, -1.05], [0, 0, 0])
    }
    for (const z of [-1.85, -0.25]) {
      const len = Math.hypot(4.05, 4.5)
      P.box(m.woodBlack, len, 0.3, 0.07, [5.85, 2.25, z], [0, 0, Math.atan2(4.5, 4.05)], true)
    }
    P.box(m.woodBlack, 0.1, 0.9, 0.1, [3.65, 0.45, -1.85])
    P.box(m.woodBlack, 0.1, 0.9, 0.1, [3.65, 0.45, -0.25])
    P.cyl(m.rope, 0.03, 0.03, 1.6, 8, [3.65, 0.72, -1.05], [Math.PI / 2, 0, 0])
    P.box(m.paperSheet, 0.02, 0.22, 0.12, [3.62, 0.55, -0.85], [0, 0, 0])

    // --- estrade et autel
    dais(P.at(0, 0, -24.3), 7.2, 3.4, 0.45)
    const A = P.at(0, 0.45, -24.9)
    lowTable(A, 2.4, 0.7, 0.42, m.woodBlack)
    bonsai(A.at(0, 0.42, 0), 1.3)
    incenseBurner(A.at(-0.75, 0.42, 0.05))
    ikebana(A.at(0.85, 0.42, 0.0), 0.9)
    katanaStand(A.at(0, 0, 0.8))
    // grande bannière (cadre)
    P.cyl(m.woodBlack, 0.06, 0.06, 4.3, 8, [0, 8.62, -25.75], [0, 0, Math.PI / 2])
    // panneaux de part et d'autre
    for (const s of [-1, 1]) {
      const g = new THREE.PlaneGeometry(1.9, 5.0)
      P.geo(g, shadowPanelMat(s > 0 ? 3 : 4), [s * 4.05, 5.7, -25.83])
      P.box(m.woodBlack, 2.05, 0.1, 0.06, [s * 4.05, 8.25, -25.8])
      P.box(m.woodBlack, 2.05, 0.1, 0.06, [s * 4.05, 3.15, -25.8])
      P.geo(new THREE.PlaneGeometry(0.55, 1.6), kakejikuMat(s > 0 ? '策' : '影', s > 0 ? 8 : 9), [s * 8.65, 3.6, -25.82])
    }
    // --- tableau de la devise
    const D = P.at(0, 0, -22.05)
    D.box(m.woodBlack, 2.7, 1.35, 0.1, [0, 1.02, 0], [0, 0, 0], true)
    D.geo(new THREE.PlaneGeometry(2.5, 1.22), deviseMat(), [0, 1.02, 0.052])
    for (const sx of [-1, 1]) {
      D.box(m.woodBlack, 0.12, 1.75, 0.12, [sx * 1.32, 0.87, 0])
      D.box(m.woodBlack, 0.12, 0.08, 0.6, [sx * 1.32, 0.04, 0])
    }
    D.box(m.woodBlack, 2.9, 0.1, 0.16, [0, 1.78, 0])

    // --- emblème gravé au sol
    const disk = new THREE.CircleGeometry(3.4, 64)
    disk.rotateX(-Math.PI / 2)
    const duv = disk.attributes.uv as THREE.BufferAttribute
    const dpos = disk.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < duv.count; i++) duv.setXY(i, dpos.getX(i), -dpos.getZ(i))
    P.geo(disk, m.stoneDark, [0, 0.004, -13])
    const ring = new THREE.RingGeometry(3.38, 3.5, 64)
    ring.rotateX(-Math.PI / 2)
    P.geo(ring, m.gold, [0, 0.006, -13])
    const em = new THREE.PlaneGeometry(6.2, 6.2)
    em.rotateX(-Math.PI / 2)
    P.geo(em, m.emblemGold, [0, 0.008, -13])

    // --- tables de shogi sous les galeries
    TABLES.forEach(([x, z], i) => {
      const T0 = P.at(x, 0, z, x > 0 ? -Math.PI / 2 : Math.PI / 2)
      lowTable(T0, 0.95, 0.95, 0.3, m.woodDark)
      decorShogi(T0.at(0, 0.3, 0), i + 3, false)
      cushion(T0.at(0, 0, 0.85), m.fabricDark)
      cushion(T0.at(0, 0, -0.85), m.fabricDark)
    })
    // --- plan de l'école (mur est) et tableau des annonces (mur ouest)
    P.box(m.woodBlack, 0.08, 2.2, 1.9, [9.82, 1.85, -16.8 + 5.6])
    P.geo(new THREE.PlaneGeometry(1.75, 2.02), planBoardMat(), [9.77, 1.85, -11.2], [0, -Math.PI / 2, 0])
    noticeBoard(P.at(-9.78, 1.75, -11.0, Math.PI / 2), 2.2, 1.3, noticeSheetMats(), 7)
    // --- présentoir d'armes, braseros
    weaponDisplay(P.at(-6.8, 1.2, -0.2, 0), 1.3)
    weaponDisplay(P.at(6.8, 1.2, -0.2, 0), 1.3)
    hibachi(P.at(-3.2, 0, -4.2))
    hibachi(P.at(3.2, 0, -4.2))
  }, [])

  const bannerMatWave = useMemo(() => {
    const mm = bannerMat('hall-main', { emblem: true, kanji: '王将' }, undefined, undefined, 3.8 / 6.4).clone()
    applyCloth(mm, 0.04, 0.5)
    return mm
  }, [])

  const chochin: LanternItem[] = useMemo(
    () => [
      ...[-3.2, -6.4, -9.6, -12.8, -16.0, -19.2, -22.4].flatMap((z) => [
        { p: [-7.95, 3.55, z] as [number, number, number] },
        { p: [7.95, 3.55, z] as [number, number, number] },
      ]),
      { p: [-2.4, 3.2, -22.9], s: 1.8 },
      { p: [2.4, 3.2, -22.9], s: 1.8 },
    ],
    [],
  )
  const andons: LanternItem[] = useMemo(
    () => [
      ...[-4.5, -9.5, -16.5, -20.5].flatMap((z) => [{ p: [-5.2, 0, z] as [number, number, number] }, { p: [5.2, 0, z] as [number, number, number] }]),
      { p: [-3.2, 0.45, -23.0], s: 1.1 },
      { p: [3.2, 0.45, -23.0], s: 1.1 },
    ],
    [],
  )
  const candles: LanternItem[] = useMemo(
    () => [-1.05, -0.45, 0.45, 1.05].map((x) => ({ p: [x, 0.87, -24.7] as [number, number, number], s: 1.2 })),
    [],
  )

  useColliders(
    'hall',
    [
      { x0: -3.7, x1: 3.7, z0: -26, z1: -22.25 },
      { x0: -1.45, x1: 1.45, z0: -22.25, z1: -21.85 },
      { x0: 3.6, x1: 8.2, z0: -1.95, z1: -0.15 },
      ...TABLES.map(([x, z]) => ({ x0: x - 0.85, x1: x + 0.85, z0: z - 0.6, z1: z + 0.6 })),
    ],
    [
      ...POSTS_Z.flatMap((z) => [
        { x: -7.8, z, r: 0.24 },
        { x: 7.8, z, r: 0.24 },
      ]),
      ...andons.filter((a) => a.p[1] === 0).map((a) => ({ x: a.p[0], z: a.p[2], r: 0.26 })),
      { x: -3.2, z: -4.2, r: 0.34 },
      { x: 3.2, z: -4.2, r: 0.34 },
    ],
  )

  useInteractable(() => ({
    id: 'hall-devise',
    zone: 'hall',
    label: "Découvrir l'École des Ombres",
    verb: 'Lire la devise',
    box: boxAt(0, 1.0, -22.05, 2.8, 1.8, 0.5),
    anchor: new THREE.Vector3(0, 0, -21.8),
    onInteract: () => openPanel('presentation', focusFrom([0, 1.05, -22.05], 0, 2.1, 0.25, 55)),
  }))
  useInteractable(() => ({
    id: 'hall-notices',
    zone: 'hall',
    label: 'Consulter les annonces',
    verb: 'Tableau des annonces',
    box: boxAt(-9.7, 1.75, -11.0, 0.5, 1.6, 2.4),
    anchor: new THREE.Vector3(-9.3, 0, -11),
    onInteract: () => openPanel('announcements', focusFrom([-9.75, 1.75, -11.0], Math.PI / 2, 1.9, 0.0, 60)),
  }))
  useInteractable(() => ({
    id: 'hall-plan',
    zone: 'hall',
    label: "Plan de l'école",
    verb: 'Plan gravé',
    box: boxAt(9.7, 1.85, -11.2, 0.5, 2.2, 2.0),
    anchor: new THREE.Vector3(9.3, 0, -11.2),
    onInteract: () => openPanel('map', focusFrom([9.75, 1.85, -11.2], -Math.PI / 2, 2.1, 0.0, 60)),
  }))
  useInteractable(() => ({
    id: 'hall-emblem',
    zone: 'hall',
    label: "Méditer sur l'emblème",
    verb: 'Emblème des ombres',
    box: boxAt(0, 0.05, -13, 6.8, 0.2, 6.8),
    maxDist: 4.5,
    anchor: new THREE.Vector3(0, 0, -13),
    onInteract: () => openPanel('presentation', { position: [0, 7.5, -10.5], target: [0, 0, -13], fov: 55 }, { tab: 'principes' }),
  }))
  useInteractable(() => ({
    id: 'hall-stairs',
    zone: 'hall',
    label: 'Galeries — accès réservé au Conseil',
    verb: 'Escalier',
    box: boxAt(4.6, 0.8, -1.05, 1.8, 1.6, 1.8),
    onInteract: () => {
      useGame.getState().notify('Une corde barre l’escalier : les galeries sont réservées au Conseil.', 'info')
      audio.ui('error')
    },
  }))

  return (
    <group>
      <StaticMeshes parts={parts} />
      <mesh material={bannerMatWave} position={[0, 5.4, -25.7]}>
        <planeGeometry args={[3.8, 6.4, 6, 18]} />
      </mesh>
      <Chochin id="hall-chochin" zone="hall" items={chochin} intensity={9} distance={10} />
      <Andons id="hall-andon" zone="hall" items={andons} intensity={3} distance={7} />
      <Candles id="hall-candles" zone="hall" items={candles} intensity={1.5} />
      <Sparkles count={70} scale={[16, 7, 22]} position={[0, 4, -13]} size={2.2} speed={0.12} noise={0.6} color="#e8c58a" opacity={0.5} />
      <ShadowPlay zone="hall" />
      <HallAtmosphere />
    </group>
  )
}
