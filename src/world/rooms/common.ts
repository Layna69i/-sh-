import { useEffect } from 'react'
import * as THREE from 'three'
import { M, cachedMaterial, dynamicTexture } from '../assets'
import { setColliders, removeColliders, setCircles, type Box, type Circle } from '../../player/collision'
import { genShogiBoard } from '../../textures/shogiTex'
import { makeCanvas, ctx2d, JP_FONT, LATIN_FONT } from '../../textures/util'
import { ROOMS } from '../layout'
import { drawEmblem } from '../../textures/generators'
import { Placer } from '../props/furniture'

const BOOK_COLORS = [0x5a2219, 0x22304a, 0x2f3d2a, 0x6b4f26, 0x2a2420, 0x7a6a50, 0x3d2233]
export const bookMats = () =>
  BOOK_COLORS.map((c, i) =>
    cachedMaterial(`book-${i}`, () => {
      const m = M().books.clone()
      m.color.setHex(c)
      return m
    }),
  )

export function useColliders(owner: string, boxes: Box[], circles: Circle[] = []) {
  useEffect(() => {
    setColliders(owner, boxes)
    if (circles.length) setCircles(`${owner}:c`, circles)
    return () => {
      removeColliders(owner)
      removeColliders(`${owner}:c`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner])
}

export const shogiBoardMat = () =>
  cachedMaterial('shogi-board-top', () => new THREE.MeshStandardMaterial({ map: dynamicTexture('shogi-board', () => genShogiBoard(1024)), roughness: 0.45 }))

/** Petit plateau de shogi décoratif (pièces suggérées). */
export function decorShogi(P: Placer, seed = 1, legs = true) {
  const m = M()
  const w = 0.44
  const d = 0.48
  const h = legs ? 0.12 : 0.03
  const y = legs ? 0.1 : 0
  P.box(m.woodLight, w, h, d, [0, y + h / 2, 0])
  const top = new THREE.PlaneGeometry(w, d)
  top.rotateX(-Math.PI / 2)
  P.geo(top, shogiBoardMat(), [0, y + h + 0.001, 0])
  if (legs) for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.cyl(m.woodLight, 0.035, 0.03, 0.1, 8, [sx * 0.15, 0.05, sz * 0.16])
  let s = seed * 9301 + 49297
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  const pw = 0.034
  for (let i = 0; i < 26; i++) {
    const fx = Math.floor(rnd() * 9)
    const fz = Math.floor(rnd() * 9)
    const px = -w / 2 + 0.02 + (fx + 0.5) * ((w - 0.04) / 9)
    const pz = -d / 2 + 0.02 + (fz + 0.5) * ((d - 0.04) / 9)
    P.box(m.woodLight, pw, 0.01, pw * 1.1, [px, y + h + 0.006, pz], [0, rnd() < 0.5 ? 0 : Math.PI, 0])
  }
}

/** Plan gravé de l'école (planche murale). */
export function planBoardMat() {
  return cachedMaterial('plan-board', () => {
    const tex = dynamicTexture('plan-board', () => {
      const W = 1024
      const H = 1180
      const c = makeCanvas(W, H)
      const ctx = ctx2d(c)
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#5d4630')
      g.addColorStop(1, '#3f2f21')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 0.18
      for (let i = 0; i < 180; i++) {
        ctx.strokeStyle = i % 2 ? '#2a1d12' : '#7a5c3c'
        ctx.beginPath()
        const y = Math.random() * H
        ctx.moveTo(0, y)
        ctx.bezierCurveTo(W * 0.3, y + 8, W * 0.6, y - 8, W, y + 4)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      const x0 = -31
      const x1 = 27
      const z0 = -59
      const z1 = 13
      const sx = (W - 120) / (x1 - x0)
      const sz = (H - 200) / (z1 - z0)
      const s = Math.min(sx, sz)
      const ox = (W - (x1 - x0) * s) / 2
      const oz = 130
      const X = (x: number) => ox + (x - x0) * s
      const Z = (z: number) => oz + (z - z0) * s
      ctx.fillStyle = '#d6b679'
      ctx.font = `800 54px ${JP_FONT}`
      ctx.textAlign = 'center'
      ctx.fillText('王将 · 見取図', W / 2, 72)
      for (const r of ROOMS) {
        ctx.fillStyle = r.open ? 'rgba(120,140,110,0.25)' : 'rgba(20,14,10,0.35)'
        ctx.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * s, (r.z1 - r.z0) * s)
        ctx.strokeStyle = '#1a120c'
        ctx.lineWidth = 6
        ctx.strokeRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * s, (r.z1 - r.z0) * s)
        ctx.strokeStyle = 'rgba(214,182,121,0.6)'
        ctx.lineWidth = 2
        ctx.strokeRect(X(r.x0) + 4, Z(r.z0) + 4, (r.x1 - r.x0) * s - 8, (r.z1 - r.z0) * s - 8)
        const cx = X((r.x0 + r.x1) / 2)
        const cz = Z((r.z0 + r.z1) / 2)
        ctx.fillStyle = '#e2c78f'
        ctx.font = `800 ${r.id === 'office' || r.id === 'recruitment' ? 30 : 40}px ${JP_FONT}`
        ctx.fillText(r.kanji, cx, cz)
        ctx.font = `600 ${r.id === 'office' || r.id === 'recruitment' ? 17 : 21}px ${LATIN_FONT}`
        ctx.fillStyle = '#d9caa8'
        ctx.fillText(`${r.ordinal} · ${r.short}`, cx, cz + 30)
      }
      ctx.fillStyle = 'rgba(160,40,28,0.9)'
      ctx.beginPath()
      ctx.arc(X(0), Z(-1.5), 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = `600 20px ${LATIN_FONT}`
      ctx.fillStyle = '#e2c78f'
      ctx.fillText('Grande porte', X(0), Z(4.5))
      drawEmblem(ctx, W - 90, H - 90, 50, 'rgba(214,182,121,0.8)')
      return c
    })
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })
  })
}

export const noticeSheetMats = () => [0, 1, 2, 3].map((i) => cachedMaterial(`notice-${i}`, () => {
  const tex = dynamicTexture(`notice-${i}`, () => {
    const c = makeCanvas(256, 330)
    const ctx = ctx2d(c)
    ctx.fillStyle = i % 2 ? '#d8cdb2' : '#e1d6bd'
    ctx.fillRect(0, 0, 256, 330)
    ctx.fillStyle = 'rgba(20,15,10,0.85)'
    ctx.font = `800 40px ${JP_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(['告', '令', '報', '知'][i], 128, 60)
    ctx.strokeStyle = 'rgba(30,25,20,0.6)'
    for (let l = 0; l < 9; l++) {
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(30, 100 + l * 24)
      ctx.lineTo(30 + 190 * (0.5 + 0.5 * Math.random()), 100 + l * 24)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(160,36,28,0.85)'
    ctx.fillRect(190, 280, 34, 34)
    return c
  })
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide })
}))
