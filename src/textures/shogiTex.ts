/**
 * Textures du shogi : plateau en kaya (grille 9×9, hoshi) et atlas des
 * caractères gravés des pièces (face normale à l'encre, face promue en rouge).
 */
import { Noise2 } from '../core/noise'
import { makeCanvas, ctx2d, JP_FONT } from './util'

export const BOARD = {
  w: 0.44,
  d: 0.48,
  margin: 0.02,
  get sqW() {
    return (this.w - 2 * this.margin) / 9
  },
  get sqD() {
    return (this.d - 2 * this.margin) / 9
  },
}

export function genShogiBoard(size = 1024) {
  const W = size
  const H = Math.round(size * (BOARD.d / BOARD.w))
  const c = makeCanvas(W, H)
  const ctx = ctx2d(c)
  const n = new Noise2(303)
  const img = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const g = n.fbm((x / W) * 3, (y / H) * 40, 3)
      const rings = 0.5 + 0.5 * Math.sin((y / H) * 90 + g * 6)
      const k = 0.86 + 0.08 * rings + 0.06 * g
      const i = (y * W + x) * 4
      img.data[i] = 205 * k
      img.data[i + 1] = 152 * k
      img.data[i + 2] = 82 * k
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  const mx = (BOARD.margin / BOARD.w) * W
  const my = (BOARD.margin / BOARD.d) * H
  const gw = W - 2 * mx
  const gh = H - 2 * my
  ctx.strokeStyle = 'rgba(20,12,6,0.92)'
  ctx.lineWidth = Math.max(2, W / 380)
  for (let i = 0; i <= 9; i++) {
    ctx.beginPath()
    ctx.moveTo(mx + (i * gw) / 9, my)
    ctx.lineTo(mx + (i * gw) / 9, my + gh)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(mx, my + (i * gh) / 9)
    ctx.lineTo(mx + gw, my + (i * gh) / 9)
    ctx.stroke()
  }
  ctx.lineWidth = Math.max(3, W / 200)
  ctx.strokeRect(mx, my, gw, gh)
  ctx.fillStyle = 'rgba(20,12,6,0.95)'
  for (const [i, j] of [
    [3, 3],
    [6, 3],
    [3, 6],
    [6, 6],
  ]) {
    ctx.beginPath()
    ctx.arc(mx + (i * gw) / 9, my + (j * gh) / 9, W / 130, 0, Math.PI * 2)
    ctx.fill()
  }
  return c
}

export const PIECE_GLYPHS = ['王将', '玉将', '飛車', '角行', '金将', '銀将', '桂馬', '香車', '歩兵', '龍王', '龍馬', '成銀', '成桂', '成香', 'と', '']
export const ATLAS_COLS = 8
export const ATLAS_ROWS = 2

export function genPieceAtlas() {
  const cw = 128
  const ch = 192
  const c = makeCanvas(cw * ATLAS_COLS, ch * ATLAS_ROWS)
  const ctx = ctx2d(c)
  ctx.clearRect(0, 0, c.width, c.height)
  PIECE_GLYPHS.forEach((txt, idx) => {
    if (!txt) return
    const cx = (idx % ATLAS_COLS) * cw + cw / 2
    const cy = Math.floor(idx / ATLAS_COLS) * ch
    const promoted = idx >= 9
    ctx.fillStyle = promoted ? '#a01f16' : '#120c08'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const chars = [...txt]
    if (chars.length === 1) {
      ctx.font = `800 ${cw * 0.78}px ${JP_FONT}`
      ctx.fillText(chars[0], cx, cy + ch * 0.6)
    } else {
      ctx.font = `800 ${cw * 0.56}px ${JP_FONT}`
      ctx.fillText(chars[0], cx, cy + ch * 0.45)
      ctx.fillText(chars[1], cx, cy + ch * 0.77)
    }
  })
  return c
}
