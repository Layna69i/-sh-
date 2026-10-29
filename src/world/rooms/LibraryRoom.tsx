/**
 * SALLE 02 — LA BIBLIOTHÈQUE DES SECRETS
 * Deux niveaux de rayonnages (mezzanine décorative), allées de rayonnages
 * doubles, casiers à rouleaux, grande table de consultation éclairée à la bougie,
 * plaques des quatre villages (Konoha, Suna, Ame, Kiri).
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { M, cachedMaterial, dynamicTexture, handwritingMat } from '../assets'
import { useStatic, StaticMeshes } from '../Static'
import { Placer, bookshelf, scrollRack, lowTable, cushion, openScroll, paperStack, bookStack, inkSet, railing, ikebana } from '../props/furniture'
import { Chochin, Candles, Andons, type LanternItem } from '../props/Lanterns'
import { bookMats, useColliders } from './common'
import { useInteractable, openPanel } from '../../interaction/useInteractable'
import { boxAt, focusFrom } from '../../interaction/registry'
import { makeCanvas, ctx2d, JP_FONT, LATIN_FONT } from '../../textures/util'
import { ShadowPlay } from '../effects/ShadowPlay'

const ROWS = [
  { x: -24.6, village: 'Konoha', kanji: '木ノ葉' },
  { x: -22.1, village: 'Suna', kanji: '砂' },
  { x: -19.6, village: 'Ame', kanji: '雨' },
  { x: -17.1, village: 'Kiri', kanji: '霧' },
]
const ROW_Z0 = -23.2
const ROW_Z1 = -12.4

function villagePlaque(village: string, kanji: string) {
  return cachedMaterial(`lib-plaque-${village}`, () => {
    const tex = dynamicTexture(`lib-plaque-${village}`, () => {
      const c = makeCanvas(256, 320)
      const ctx = ctx2d(c)
      ctx.fillStyle = '#20180f'
      ctx.fillRect(0, 0, 256, 320)
      ctx.strokeStyle = '#a27c45'
      ctx.lineWidth = 6
      ctx.strokeRect(8, 8, 240, 304)
      ctx.fillStyle = '#d9b26c'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const chars = [...kanji]
      ctx.font = `800 ${chars.length > 1 ? 74 : 130}px ${JP_FONT}`
      chars.forEach((ch, i) => ctx.fillText(ch, 128, chars.length > 1 ? 70 + i * 72 : 130))
      ctx.font = `600 34px ${LATIN_FONT}`
      ctx.fillStyle = '#e6d6b0'
      ctx.fillText(village, 128, 285)
      return c
    })
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })
  })
}

export function LibraryRoom() {
  const parts = useStatic((b) => {
    const m = M()
    const books = bookMats()
    const P = new Placer(b)
    // --- rayonnages muraux, rez-de-chaussée (hauteur 3,4 m)
    const wallShelves: [number, number, number, number, number][] = [
      // x, z, rotY, largeur, graine
      [-27.75, -21.0, Math.PI / 2, 9.4, 1],
      [-27.75, -12.6, Math.PI / 2, 6.6, 2],
      [-24.0, -25.75, 0, 7.4, 3],
      [-13.6, -25.75, 0, 6.8, 4],
      [-23.5, -9.25, Math.PI, 8.6, 5],
      [-14.6, -9.25, Math.PI, 8.4, 6],
      [-10.25, -22.6, -Math.PI / 2, 6.4, 7],
      [-10.25, -11.8, -Math.PI / 2, 4.6, 8],
    ]
    for (const [x, z, r, w, sd] of wallShelves) {
      const S = P.at(x, 0, z, r)
      const n = Math.max(1, Math.round(w / 2.2))
      for (let i = 0; i < n; i++) bookshelf(S.at(-w / 2 + (i + 0.5) * (w / n), 0, 0), w / n - 0.04, 3.35, 0.42, sd * 31 + i, books, 7)
    }
    // --- mezzanine (galerie haute, décor) le long des murs ouest et nord
    P.box(m.planks, 1.6, 0.1, 16.6, [-27.2, 3.62, -17.5])
    P.box(m.woodDark, 1.6, 0.24, 16.6, [-27.2, 3.45, -17.5], [0, 0, 0], true)
    P.box(m.planks, 16.4, 0.1, 1.6, [-18.6, 3.62, -25.2])
    P.box(m.woodDark, 16.4, 0.24, 1.6, [-18.6, 3.45, -25.2], [0, 0, 0], true)
    railing(P.at(-26.4, 3.67, -17.2, Math.PI / 2), 15.8, 0.9, m.woodBlack, 1.6)
    railing(P.at(-18.2, 3.67, -24.4), 15.6, 0.9, m.woodBlack, 1.6)
    for (const z of [-24.4, -20.4, -16.4, -12.4, -9.6]) P.box(m.woodBlack, 0.2, 3.5, 0.2, [-26.4, 1.75, z], [0, 0, 0], true)
    for (const x of [-22.2, -15.4, -11.0]) P.box(m.woodBlack, 0.2, 3.5, 0.2, [x, 1.75, -24.4], [0, 0, 0], true)
    // rayonnages hauts
    for (let i = 0; i < 6; i++) bookshelf(P.at(-27.75, 3.67, -24.2 + i * 2.55 + 1.2, Math.PI / 2), 2.45, 3.0, 0.4, 200 + i, books, 6)
    for (let i = 0; i < 6; i++) {
      const x = -26.4 + i * 2.6 + 1.3
      if (x > -11) continue
      bookshelf(P.at(x, 3.67, -25.75, 0), 2.5, 3.0, 0.4, 300 + i, books, 6)
    }
    // échelles
    for (const z of [-19.0, -13.5]) {
      const L = P.at(-27.3, 0, z, Math.PI / 2)
      L.box(m.woodMid, 0.05, 3.5, 0.05, [-0.25, 1.7, 0.2], [0.18, 0, 0])
      L.box(m.woodMid, 0.05, 3.5, 0.05, [0.25, 1.7, 0.2], [0.18, 0, 0])
      for (let k = 0; k < 10; k++) L.box(m.woodMid, 0.5, 0.035, 0.04, [0, 0.3 + k * 0.32, 0.2 + 0.06 - k * 0.058])
    }
    // --- allées de rayonnages doubles
    ROWS.forEach((row, ri) => {
      const len = ROW_Z1 - ROW_Z0
      const R = P.at(row.x, 0, (ROW_Z0 + ROW_Z1) / 2, Math.PI / 2)
      const n = 4
      for (let i = 0; i < n; i++) {
        const lx = -len / 2 + (i + 0.5) * (len / n)
        if (i % 2 === 0) {
          bookshelf(R.at(lx, 0, 0.21, 0), len / n - 0.05, 2.6, 0.4, 400 + ri * 10 + i, books, 5)
          bookshelf(R.at(lx, 0, -0.21, Math.PI), len / n - 0.05, 2.6, 0.4, 500 + ri * 10 + i, books, 5)
        } else {
          scrollRack(R.at(lx, 0, 0.21, 0), len / n - 0.05, 2.6, 0.4, 5, 6, 600 + ri * 10 + i)
          scrollRack(R.at(lx, 0, -0.21, Math.PI), len / n - 0.05, 2.6, 0.4, 5, 6, 700 + ri * 10 + i)
        }
      }
      R.box(m.woodBlack, len + 0.1, 0.08, 0.9, [0, 2.64, 0])
      // plaque du village au bout de l'allée
      P.geo(new THREE.PlaneGeometry(0.62, 0.78), villagePlaque(row.village, row.kanji), [row.x, 2.15, ROW_Z1 + 0.04])
    })
    // --- grande table de consultation
    const T = P.at(-14.2, 0, -17.4)
    lowTable(T, 3.4, 1.5, 0.42, m.woodDark)
    openScroll(T.at(-0.9, 0.42, 0.1, 0.2), handwritingMat(77, '秘'), 0.36, 0.7)
    openScroll(T.at(0.8, 0.42, -0.25, -0.3), handwritingMat(78, '報'), 0.34, 0.6)
    paperStack(T.at(0.2, 0.42, 0.35), 12, 0.21, 0.3, 4)
    paperStack(T.at(1.25, 0.42, 0.3), 6, 0.21, 0.3, 5)
    bookStack(T.at(-1.45, 0.42, -0.4), 5, 9, books)
    inkSet(T.at(0.0, 0.42, -0.45))
    P.geo(new THREE.PlaneGeometry(0.9, 0.56).rotateX(-Math.PI / 2), m.worldMap, [-14.0, 0.425, -17.2], [0, 0.1, 0])
    for (const [dx, dz] of [[-1.1, 0.95], [0, 0.95], [1.1, 0.95], [-1.1, -0.95], [0, -0.95], [1.1, -0.95]]) cushion(P.at(-14.2 + dx, 0, -17.4 + dz), m.fabricIndigo)
    ikebana(P.at(-10.6, 0, -15.6), 1.1)
  }, [])

  const chochin: LanternItem[] = useMemo(
    () => [
      ...ROWS.flatMap((r) => [{ p: [r.x + 1.25, 3.0, -21.0] as [number, number, number] }, { p: [r.x + 1.25, 3.0, -15.0] as [number, number, number] }]),
      { p: [-14.2, 2.9, -17.4], s: 1.4 },
    ],
    [],
  )
  const candles: LanternItem[] = useMemo(() => [{ p: [-15.2, 0.42, -17.0] }, { p: [-13.1, 0.42, -17.75] }, { p: [-12.6, 0.42, -16.9] }], [])
  const andons: LanternItem[] = useMemo(() => [{ p: [-11.0, 0, -20.3] }, { p: [-11.0, 0, -14.4] }, { p: [-26.0, 0, -10.2] }], [])

  useColliders('library', [
    ...ROWS.map((r) => ({ x0: r.x - 0.45, x1: r.x + 0.45, z0: ROW_Z0 - 0.05, z1: ROW_Z1 + 0.05 })),
    { x0: -16.1, x1: -12.3, z0: -18.5, z1: -16.3 },
    { x0: -28, x1: -27.3, z0: -26, z1: -9 },
    { x0: -28, x1: -20.2, z0: -26, z1: -25.3 },
    { x0: -17.9, x1: -10, z0: -26, z1: -25.3 },
    { x0: -28, x1: -10, z0: -9.7, z1: -9 },
    { x0: -10.7, x1: -10, z0: -25.8, z1: -19.0 },
    { x0: -10.7, x1: -10, z0: -14.2, z1: -9.4 },
  ], [
    ...[-24.4, -20.4, -16.4, -12.4, -9.6].map((z) => ({ x: -26.4, z, r: 0.18 })),
    ...[-22.2, -15.4, -11.0].map((x) => ({ x, z: -24.4, r: 0.18 })),
    ...andons.map((a) => ({ x: a.p[0], z: a.p[2], r: 0.26 })),
  ])

  useInteractable(() => ({
    id: 'library-table',
    zone: 'library',
    label: 'Consulter les archives',
    verb: 'Table de consultation',
    box: boxAt(-14.2, 0.5, -17.4, 3.6, 0.9, 1.7),
    maxDist: 3.6,
    anchor: new THREE.Vector3(-14.2, 0, -16.4),
    onInteract: () => openPanel('archives', { position: [-12.6, 1.9, -15.5], target: [-14.6, 0.42, -17.6], fov: 55 }),
  }))
  ROWS.forEach((row) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useInteractable(() => ({
      id: `library-row-${row.village}`,
      zone: 'library',
      label: `Rayonnage de ${row.village}`,
      verb: 'Archives par village',
      box: boxAt(row.x, 1.3, ROW_Z1, 0.95, 2.6, 0.5),
      anchor: new THREE.Vector3(row.x, 0, ROW_Z1 + 0.3),
      onInteract: () => openPanel('archives', focusFrom([row.x, 1.9, ROW_Z1], 0, 2.2, -0.1, 58), { village: row.village }),
    })),
  )

  return (
    <group>
      <StaticMeshes parts={parts} />
      <Chochin id="library-chochin" zone="library" items={chochin} intensity={4} distance={7} />
      <Candles id="library-candles" zone="library" items={candles} intensity={0.9} />
      <Andons id="library-andons" zone="library" items={andons} intensity={1.6} distance={6} />
      <ShadowPlay zone="library" />
    </group>
  )
}
