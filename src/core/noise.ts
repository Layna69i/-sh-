import { rng } from './math'

/**
 * Bruit de gradient 2D (type Perlin) avec période optionnelle,
 * ce qui permet de produire des textures parfaitement raccordables.
 */
export class Noise2 {
  private perm = new Uint8Array(512)
  private gx = new Float32Array(256)
  private gy = new Float32Array(256)

  constructor(seed = 1) {
    const r = rng(seed)
    const p = new Uint8Array(256)
    for (let i = 0; i < 256; i++) p[i] = i
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      const t = p[i]
      p[i] = p[j]
      p[j] = t
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]
    for (let i = 0; i < 256; i++) {
      const a = r() * Math.PI * 2
      this.gx[i] = Math.cos(a)
      this.gy[i] = Math.sin(a)
    }
  }

  /** Bruit dans [-1, 1] environ. px/py = période (entière) pour le raccord. */
  noise(x: number, y: number, px = 256, py = 256) {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const x0 = ((xi % px) + px) % px
    const y0 = ((yi % py) + py) % py
    const x1 = (x0 + 1) % px
    const y1 = (y0 + 1) % py
    const P = this.perm
    const h00 = P[P[x0 & 255] + (y0 & 255)]
    const h10 = P[P[x1 & 255] + (y0 & 255)]
    const h01 = P[P[x0 & 255] + (y1 & 255)]
    const h11 = P[P[x1 & 255] + (y1 & 255)]
    const d00 = this.gx[h00] * xf + this.gy[h00] * yf
    const d10 = this.gx[h10] * (xf - 1) + this.gy[h10] * yf
    const d01 = this.gx[h01] * xf + this.gy[h01] * (yf - 1)
    const d11 = this.gx[h11] * (xf - 1) + this.gy[h11] * (yf - 1)
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10)
    const a = d00 + (d10 - d00) * u
    const b = d01 + (d11 - d01) * u
    return (a + (b - a) * v) * 1.41
  }

  fbm(x: number, y: number, octaves = 4, px = 256, py = 256, lac = 2, gain = 0.5) {
    let amp = 0.5
    let f = 1
    let sum = 0
    let norm = 0
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(x * f, y * f, Math.max(1, Math.round(px * f)), Math.max(1, Math.round(py * f)))
      norm += amp
      amp *= gain
      f *= lac
    }
    return sum / norm
  }
}

export const worldNoise = new Noise2(7)
