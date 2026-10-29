/**
 * SALLE 05 — LE BUREAU DES MISSIONS
 * Grande carte murale du monde shinobi (épingles et fils), tableau des ordres
 * de mission (plaquettes de bois par rang), bureaux de rédaction, table de
 * planification avec carte déployée.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { M, cachedMaterial, dynamicTexture, handwritingMat } from '../assets'
import { useStatic, StaticMeshes } from '../Static'
import { Placer, writingDesk, cushion, paperStack, inkSet, tansu, scrollRack, lowTable, bookStack, kunai } from '../props/furniture'
import { Chochin, Andons, Candles, type LanternItem } from '../props/Lanterns'
import { bookMats, useColliders } from './common'
import { useInteractable, openPanel } from '../../interaction/useInteractable'
import { boxAt } from '../../interaction/registry'
import { makeCanvas, ctx2d, JP_FONT } from '../../textures/util'

const RANK_COLORS: Record<string, string> = { D: '#6f6a5c', C: '#3f6b5a', B: '#3d5a8a', A: '#8a5a24', S: '#8c2f24' }

function tagMat(rank: string) {
  return cachedMaterial(`mission-tag-${rank}`, () => {
    const tex = dynamicTexture(`mission-tag-${rank}`, () => {
      const c = makeCanvas(96, 192)
      const ctx = ctx2d(c)
      ctx.fillStyle = '#c9a46c'
      ctx.fillRect(0, 0, 96, 192)
      ctx.fillStyle = RANK_COLORS[rank]
      ctx.fillRect(0, 0, 96, 46)
      ctx.fillStyle = '#f0e2c4'
      ctx.font = `800 40px ${JP_FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(rank, 48, 38)
      ctx.fillStyle = 'rgba(30,20,12,0.85)'
      ctx.font = `800 34px ${JP_FONT}`
      ctx.fillText('任', 48, 100)
      ctx.fillText('務', 48, 145)
      return c
    })
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })
  })
}

export function MissionsRoom() {
  const parts = useStatic((b) => {
    const m = M()
    const P = new Placer(b)
    // carte murale (mur nord, partagé avec la Chambre du Shogi)
    P.box(m.woodBlack, 4.6, 2.9, 0.08, [15.2, 2.0, -9.8], [0, 0, 0], true)
    P.geo(new THREE.PlaneGeometry(4.3, 2.65), m.worldMap, [15.2, 2.0, -9.75])
    const pins: [number, number, string][] = [
      [0.02, 0.05, '#8c2f24'],
      [-1.3, -0.25, '#8c2f24'],
      [-0.6, 0.55, '#3d5a8a'],
      [1.6, 0.35, '#3f6b5a'],
      [0.6, -0.6, '#8a5a24'],
    ]
    pins.forEach(([px, py], i) => {
      P.cyl(i % 2 ? m.fabricIndigo : m.fabricRed, 0.03, 0.03, 0.04, 8, [15.2 + px, 2.0 + py, -9.72], [Math.PI / 2, 0, 0])
      if (i > 0) {
        const [qx, qy] = pins[0]
        const len = Math.hypot(px - qx, py - qy)
        P.box(m.rope, len, 0.006, 0.006, [15.2 + (px + qx) / 2, 2.0 + (py + qy) / 2, -9.71], [0, 0, Math.atan2(py - qy, px - qx)])
      }
    })
    // tableau des ordres de mission (mur est)
    P.box(m.woodMid, 0.06, 1.6, 2.6, [19.86, 1.65, -4.9])
    P.box(m.woodBlack, 0.12, 0.1, 2.8, [19.82, 2.5, -4.9])
    const ranks = ['D', 'C', 'C', 'B', 'D', 'A', 'C', 'B', 'S', 'D', 'C', 'B']
    ranks.forEach((rk, i) => {
      const col = i % 6
      const row = Math.floor(i / 6)
      const z = -5.95 + col * 0.42
      const y = 2.05 - row * 0.62
      P.geo(new THREE.PlaneGeometry(0.2, 0.4), tagMat(rk), [19.8, y, z], [0, -Math.PI / 2, (i % 3) * 0.02 - 0.02])
      P.cyl(m.bronze, 0.008, 0.008, 0.02, 6, [19.79, y + 0.22, z], [0, 0, Math.PI / 2])
    })
    // bureaux
    for (const [x, z, r] of [
      [12.0, -2.2, 0],
      [12.0, -7.4, 0],
    ] as const) {
      const S = P.at(x, 0, z, r)
      writingDesk(S, 1.1, 0.5)
      cushion(S.at(0, 0, 0.55), m.fabricIndigo)
      paperStack(S.at(-0.25, 0.32, 0), 9, 0.21, 0.3, x + z)
      inkSet(S.at(0.3, 0.32, 0.02))
    }
    // table de planification centrale
    const T = P.at(15.6, 0, -4.6)
    lowTable(T, 2.2, 1.3, 0.4, m.woodDark)
    T.geo(new THREE.PlaneGeometry(1.8, 1.05).rotateX(-Math.PI / 2), m.worldMap, [0, 0.402, 0])
    kunai(T.at(0.35, 0.41, 0.15, 0).at(0, 0, 0, 0))
    for (const [dx, dz, c] of [[-0.3, -0.1, 'r'], [0.5, 0.25, 'b'], [-0.6, 0.3, 'r'], [0.2, -0.35, 'g']] as const)
      T.cyl(c === 'r' ? m.fabricRed : c === 'b' ? m.fabricIndigo : m.fabricGreen, 0.025, 0.025, 0.04, 10, [dx, 0.425, dz])
    paperStack(T.at(-0.85, 0.4, -0.4), 5, 0.21, 0.3, 77)
    for (const [dx, dz] of [[-0.6, 0.95], [0.6, 0.95], [-0.6, -0.95], [0.6, -0.95]]) cushion(T.at(dx, 0, dz), m.fabricDark)
    // rangements
    tansu(P.at(19.55, 0, -1.4, -Math.PI / 2), 1.6, 1.1, 0.5, 31)
    scrollRack(P.at(17.6, 0, -0.32, Math.PI), 2.4, 1.8, 0.4, 6, 4, 33)
    const shelfT = P.at(19.6, 0, -8.8, -Math.PI / 2)
    lowTable(shelfT, 1.2, 0.5, 0.75, m.woodMid)
    bookStack(shelfT.at(-0.3, 0.75, 0), 6, 41, bookMats())
    paperStack(shelfT.at(0.3, 0.75, 0), 10, 0.21, 0.3, 42)
    // fiche manuscrite sur le premier bureau
    P.geo(new THREE.PlaneGeometry(0.3, 0.22).rotateX(-Math.PI / 2), handwritingMat(501, '令'), [11.75, 0.335, -2.05], [0, 0.2, 0])
  }, [])

  const chochin: LanternItem[] = useMemo(() => [{ p: [15.6, 3.0, -4.6], s: 1.3 }, { p: [12.0, 3.1, -2.2] }, { p: [12.0, 3.1, -7.4] }], [])
  const andons: LanternItem[] = useMemo(() => [{ p: [10.6, 0, -9.3] }, { p: [19.4, 0, -3.0] }], [])
  const candles: LanternItem[] = useMemo(() => [{ p: [12.45, 0.32, -2.35] }, { p: [12.45, 0.32, -7.55] }], [])

  useColliders(
    'missions',
    [
      { x0: 11.35, x1: 12.65, z0: -2.55, z1: -1.55 },
      { x0: 11.35, x1: 12.65, z0: -7.75, z1: -6.75 },
      { x0: 14.4, x1: 16.8, z0: -5.35, z1: -3.85 },
      { x0: 19.2, x1: 20, z0: -2.25, z1: -0.55 },
      { x0: 16.3, x1: 18.9, z0: -0.6, z1: 0 },
      { x0: 19.2, x1: 20, z0: -9.45, z1: -8.15 },
    ],
    andons.map((a) => ({ x: a.p[0], z: a.p[2], r: 0.26 })),
  )

  useInteractable(() => ({
    id: 'missions-map',
    zone: 'missions',
    label: 'Bureau des missions',
    verb: 'Carte des opérations',
    box: boxAt(15.2, 2.0, -9.85, 4.6, 2.9, 0.5),
    maxDist: 4.2,
    anchor: new THREE.Vector3(15.2, 0, -9.4),
    onInteract: () => openPanel('missions', { position: [14.0, 2.0, -6.6], target: [15.0, 1.9, -9.8], fov: 60 }),
  }))
  useInteractable(() => ({
    id: 'missions-board',
    zone: 'missions',
    label: 'Ordres de mission',
    verb: 'Tableau des plaquettes',
    box: boxAt(19.8, 1.65, -4.9, 0.5, 1.7, 2.7),
    anchor: new THREE.Vector3(19.3, 0, -4.9),
    onInteract: () => openPanel('missions', { position: [17.4, 1.75, -5.2], target: [19.8, 1.6, -4.9], fov: 60 }, { tab: 'disponible' }),
  }))

  return (
    <group>
      <StaticMeshes parts={parts} />
      <Chochin id="missions-chochin" zone="missions" items={chochin} intensity={4.5} distance={7} />
      <Andons id="missions-andons" zone="missions" items={andons} intensity={1.8} distance={5} />
      <Candles id="missions-candles" zone="missions" items={candles} intensity={0.8} />
    </group>
  )
}
