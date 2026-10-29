/**
 * Textures procédurales (bois, tatami, enduit, papier, pierre, tuiles, sol…).
 * Toutes sont générées dans le navigateur : aucune ressource externe n'est requise.
 * Les textures « raccordables » utilisent un bruit périodique.
 */
import { Noise2 } from '../core/noise'
import { rng, clamp, smoothstep, lerp } from '../core/math'
import { EMBLEM_PATH } from '../core/emblem'
import { makeCanvas, ctx2d, normalFromHeight, grayToCanvas, JP_FONT, LATIN_FONT } from './util'

type RGB = [number, number, number]
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]

export interface GenResult {
  map: HTMLCanvasElement
  normal?: HTMLCanvasElement
  rough?: HTMLCanvasElement
  emissive?: HTMLCanvasElement
}

function writeRGB(d: Uint8ClampedArray, i: number, c: RGB, a = 1) {
  d[i] = clamp(c[0]) * 255
  d[i + 1] = clamp(c[1]) * 255
  d[i + 2] = clamp(c[2]) * 255
  d[i + 3] = a * 255
}

/* ------------------------------------------------------------------ */
/* Bois                                                                 */
/* ------------------------------------------------------------------ */

/** Plancher de lames (2 m × 2 m), lames dans le sens v. */
export function genPlanks(size = 1024, seed = 11, dark = 0x3d2b1d, light = 0x75573b): GenResult {
  const n = new Noise2(seed)
  const r = rng(seed)
  const W = size
  const H = size
  const planks = 10
  const pw = W / planks
  const seams: number[][] = []
  const tones: number[][] = []
  for (let c = 0; c < planks; c++) {
    const k = 1 + (r() < 0.55 ? 1 : 0)
    const s = Array.from({ length: k }, () => r()).sort()
    seams.push(s)
    tones.push(s.map(() => r()))
  }
  const cD = hex(dark)
  const cL = hex(light)
  const map = makeCanvas(W, H)
  const ctx = ctx2d(map)
  const img = ctx.createImageData(W, H)
  const hm = new Float32Array(W * H)
  const rough = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    const v = y / H
    for (let x = 0; x < W; x++) {
      const col = Math.floor(x / pw)
      const lx = (x - col * pw) / pw
      const s = seams[col]
      let idx = 0
      let dv = 1
      for (let k = 0; k < s.length; k++) {
        if (v >= s[k]) idx = k + 1
        const dd = Math.min(Math.abs(v - s[k]), 1 - Math.abs(v - s[k]))
        if (dd < dv) dv = dd
      }
      const tone = tones[col][idx % s.length]
      const g = n.fbm((x / W) * 30 + col * 7.3, (y / H) * 2, 3, 30, 2)
      const fiber = n.noise((x / W) * 220, (y / H) * 6, 220, 6)
      const streak = 0.5 + 0.5 * Math.sin((lx * 6 + g * 3.5 + tone * 10) * Math.PI * 2)
      const edge = smoothstep(0, 0.018, lx) * smoothstep(0, 0.018, 1 - lx) * smoothstep(0, 0.0035, dv)
      const t = clamp(tone * 0.6 + 0.4 * (g * 0.5 + 0.5))
      let c = mix(cD, cL, t)
      const k = (0.86 + 0.14 * streak) * (0.92 + 0.08 * fiber) * (0.35 + 0.65 * edge)
      c = [c[0] * k, c[1] * k, c[2] * k]
      const i = y * W + x
      writeRGB(img.data, i * 4, c)
      hm[i] = edge * (0.85 + 0.08 * streak + 0.07 * fiber)
      rough[i] = 0.38 + 0.25 * (1 - edge) + 0.12 * (fiber * 0.5 + 0.5) + 0.08 * (1 - streak)
    }
  }
  ctx.putImageData(img, 0, 0)
  return { map, normal: normalFromHeight(hm, W, H, 3), rough: grayToCanvas(rough, W, H) }
}

/** Fil du bois neutre (1 m), teinté ensuite par la couleur du matériau. */
export function genGrain(size = 512, seed = 21): GenResult {
  const n = new Noise2(seed)
  const W = size
  const map = makeCanvas(W, W)
  const ctx = ctx2d(map)
  const img = ctx.createImageData(W, W)
  const hm = new Float32Array(W * W)
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const g = n.fbm((x / W) * 8, (y / W) * 1, 4, 8, 1)
      const rings = 0.5 + 0.5 * Math.sin(((x / W) * 26 + g * 5) * Math.PI * 2)
      const fiber = n.noise((x / W) * 160, (y / W) * 4, 160, 4)
      const v = 0.62 + 0.2 * rings + 0.1 * g + 0.06 * fiber
      const i = y * W + x
      writeRGB(img.data, i * 4, [v * 1.0, v * 0.93, v * 0.84])
      hm[i] = rings * 0.4 + fiber * 0.3
    }
  }
  ctx.putImageData(img, 0, 0)
  return { map, normal: normalFromHeight(hm, W, W, 1.2) }
}

/* ------------------------------------------------------------------ */
/* Tatami (motif en vannerie, 3,6 m)                                    */
/* ------------------------------------------------------------------ */
export function genTatami(size = 1024, seed = 31): GenResult {
  const n = new Noise2(seed)
  const W = size
  const map = makeCanvas(W, W)
  const ctx = ctx2d(map)
  const img = ctx.createImageData(W, W)
  const hm = new Float32Array(W * W)
  const straw: RGB = hex(0x7f7550)
  const strawL: RGB = hex(0x958a5e)
  const heri: RGB = hex(0x1a1f1b)
  const mPerPx = 3.6 / W
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const mx = x * mPerPx
      const my = y * mPerPx
      const bx = Math.floor(mx / 1.8)
      const by = Math.floor(my / 1.8)
      const vertical = (bx + by) % 2 === 0
      const lx = mx - bx * 1.8
      const ly = my - by * 1.8
      // dans le bloc 1,8 × 1,8 : deux tatamis 0,9 × 1,8
      const across = vertical ? lx : ly // dimension courte
      const along = vertical ? ly : lx // dimension longue
      const local = across % 0.9
      const matId = Math.floor(across / 0.9) + bx * 3 + by * 5
      const weave = 0.5 + 0.5 * Math.sin((along / 0.0125) * Math.PI * 2)
      const fiber = n.noise((x / W) * 300, (y / W) * 300, 300, 300)
      const patch = n.fbm((x / W) * 6, (y / W) * 6, 3, 6, 6)
      const shade = 0.88 + 0.12 * Math.sin(matId * 12.9898)
      let c = mix(straw, strawL, clamp(0.5 + patch * 0.6 + fiber * 0.1))
      c = [c[0] * shade * (0.9 + 0.1 * weave), c[1] * shade * (0.9 + 0.1 * weave), c[2] * shade * (0.88 + 0.1 * weave)]
      let h = 0.7 + 0.25 * weave + 0.05 * fiber
      const distLong = Math.min(local, 0.9 - local)
      if (distLong < 0.032) {
        const pattern = 0.85 + 0.15 * Math.sin((along / 0.02) * Math.PI * 2)
        c = [heri[0] * pattern, heri[1] * pattern, heri[2] * pattern]
        h = 0.75
      }
      const seamA = Math.min(along % 1.8, 1.8 - (along % 1.8))
      if (distLong < 0.004 || seamA < 0.004) {
        c = [c[0] * 0.35, c[1] * 0.35, c[2] * 0.35]
        h = 0.2
      }
      const i = y * W + x
      writeRGB(img.data, i * 4, c)
      hm[i] = h
    }
  }
  ctx.putImageData(img, 0, 0)
  return { map, normal: normalFromHeight(hm, W, W, 2.2) }
}

/* ------------------------------------------------------------------ */
/* Enduits, papier, tissus                                              */
/* ------------------------------------------------------------------ */
export function genPlaster(size = 512, seed = 41, base = 0xd2c7ad): GenResult {
  const n = new Noise2(seed)
  const W = size
  const c0 = hex(base)
  const map = makeCanvas(W, W)
  const ctx = ctx2d(map)
  const img = ctx.createImageData(W, W)
  const hm = new Float32Array(W * W)
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const blot = n.fbm((x / W) * 4, (y / W) * 4, 4, 4, 4)
      const grain = n.noise((x / W) * 180, (y / W) * 180, 180, 180)
      const k = 0.9 + 0.08 * blot + 0.03 * grain
      const i = y * W + x
      writeRGB(img.data, i * 4, [c0[0] * k, c0[1] * k * 0.995, c0[2] * k * 0.985])
      hm[i] = blot * 0.3 + grain * 0.2
    }
  }
  ctx.putImageData(img, 0, 0)
  return { map, normal: normalFromHeight(hm, W, W, 1.5) }
}

export function genFabric(size = 256, seed = 51): GenResult {
  const n = new Noise2(seed)
  const W = size
  const map = makeCanvas(W, W)
  const ctx = ctx2d(map)
  const img = ctx.createImageData(W, W)
  const hm = new Float32Array(W * W)
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const warp = 0.5 + 0.5 * Math.sin((x / W) * 64 * Math.PI * 2)
      const weft = 0.5 + 0.5 * Math.sin((y / W) * 64 * Math.PI * 2)
      const cell = (Math.floor((x / W) * 64) + Math.floor((y / W) * 64)) % 2 === 0
      const w = cell ? warp : weft
      const nn = n.noise((x / W) * 16, (y / W) * 16, 16, 16)
      const v = 0.78 + 0.14 * w + 0.06 * nn
      const i = y * W + x
      writeRGB(img.data, i * 4, [v, v, v])
      hm[i] = w
    }
  }
  ctx.putImageData(img, 0, 0)
  return { map, normal: normalFromHeight(hm, W, W, 1.4) }
}

/** Panneau shoji : treillis (kumiko) + papier ; carte émissive = papier seul. */
export function genShoji(cols = 3, rows = 6, w = 256, h = 512, koshi = 0.16, seed = 61): GenResult {
  const n = new Noise2(seed)
  const map = makeCanvas(w, h)
  const ctx = ctx2d(map)
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const f = n.fbm((x / w) * 6, (y / h) * 12, 3, 6, 12)
      const fib = n.noise((x / w) * 90, (y / h) * 30, 90, 30)
      const v = 0.9 + 0.05 * f + 0.03 * fib
      writeRGB(img.data, (y * w + x) * 4, [v * 0.93, v * 0.9, v * 0.8])
    }
  }
  ctx.putImageData(img, 0, 0)
  const em = makeCanvas(w, h)
  const ectx = ctx2d(em)
  ectx.fillStyle = '#fff'
  ectx.fillRect(0, 0, w, h)
  const bar = Math.max(3, Math.round(w * 0.022))
  const paperH = h * (1 - koshi)
  ctx.fillStyle = '#2b2018'
  ectx.fillStyle = '#000'
  for (let i = 1; i < cols; i++) {
    const x = Math.round((i * w) / cols - bar / 2)
    ctx.fillRect(x, 0, bar, paperH)
    ectx.fillRect(x, 0, bar, paperH)
  }
  for (let j = 1; j < rows; j++) {
    const y = Math.round((j * paperH) / rows - bar / 2)
    ctx.fillRect(0, y, w, bar)
    ectx.fillRect(0, y, w, bar)
  }
  if (koshi > 0) {
    const g = ctx.createLinearGradient(0, paperH, 0, h)
    g.addColorStop(0, '#3a2a1e')
    g.addColorStop(1, '#2a1e15')
    ctx.fillStyle = g
    ctx.fillRect(0, paperH, w, h - paperH)
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    for (let i = 0; i < 18; i++) {
      ctx.beginPath()
      const yy = paperH + ((h - paperH) * i) / 18
      ctx.moveTo(0, yy)
      ctx.bezierCurveTo(w * 0.3, yy + 2, w * 0.6, yy - 2, w, yy + 1)
      ctx.stroke()
    }
    ectx.fillRect(0, paperH, w, h - paperH)
    ctx.fillStyle = '#20170f'
    ctx.fillRect(0, paperH - bar, w, bar * 1.6)
    ectx.fillRect(0, paperH - bar, w, bar * 1.6)
  }
  // relief : baguettes du kumiko en saillie, fibres du washi en très léger grain
  const mask = ectx.getImageData(0, 0, w, h).data
  const hm = new Float32Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      hm[i] = (1 - mask[i * 4] / 255) * 0.9 + n.noise((x / w) * 140, (y / h) * 50, 140, 50) * 0.05
    }
  return { map, emissive: em, normal: normalFromHeight(hm, w, h, 3) }
}

/* ------------------------------------------------------------------ */
/* Peintures à l'encre (fusuma, paravents, kakejiku)                    */
/* ------------------------------------------------------------------ */

export interface InkOpts {
  seed?: number
  paper?: string
  gold?: boolean
  deer?: boolean
  moon?: boolean
  pine?: boolean
  layers?: number
}

export function paintPaper(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, seed: number) {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
  const r = rng(seed)
  ctx.globalAlpha = 0.05
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = r() < 0.5 ? '#6b5a3c' : '#fffaf0'
    ctx.beginPath()
    ctx.ellipse(r() * w, r() * h, 2 + r() * 60, 2 + r() * 40, r() * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

export function drawDeer(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, flip = false) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(flip ? -s : s, s)
  ctx.beginPath()
  // corps
  ctx.ellipse(0, 0, 40, 17, -0.05, 0, Math.PI * 2)
  ctx.fill()
  // cou + tête
  ctx.beginPath()
  ctx.moveTo(26, -8)
  ctx.quadraticCurveTo(38, -30, 44, -52)
  ctx.lineTo(56, -50)
  ctx.lineTo(68, -44)
  ctx.lineTo(66, -38)
  ctx.lineTo(52, -38)
  ctx.quadraticCurveTo(46, -18, 38, 4)
  ctx.closePath()
  ctx.fill()
  // pattes
  ctx.lineWidth = 4.5
  ctx.lineCap = 'round'
  for (const lx of [-30, -22, 22, 30]) {
    ctx.beginPath()
    ctx.moveTo(lx, 8)
    ctx.lineTo(lx + (lx > 0 ? 3 : -2), 34)
    ctx.lineTo(lx + (lx > 0 ? 1 : -3), 52)
    ctx.stroke()
  }
  // bois (andouillers)
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(50, -52)
  ctx.quadraticCurveTo(46, -76, 34, -90)
  ctx.moveTo(47, -68)
  ctx.lineTo(56, -82)
  ctx.moveTo(41, -80)
  ctx.lineTo(44, -96)
  ctx.moveTo(54, -51)
  ctx.quadraticCurveTo(62, -74, 76, -84)
  ctx.moveTo(60, -66)
  ctx.lineTo(70, -66)
  ctx.stroke()
  // queue
  ctx.beginPath()
  ctx.ellipse(-41, -6, 5, 3, 0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawInkLandscape(ctx: CanvasRenderingContext2D, w: number, h: number, o: InkOpts = {}) {
  const seed = o.seed ?? 1
  const r = rng(seed)
  const n = new Noise2(seed)
  paintPaper(ctx, w, h, o.paper ?? '#d4c8a8', seed)
  if (o.moon) {
    ctx.fillStyle = 'rgba(160,40,30,0.75)'
    ctx.beginPath()
    ctx.arc(w * (0.62 + r() * 0.2), h * 0.18, w * 0.07, 0, Math.PI * 2)
    ctx.fill()
  }
  if (o.gold) {
    for (let i = 0; i < 6; i++) {
      const gx = r() * w
      const gy = h * (0.15 + r() * 0.5)
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, w * 0.25)
      g.addColorStop(0, 'rgba(196,160,90,0.45)')
      g.addColorStop(1, 'rgba(196,160,90,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(gx, gy, w * 0.3, h * 0.04, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const layers = o.layers ?? 4
  for (let L = 0; L < layers; L++) {
    const depth = L / (layers - 1 || 1)
    const baseY = h * (0.42 + depth * 0.32)
    const amp = h * (0.22 - depth * 0.08)
    const alpha = 0.28 + depth * 0.5
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let x = 0; x <= w; x += 4) {
      const t = x / w
      const ridge = 1 - Math.abs(n.fbm(t * 3 + L * 11, L * 3.3, 4))
      const y = baseY - amp * Math.pow(ridge, 2.2) - amp * 0.3 * n.noise(t * 9 + L, L)
      ctx.lineTo(x, y)
    }
    ctx.lineTo(w, h)
    ctx.closePath()
    const g = ctx.createLinearGradient(0, baseY - amp, 0, baseY + h * 0.2)
    g.addColorStop(0, `rgba(22,22,24,${alpha})`)
    g.addColorStop(0.55, `rgba(22,22,24,${alpha * 0.35})`)
    g.addColorStop(1, 'rgba(22,22,24,0)')
    ctx.fillStyle = g
    ctx.fill()
  }
  if (o.pine) {
    ctx.strokeStyle = 'rgba(18,18,20,0.92)'
    ctx.fillStyle = 'rgba(18,18,20,0.85)'
    const bx = w * (0.05 + r() * 0.15)
    ctx.lineWidth = w * 0.022
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(bx, h)
    ctx.bezierCurveTo(bx + w * 0.1, h * 0.75, bx - w * 0.05, h * 0.55, bx + w * 0.12, h * 0.35)
    ctx.stroke()
    for (let i = 0; i < 6; i++) {
      const py = h * (0.36 + i * 0.09)
      const px = bx + w * 0.05 + Math.sin(i * 1.7) * w * 0.04
      ctx.lineWidth = w * 0.008
      ctx.beginPath()
      ctx.moveTo(px, py)
      const ex = px + w * (0.12 + r() * 0.18) * (i % 2 ? 1 : 0.7)
      ctx.quadraticCurveTo((px + ex) / 2, py - h * 0.03, ex, py - h * 0.01)
      ctx.stroke()
      for (let k = 0; k < 5; k++) {
        ctx.beginPath()
        ctx.ellipse(lerp(px, ex, 0.4 + k * 0.14), py - h * 0.02, w * 0.04, h * 0.012, -0.1, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  if (o.deer) {
    ctx.fillStyle = 'rgba(20,20,22,0.9)'
    ctx.strokeStyle = 'rgba(20,20,22,0.9)'
    drawDeer(ctx, w * (0.55 + r() * 0.2), h * 0.8, w / 520, r() < 0.5)
  }
}

export function genInkPanel(w: number, h: number, o: InkOpts): GenResult {
  const c = makeCanvas(w, h)
  drawInkLandscape(ctx2d(c), w, h, o)
  return { map: c }
}

/** Fusuma : peinture + poignée (hikite). */
export function genFusuma(seed = 71): GenResult {
  const w = 256
  const h = 512
  const c = makeCanvas(w, h)
  const ctx = ctx2d(c)
  drawInkLandscape(ctx, w, h, { seed, gold: true, pine: seed % 2 === 0, layers: 4, paper: '#cdbf9d' })
  ctx.fillStyle = '#17120e'
  ctx.beginPath()
  ctx.ellipse(w * 0.86, h * 0.5, w * 0.035, h * 0.03, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#8c6c3a'
  ctx.lineWidth = 2
  ctx.stroke()
  return { map: c }
}

/** Panneau peint du hall : silhouette de shinobi, éclaboussures d'encre, branches fleuries. */
export function genShadowPanel(seed = 81, w = 256, h = 640): GenResult {
  const c = makeCanvas(w, h)
  const ctx = ctx2d(c)
  const r = rng(seed)
  paintPaper(ctx, w, h, '#c9bc9b', seed)
  // éclaboussures
  for (let i = 0; i < 9; i++) {
    const x = r() * w
    const y = r() * h
    const s = 10 + r() * 60
    ctx.fillStyle = `rgba(16,16,18,${0.15 + r() * 0.5})`
    for (let k = 0; k < 18; k++) {
      ctx.beginPath()
      ctx.ellipse(x + (r() - 0.5) * s * 2, y + (r() - 0.5) * s, s * (0.1 + r() * 0.4), s * (0.05 + r() * 0.2), r() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // branche fleurie
  ctx.strokeStyle = 'rgba(15,15,17,0.9)'
  ctx.lineCap = 'round'
  const sx = r() < 0.5 ? 0 : w
  let x = sx
  let y = h * (0.05 + r() * 0.15)
  for (let i = 0; i < 7; i++) {
    const nx = x + (sx === 0 ? 1 : -1) * (15 + r() * 30)
    const ny = y + (r() - 0.3) * 40
    ctx.lineWidth = 7 - i * 0.8
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(nx, ny)
    ctx.stroke()
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(214,190,190,0.9)' : 'rgba(170,70,70,0.75)'
      ctx.beginPath()
      ctx.arc(nx + (r() - 0.5) * 24, ny + (r() - 0.5) * 24, 2 + r() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    x = nx
    y = ny
  }
  // silhouette
  ctx.fillStyle = 'rgba(12,12,14,0.94)'
  const cx = w * (0.4 + r() * 0.2)
  const base = h * 0.94
  const H = h * (0.52 + r() * 0.1)
  const top = base - H
  ctx.beginPath()
  // chapeau conique (kasa)
  ctx.moveTo(cx - H * 0.2, top + H * 0.1)
  ctx.lineTo(cx, top)
  ctx.lineTo(cx + H * 0.2, top + H * 0.1)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(cx, top + H * 0.13, H * 0.055, H * 0.06, 0, 0, Math.PI * 2)
  ctx.fill()
  // cape
  ctx.beginPath()
  ctx.moveTo(cx - H * 0.08, top + H * 0.17)
  ctx.quadraticCurveTo(cx - H * 0.24, top + H * 0.45, cx - H * 0.2, top + H * 0.72)
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    ctx.lineTo(cx - H * 0.2 + t * H * 0.42, top + H * (0.72 + (i % 2) * 0.03))
  }
  ctx.quadraticCurveTo(cx + H * 0.22, top + H * 0.42, cx + H * 0.08, top + H * 0.17)
  ctx.closePath()
  ctx.fill()
  // jambes
  ctx.fillRect(cx - H * 0.09, top + H * 0.7, H * 0.06, H * 0.3)
  ctx.fillRect(cx + H * 0.03, top + H * 0.7, H * 0.06, H * 0.3)
  // sabre
  ctx.strokeStyle = 'rgba(12,12,14,0.94)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(cx + H * 0.05, top + H * 0.25)
  ctx.lineTo(cx - H * 0.3, top + H * 0.08)
  ctx.stroke()
  return { map: c }
}

/* ------------------------------------------------------------------ */
/* Pierre, tuiles, sol, écorce, gravier                                 */
/* ------------------------------------------------------------------ */

function worleyCells(cx: number, cy: number, seed: number) {
  const r = rng(seed)
  const pts = new Float32Array(cx * cy * 2)
  for (let i = 0; i < cx * cy; i++) {
    pts[i * 2] = 0.15 + r() * 0.7
    pts[i * 2 + 1] = 0.15 + r() * 0.7
  }
  return (u: number, v: number) => {
    const gx = u * cx
    const gy = v * cy
    const ix = Math.floor(gx)
    const iy = Math.floor(gy)
    let f1 = 9
    let f2 = 9
    let id = 0
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const cxx = ((ix + ox) % cx + cx) % cx
        const cyy = ((iy + oy) % cy + cy) % cy
        const k = cyy * cx + cxx
        const px = ix + ox + pts[k * 2]
        const py = iy + oy + pts[k * 2 + 1]
        const d = Math.hypot(px - gx, (py - gy) * 1.0)
        if (d < f1) {
          f2 = f1
          f1 = d
          id = k
        } else if (d < f2) f2 = d
      }
    }
    return { f1, f2, id }
  }
}

/** Appareil de pierres (ishigaki), 3 m. */
export function genStoneBlocks(size = 512, seed = 91, tint = 0x57524b): GenResult {
  const n = new Noise2(seed)
  const wl = worleyCells(6, 8, seed)
  const W = size
  const base = hex(tint)
  const map = makeCanvas(W, W)
  const ctx = ctx2d(map)
  const img = ctx.createImageData(W, W)
  const hm = new Float32Array(W * W)
  const rough = new Float32Array(W * W)
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W
      const v = y / W
      const ww = n.fbm(u * 8, v * 8, 2, 8, 8) * 0.025
      const { f1, f2, id } = wl(u + ww, v + ww)
      const edge = f2 - f1
      const shade = 0.72 + 0.4 * ((Math.sin(id * 78.233) * 43758.5453) % 1 + 1) % 1 * 0.6
      const det = n.fbm(u * 24, v * 24, 3, 24, 24)
      const moss = smoothstep(0.15, 0.5, n.fbm(u * 5 + 3, v * 5, 3, 5, 5)) * 0.6
      const gap = smoothstep(0.02, 0.09, edge)
      let c: RGB = [base[0] * shade, base[1] * shade, base[2] * shade]
      c = mix(c, [0.2, 0.25, 0.16], moss * 0.5)
      const k = (0.85 + 0.15 * det) * (0.18 + 0.82 * gap)
      const i = y * W + x
      writeRGB(img.data, i * 4, [c[0] * k, c[1] * k, c[2] * k])
      hm[i] = gap * (0.7 + 0.3 * Math.sqrt(clamp(edge * 4))) + det * 0.08
      rough[i] = 0.75 + 0.2 * (1 - gap) - moss * 0.1
    }
  }
  ctx.putImageData(img, 0, 0)
  return { map, normal: normalFromHeight(hm, W, W, 4), rough: grayToCanvas(rough, W, W) }
}

/** Dalle de pierre (sol du hall, lanternes, chemin). */
export function genStoneSurface(size = 512, seed = 95, tint = 0x5c5a56): GenResult {
  const n = new Noise2(seed)
  const W = size
  const base = hex(tint)
  const map = makeCanvas(W, W)
  const ctx = ctx2d(map)
  const img = ctx.createImageData(W, W)
  const hm = new Float32Array(W * W)
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W
      const v = y / W
      const a = n.fbm(u * 4, v * 4, 4, 4, 4)
      const b = n.fbm(u * 32, v * 32, 2, 32, 32)
      const speck = n.noise(u * 200, v * 200, 200, 200)
      const k = 0.82 + 0.16 * a + 0.06 * b + 0.05 * speck
      const i = y * W + x
      writeRGB(img.data, i * 4, [base[0] * k, base[1] * k, base[2] * k])
      hm[i] = a * 0.4 + b * 0.4 + speck * 0.2
    }
  }
  ctx.putImageData(img, 0, 0)
  return { map, normal: normalFromHeight(hm, W, W, 2.5) }
}

/** Tuiles de toiture (hongawara), 1,2 m. */
export function genRoofTiles(size = 512, seed = 101): GenResult {
  const n = new Noise2(seed)
  const W = size
  const cols = 5
  const rows = 4
  const map = makeCanvas(W, W)
  const ctx = ctx2d(map)
  const img = ctx.createImageData(W, W)
  const hm = new Float32Array(W * W)
  const rough = new Float32Array(W * W)
  const c0: RGB = hex(0x2f3338)
  const c1: RGB = hex(0x4a4f55)
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W
      const v = 1 - y / W
      const cu = u * cols
      const fu = cu - Math.floor(cu)
      const fv = (v * rows) % 1
      const tileId = Math.floor(cu) * 31 + Math.floor(v * rows) * 17
      // rangée bombée (marugawara) centrée sur fu = 0.5
      const round = Math.pow(Math.max(0, Math.sin(fu * Math.PI)), 0.55)
      const step = smoothstep(0, 0.06, fv) * (0.75 + 0.25 * fv)
      const age = n.fbm(u * 6, v * 6, 3, 6, 6)
      const lich = smoothstep(0.2, 0.55, n.fbm(u * 10 + 9, v * 10, 3, 10, 10))
      const var1 = (Math.sin(tileId * 12.9898) * 43758.5453) % 1
      let c = mix(c0, c1, clamp(round * 0.6 + age * 0.3 + Math.abs(var1) * 0.2))
      c = mix(c, [0.36, 0.38, 0.3], lich * 0.35)
      const k = 0.35 + 0.65 * step
      const i = y * W + x
      writeRGB(img.data, i * 4, [c[0] * k, c[1] * k, c[2] * k])
      hm[i] = round * 0.8 + step * 0.3 + age * 0.05
      rough[i] = 0.55 + 0.25 * lich + 0.1 * (1 - round)
    }
  }
  ctx.putImageData(img, 0, 0)
  return { map, normal: normalFromHeight(hm, W, W, 5), rough: grayToCanvas(rough, W, W) }
}

/** Sol forestier : terre, mousse, aiguilles (10 m). */
export function genForestGround(size = 1024, seed = 111): GenResult {
  const n = new Noise2(seed)
  const W = size
  const soil: RGB = hex(0x2a2219)
  const moss: RGB = hex(0x2f3d27)
  const mossL: RGB = hex(0x46552f)
  const needles: RGB = hex(0x4a2e1c)
  const map = makeCanvas(W, W)
  const ctx = ctx2d(map)
  const img = ctx.createImageData(W, W)
  const hm = new Float32Array(W * W)
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W
      const v = y / W
      const m = n.fbm(u * 5, v * 5, 4, 5, 5)
      const nd = n.fbm(u * 11 + 5, v * 11, 3, 11, 11)
      const det = n.noise(u * 140, v * 140, 140, 140)
      const det2 = n.noise(u * 380, v * 60, 380, 60)
      let c = soil
      c = mix(c, needles, smoothstep(0.0, 0.35, nd) * 0.85)
      const mm = smoothstep(-0.05, 0.22, m)
      c = mix(c, mix(moss, mossL, smoothstep(0.2, 0.5, m)), mm)
      const k = 0.8 + 0.12 * det + 0.08 * det2
      const i = y * W + x
      writeRGB(img.data, i * 4, [c[0] * k, c[1] * k, c[2] * k])
      hm[i] = m * 0.5 + det * 0.3 + det2 * 0.15 + mm * 0.4
    }
  }
  ctx.putImageData(img, 0, 0)
  return { map, normal: normalFromHeight(hm, W, W, 2) }
}

/** Écorce de cèdre (fibres verticales). */
export function genBark(w = 256, h = 512, seed = 121): GenResult {
  const n = new Noise2(seed)
  const map = makeCanvas(w, h)
  const ctx = ctx2d(map)
  const img = ctx.createImageData(w, h)
  const hm = new Float32Array(w * h)
  const c0: RGB = hex(0x2c1e18)
  const c1: RGB = hex(0x5a3f31)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const v = y / h
      const f = n.fbm(u * 18, v * 2, 4, 18, 2)
      const ridges = 1 - Math.abs(n.noise(u * 26 + f * 2, v * 3, 26, 3))
      const k = smoothstep(0.3, 1, ridges)
      const c = mix(c0, c1, clamp(k * 0.8 + f * 0.3))
      const i = y * w + x
      writeRGB(img.data, i * 4, c)
      hm[i] = k * 0.8 + f * 0.2
    }
  }
  ctx.putImageData(img, 0, 0)
  return { map, normal: normalFromHeight(hm, w, h, 4) }
}

/** Gravier ratissé du jardin sec (4 m). */
export function genGravel(size = 1024, seed = 131): GenResult {
  const n = new Noise2(seed)
  const W = size
  const map = makeCanvas(W, W)
  const ctx = ctx2d(map)
  const img = ctx.createImageData(W, W)
  const hm = new Float32Array(W * W)
  const c0: RGB = hex(0x8f8a80)
  const c1: RGB = hex(0xb4ae9f)
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W
      const v = y / W
      const w = n.fbm(u * 3, v * 3, 2, 3, 3) * 0.02
      const rake = 0.5 + 0.5 * Math.cos((v + w) * 50 * Math.PI * 2)
      const peb = n.noise(u * 420, v * 420, 420, 420)
      const peb2 = n.noise(u * 170 + 3, v * 170, 170, 170)
      const k = 0.78 + 0.12 * rake + 0.1 * peb + 0.06 * peb2
      const c = mix(c0, c1, clamp(0.5 + peb * 0.5))
      const i = y * W + x
      writeRGB(img.data, i * 4, [c[0] * k, c[1] * k, c[2] * k])
      hm[i] = rake * 0.7 + peb * 0.2 + peb2 * 0.1
    }
  }
  ctx.putImageData(img, 0, 0)
  return { map, normal: normalFromHeight(hm, W, W, 3) }
}

/** Normales d'eau raccordables. */
export function genWaterNormal(size = 256, seed = 141): GenResult {
  const n = new Noise2(seed)
  const W = size
  const hm = new Float32Array(W * W)
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) hm[y * W + x] = n.fbm((x / W) * 6, (y / W) * 6, 4, 6, 6)
  return { map: normalFromHeight(hm, W, W, 6) }
}

/** Masque de bruit gris raccordable (brume, variations). */
export function genNoiseMask(size = 256, seed = 151): GenResult {
  const n = new Noise2(seed)
  const W = size
  const g = new Float32Array(W * W)
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) g[y * W + x] = clamp(0.5 + 0.6 * n.fbm((x / W) * 4, (y / W) * 4, 5, 4, 4))
  return { map: grayToCanvas(g, W, W) }
}

/* ------------------------------------------------------------------ */
/* Cartes alpha : fougère, feuille d'érable, emblème                    */
/* ------------------------------------------------------------------ */
export function genFern(seed = 161): GenResult {
  const W = 256
  const c = makeCanvas(W, W)
  const ctx = ctx2d(c)
  const r = rng(seed)
  ctx.clearRect(0, 0, W, W)
  ctx.lineCap = 'round'
  for (let f = 0; f < 7; f++) {
    const ang = -1.15 + (f / 6) * 2.3 + (r() - 0.5) * 0.2
    const len = W * (0.75 + r() * 0.2)
    const sx = W / 2
    const sy = W
    const ex = sx + Math.sin(ang) * len
    const ey = sy - Math.cos(ang) * len * 0.95
    const cx = sx + Math.sin(ang) * len * 0.4
    const cy = sy - len * 0.75
    const g = 70 + Math.floor(r() * 40)
    ctx.strokeStyle = `rgb(${g * 0.55},${g},${g * 0.5})`
    ctx.fillStyle = `rgb(${g * 0.6},${g * 1.05},${g * 0.5})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.quadraticCurveTo(cx, cy, ex, ey)
    ctx.stroke()
    for (let t = 0.12; t < 0.98; t += 0.055) {
      const it = 1 - t
      const px = it * it * sx + 2 * it * t * cx + t * t * ex
      const py = it * it * sy + 2 * it * t * cy + t * t * ey
      const tx = 2 * it * (cx - sx) + 2 * t * (ex - cx)
      const ty = 2 * it * (cy - sy) + 2 * t * (ey - cy)
      const tl = Math.hypot(tx, ty)
      const nx = -ty / tl
      const ny = tx / tl
      const L = W * 0.12 * Math.sin(Math.PI * Math.min(1, t * 1.1)) * (1 - t * 0.5)
      for (const s of [-1, 1]) {
        ctx.beginPath()
        const lx = px + nx * L * s + (tx / tl) * L * 0.35
        const ly = py + ny * L * s + (ty / tl) * L * 0.35
        ctx.moveTo(px, py)
        ctx.quadraticCurveTo(px + nx * L * 0.5 * s - ny * 3, py + ny * L * 0.5 * s + nx * 3, lx, ly)
        ctx.quadraticCurveTo(px + nx * L * 0.5 * s + ny * 3, py + ny * L * 0.5 * s - nx * 3, px, py)
        ctx.fill()
      }
    }
  }
  return { map: c }
}

export function genMapleLeaf(): GenResult {
  const W = 128
  const c = makeCanvas(W, W)
  const ctx = ctx2d(c)
  ctx.clearRect(0, 0, W, W)
  ctx.translate(W / 2, W * 0.55)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  for (let i = 0; i <= 200; i++) {
    const a = (i / 200) * Math.PI * 2
    const lobe = Math.pow(Math.abs(Math.cos(2.5 * a)), 1.6)
    const notch = 1 - 0.65 * Math.exp(-Math.pow((a - Math.PI) / 0.35, 2))
    const R = W * 0.44 * (0.38 + 0.62 * lobe) * notch
    const x = Math.sin(a) * R
    const y = -Math.cos(a) * R
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 1.2
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.sin(a) * W * 0.36, -Math.cos(a) * W * 0.36)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, W * 0.4)
  ctx.lineWidth = 2
  ctx.stroke()
  return { map: c }
}

let emblemPath: Path2D | undefined

/** Peint le symbole du clan Nara (tracé partagé avec l'interface), disque extérieur de rayon R centré en (cx, cy). */
export function drawEmblem(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, color = '#fff') {
  emblemPath ??= new Path2D(EMBLEM_PATH)
  ctx.save()
  ctx.translate(cx - R, cy - R)
  ctx.scale(R / 50, R / 50)
  ctx.fillStyle = color
  ctx.fill(emblemPath, 'evenodd')
  ctx.restore()
}

export function genEmblem(size = 512): GenResult {
  const c = makeCanvas(size, size)
  const ctx = ctx2d(c)
  ctx.clearRect(0, 0, size, size)
  drawEmblem(ctx, size / 2, size / 2, size * 0.47)
  return { map: c }
}

/* ------------------------------------------------------------------ */
/* Textiles imprimés, calligraphies, lanternes                          */
/* ------------------------------------------------------------------ */

/** Bannière de tissu noir avec emblème ou kanji. */
/** `aspect` = largeur / hauteur du tissu : la toile suit ses proportions pour que l'emblème reste rond. */
export function genBanner(content: { emblem?: boolean; kanji?: string; sub?: string }, seed = 171, base = '#15171a', ink = '#d8cfb8', aspect = 0.4): GenResult {
  const w = 256
  const h = Math.round(w / aspect)
  const c = makeCanvas(w, h)
  const ctx = ctx2d(c)
  const n = new Noise2(seed)
  const img = ctx.createImageData(w, h)
  const b = hex(parseInt(base.slice(1), 16))
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const f = 0.85 + 0.1 * n.noise((x / w) * 60, (y / h) * 150, 60, 150) + 0.08 * n.fbm((x / w) * 3, (y / h) * 6, 3, 3, 6)
      writeRGB(img.data, (y * w + x) * 4, [b[0] * f, b[1] * f, b[2] * f])
    }
  ctx.putImageData(img, 0, 0)
  ctx.strokeStyle = ink
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 3
  ctx.strokeRect(12, 12, w - 24, h - 24)
  ctx.globalAlpha = 1
  if (content.emblem) drawEmblem(ctx, w / 2, content.kanji || content.sub ? h * 0.3 : h / 2, Math.min(w * 0.36, h * 0.4), ink)
  if (content.kanji) {
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const chars = [...content.kanji]
    const size = content.emblem ? w * 0.34 : w * 0.56
    ctx.font = `800 ${size}px ${JP_FONT}`
    const startY = content.emblem ? h * 0.62 : h * 0.38 - ((chars.length - 1) * size) / 2 + size * 0.2
    chars.forEach((ch, i) => ctx.fillText(ch, w / 2, startY + i * size * 1.02))
  }
  if (content.sub) {
    ctx.fillStyle = ink
    ctx.globalAlpha = 0.8
    ctx.font = `600 ${w * 0.085}px ${LATIN_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(content.sub, w / 2, h * 0.9)
    ctx.globalAlpha = 1
  }
  return { map: c }
}

/** Rideau de porche (mizuhiki-maku) : bande horizontale, ourlet de tringle et emblème répété `count` fois.
 *  `aspect` = largeur / hauteur du tissu. */
export function genMaku(count: number, aspect: number, seed = 191, base = '#15171a', ink = '#d8cfb8'): GenResult {
  const h = 192
  const w = Math.round(h * aspect)
  const c = makeCanvas(w, h)
  const ctx = ctx2d(c)
  const n = new Noise2(seed)
  const img = ctx.createImageData(w, h)
  const b = hex(parseInt(base.slice(1), 16))
  // même tissage que les bannières (~4 px par fil), grandes ondulations étirées dans la longueur
  const wx = Math.round(w / 4.3)
  const wy = Math.round(h / 4.3)
  const fx = Math.max(1, Math.round(aspect * 2))
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const f = 0.85 + 0.1 * n.noise((x / w) * wx, (y / h) * wy, wx, wy) + 0.08 * n.fbm((x / w) * fx, (y / h) * 2, 3, fx, 2)
      writeRGB(img.data, (y * w + x) * 4, [b[0] * f, b[1] * f, b[2] * f])
    }
  ctx.putImageData(img, 0, 0)
  const hem = h * 0.13
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.fillRect(0, 0, w, hem)
  ctx.strokeStyle = ink
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 3
  ctx.strokeRect(10, hem + 6, w - 20, h - hem - 16)
  ctx.globalAlpha = 1
  for (let i = 0; i < count; i++) drawEmblem(ctx, ((i + 0.5) * w) / count, (hem + h) / 2, h * 0.32, ink)
  return { map: c }
}

/** Rouleau suspendu (kakejiku) avec calligraphie verticale et sceau. */
export function genKakejiku(text: string, opts: { seed?: number; sub?: string; ink?: boolean } = {}): GenResult {
  const w = 256
  const h = 768
  const c = makeCanvas(w, h)
  const ctx = ctx2d(c)
  const seed = opts.seed ?? 5
  const r = rng(seed)
  // montage en brocart
  ctx.fillStyle = '#2a2622'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#4a3b2a'
  for (let i = 0; i < 60; i++) ctx.fillRect(r() * w, r() * h, 2, 2)
  ctx.fillStyle = '#6b5434'
  ctx.fillRect(w * 0.08, h * 0.13, w * 0.84, h * 0.72)
  const px = w * 0.13
  const py = h * 0.16
  const pw = w * 0.74
  const ph = h * 0.66
  const pc = makeCanvas(Math.round(pw), Math.round(ph))
  const pctx = ctx2d(pc)
  if (opts.ink) drawInkLandscape(pctx, pc.width, pc.height, { seed, pine: true, moon: true, layers: 3, paper: '#d7ccb0' })
  else paintPaper(pctx, pc.width, pc.height, '#d9cfb6', seed)
  ctx.drawImage(pc, px, py)
  if (text) {
    const chars = [...text]
    const size = Math.min(pw * 0.62, (ph * 0.82) / chars.length)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `800 ${size}px ${JP_FONT}`
    for (let pass = 0; pass < 3; pass++) {
      ctx.fillStyle = `rgba(14,13,12,${pass === 0 ? 0.9 : 0.25})`
      chars.forEach((ch, i) => ctx.fillText(ch, w / 2 + (r() - 0.5) * pass * 2, py + ph * 0.1 + size * (i + 0.5) + (r() - 0.5) * pass * 2))
    }
  }
  if (opts.sub) {
    ctx.fillStyle = 'rgba(14,13,12,0.75)'
    ctx.font = `500 ${w * 0.05}px ${LATIN_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(opts.sub, w / 2, py + ph - 18)
  }
  // sceau rouge
  ctx.fillStyle = 'rgba(160,36,28,0.9)'
  ctx.fillRect(px + pw - 34, py + ph - 70, 20, 20)
  // baguette inférieure
  ctx.fillStyle = '#1a1310'
  ctx.fillRect(0, h - 20, w, 20)
  return { map: c }
}

/** Papier de lanterne (chōchin) avec nervures et kanji. Carte émissive incluse. */
export function genLanternPaper(text = '影', seed = 181): GenResult {
  const w = 512
  const h = 256
  const c = makeCanvas(w, h)
  const ctx = ctx2d(c)
  paintPaper(ctx, w, h, '#efe2c4', seed)
  ctx.strokeStyle = 'rgba(80,50,25,0.35)'
  ctx.lineWidth = 2
  for (let y = 6; y < h; y += 11) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(30,18,10,0.85)'
  ctx.font = `800 ${h * 0.5}px ${JP_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w * 0.25, h * 0.52)
  // la toile fait le tour du chōchin (≈ 1,45 m à l'équateur) sur 0,64 m de haut : on resserre
  // l'emblème en largeur pour qu'il reste rond une fois enroulé
  ctx.save()
  ctx.translate(w * 0.75, 0)
  ctx.scale(0.885, 1)
  drawEmblem(ctx, 0, h * 0.52, h * 0.24, 'rgba(30,18,10,0.85)')
  ctx.restore()
  ctx.fillStyle = '#16100c'
  ctx.fillRect(0, 0, w, 10)
  ctx.fillRect(0, h - 10, w, 10)
  return { map: c, emissive: c }
}

/* ------------------------------------------------------------------ */
/* Carte du monde shinobi (parchemin)                                   */
/* ------------------------------------------------------------------ */
export function genWorldMap(w = 1024, h = 640, seed = 191): GenResult {
  const c = makeCanvas(w, h)
  const ctx = ctx2d(c)
  const n = new Noise2(seed)
  paintPaper(ctx, w, h, '#c8b48c', seed)
  // terres
  const lands = [
    { x: 0.5, y: 0.6, r: 0.27 }, // Feu
    { x: 0.2, y: 0.72, r: 0.2 }, // Vent
    { x: 0.37, y: 0.38, r: 0.11 }, // Pluie
    { x: 0.27, y: 0.22, r: 0.18 }, // Terre
    { x: 0.72, y: 0.16, r: 0.17 }, // Foudre
    { x: 0.62, y: 0.38, r: 0.12 },
  ]
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w
      const v = y / h
      let land = -1
      for (const L of lands) land = Math.max(land, 1 - Math.hypot((u - L.x) * 1.0, (v - L.y) * 1.25) / L.r)
      // archipel de l'Eau (est)
      if (u > 0.8) land = Math.max(land, (n.fbm(u * 14, v * 14, 3) + 0.05) * 3 - 0.2)
      land += n.fbm(u * 8, v * 8, 4) * 0.55
      const i = (y * w + x) * 4
      if (land < 0) {
        const depth = clamp(-land * 2)
        d[i] = d[i] * (0.62 - depth * 0.08)
        d[i + 1] = d[i + 1] * (0.66 - depth * 0.06)
        d[i + 2] = d[i + 2] * (0.68 - depth * 0.02)
      } else if (land < 0.04) {
        d[i] *= 0.35
        d[i + 1] *= 0.3
        d[i + 2] *= 0.26
      } else {
        const hh = n.fbm(u * 20, v * 20, 3)
        const k = 0.92 + hh * 0.12
        d[i] *= k
        d[i + 1] *= k
        d[i + 2] *= k * 0.95
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  // forêts du Pays du Feu
  const r = rng(seed)
  ctx.fillStyle = 'rgba(40,55,40,0.35)'
  for (let i = 0; i < 260; i++) {
    const a = r() * Math.PI * 2
    const rr = Math.sqrt(r()) * 0.22
    ctx.beginPath()
    ctx.arc(w * (0.5 + Math.cos(a) * rr), h * (0.6 + (Math.sin(a) * rr) / 1.25), 3 + r() * 4, 0, Math.PI * 2)
    ctx.fill()
  }
  // frontières en pointillé
  ctx.setLineDash([6, 6])
  ctx.strokeStyle = 'rgba(90,30,20,0.6)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(w * 0.33, h * 0.95)
  ctx.quadraticCurveTo(w * 0.31, h * 0.6, w * 0.36, h * 0.5)
  ctx.quadraticCurveTo(w * 0.47, h * 0.42, w * 0.56, h * 0.47)
  ctx.moveTo(w * 0.45, h * 0.3)
  ctx.quadraticCurveTo(w * 0.36, h * 0.28, w * 0.29, h * 0.43)
  ctx.stroke()
  ctx.setLineDash([])
  // rose des vents
  ctx.strokeStyle = 'rgba(40,25,15,0.7)'
  ctx.lineWidth = 1.5
  const rx = w * 0.9
  const ry = h * 0.82
  ctx.beginPath()
  ctx.arc(rx, ry, 40, 0, Math.PI * 2)
  ctx.moveTo(rx, ry - 52)
  ctx.lineTo(rx, ry + 52)
  ctx.moveTo(rx - 52, ry)
  ctx.lineTo(rx + 52, ry)
  ctx.stroke()
  ctx.fillStyle = 'rgba(40,25,15,0.8)'
  ctx.font = `800 22px ${JP_FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('北', rx, ry - 58)
  // libellés
  const label = (x: number, y: number, jp: string, fr: string, village?: string, red = false) => {
    ctx.fillStyle = 'rgba(25,18,12,0.9)'
    ctx.font = `800 34px ${JP_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(jp, w * x, h * y)
    ctx.font = `600 italic 19px ${LATIN_FONT}`
    ctx.fillText(fr, w * x, h * y + 24)
    if (village) {
      ctx.fillStyle = red ? 'rgba(150,32,24,0.95)' : 'rgba(25,18,12,0.9)'
      ctx.beginPath()
      ctx.arc(w * x, h * y + 44, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = `700 18px ${LATIN_FONT}`
      ctx.fillText(village, w * x, h * y + 70)
    }
  }
  label(0.52, 0.56, '火の国', 'Pays du Feu', 'Konoha', true)
  label(0.17, 0.7, '風の国', 'Pays du Vent', 'Suna', true)
  label(0.38, 0.33, '雨の国', 'Pays de la Pluie', 'Ame', true)
  label(0.9, 0.36, '水の国', "Pays de l'Eau", 'Kiri', true)
  label(0.24, 0.13, '土の国', 'Pays de la Terre')
  label(0.72, 0.09, '雷の国', 'Pays de la Foudre')
  // cadre
  ctx.strokeStyle = 'rgba(40,25,15,0.8)'
  ctx.lineWidth = 6
  ctx.strokeRect(10, 10, w - 20, h - 20)
  ctx.lineWidth = 1.5
  ctx.strokeRect(22, 22, w - 44, h - 44)
  return { map: c }
}

/** Page manuscrite (carnets, dossiers). */
export function genHandwriting(seed = 201, w = 512, h = 384, title?: string): GenResult {
  const c = makeCanvas(w, h)
  const ctx = ctx2d(c)
  const r = rng(seed)
  paintPaper(ctx, w, h, '#ddd2b8', seed)
  ctx.strokeStyle = 'rgba(30,26,22,0.75)'
  ctx.lineCap = 'round'
  // écriture verticale japonaise suggérée (colonnes de droite à gauche)
  for (let col = 0; col < 12; col++) {
    const x = w - 40 - col * 36
    let y = title && col === 0 ? 80 : 30
    while (y < h - 30) {
      const s = 6 + r() * 10
      ctx.lineWidth = 1 + r() * 1.6
      ctx.beginPath()
      ctx.moveTo(x - s / 2 + r() * 4, y)
      for (let k = 0; k < 3; k++) ctx.lineTo(x + (r() - 0.5) * s, y + r() * s)
      ctx.stroke()
      y += s + 6 + r() * 6
      if (r() < 0.06) y += 30
    }
  }
  if (title) {
    ctx.fillStyle = 'rgba(30,20,15,0.85)'
    ctx.font = `800 40px ${JP_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(title, w - 40, 60)
  }
  // annotation rouge
  ctx.strokeStyle = 'rgba(150,40,30,0.7)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(w * (0.3 + r() * 0.3), h * (0.3 + r() * 0.3), 40, 26, 0.2, 0, Math.PI * 2)
  ctx.stroke()
  return { map: c }
}

/** Dos de livre neutre (teinté par instance). */
export function genBookSpine(): GenResult {
  const w = 64
  const h = 256
  const c = makeCanvas(w, h)
  const ctx = ctx2d(c)
  const n = new Noise2(211)
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = 0.78 + 0.1 * n.noise((x / w) * 8, (y / h) * 30, 8, 30) + 0.05 * n.noise((x / w) * 40, (y / h) * 120, 40, 120)
      writeRGB(img.data, (y * w + x) * 4, [v, v, v])
    }
  ctx.putImageData(img, 0, 0)
  ctx.fillStyle = 'rgba(255,236,190,0.9)'
  for (const y of [18, 26, h - 30, h - 22]) ctx.fillRect(4, y, w - 8, 3)
  ctx.fillStyle = 'rgba(240,230,205,0.85)'
  ctx.fillRect(14, 60, w - 28, 70)
  ctx.fillStyle = 'rgba(30,25,20,0.6)'
  for (let i = 0; i < 4; i++) ctx.fillRect(22, 72 + i * 14, w - 44, 4)
  return { map: c }
}
