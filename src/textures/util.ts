import * as THREE from 'three'

export const JP_FONT = '"Shippori Mincho", "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", "MS Mincho", serif'
export const LATIN_FONT = '"EB Garamond", "Garamond", "Georgia", serif'

export function makeCanvas(w: number, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function ctx2d(c: HTMLCanvasElement) {
  return c.getContext('2d')!
}

/** Écrit un buffer RGB (0..1) dans un canvas. */
export function rgbToCanvas(w: number, h: number, fill: (x: number, y: number, out: Float32Array) => void, alpha = false) {
  const c = makeCanvas(w, h)
  const ctx = ctx2d(c)
  const img = ctx.createImageData(w, h)
  const d = img.data
  const o = new Float32Array(4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      o[3] = 1
      fill(x, y, o)
      const i = (y * w + x) * 4
      d[i] = o[0] * 255
      d[i + 1] = o[1] * 255
      d[i + 2] = o[2] * 255
      d[i + 3] = alpha ? o[3] * 255 : 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

/** Carte de normales (convention OpenGL, celle de three.js) à partir d'une carte de hauteur raccordable. */
export function normalFromHeight(hm: Float32Array, w: number, h: number, strength = 2) {
  const c = makeCanvas(w, h)
  const ctx = ctx2d(c)
  const img = ctx.createImageData(w, h)
  const d = img.data
  for (let y = 0; y < h; y++) {
    const yu = ((y - 1 + h) % h) * w
    const yd = ((y + 1) % h) * w
    const yr = y * w
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w
      const xr = (x + 1) % w
      const du = (hm[yr + xr] - hm[yr + xl]) * strength
      const dv = (hm[yu + x] - hm[yd + x]) * strength
      let nx = -du
      let ny = -dv
      let nz = 1
      const l = Math.hypot(nx, ny, nz)
      nx /= l
      ny /= l
      nz /= l
      const i = (yr + x) * 4
      d[i] = (nx * 0.5 + 0.5) * 255
      d[i + 1] = (ny * 0.5 + 0.5) * 255
      d[i + 2] = (nz * 0.5 + 0.5) * 255
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

export function grayToCanvas(g: Float32Array, w: number, h: number) {
  const c = makeCanvas(w, h)
  const ctx = ctx2d(c)
  const img = ctx.createImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, g[i] * 255))
    img.data[i * 4] = v
    img.data[i * 4 + 1] = v
    img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c
}

export function toTexture(c: HTMLCanvasElement, { srgb = true, repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = aniso
  t.needsUpdate = true
  return t
}

export const hexToRgb = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]

/** Laisse le navigateur respirer pendant les longues générations. */
export const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0))
