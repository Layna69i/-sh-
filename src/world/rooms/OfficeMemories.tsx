/**
 * Coin des souvenirs du bureau de Shikae, à gauche de sa place, près de l'encrier et du carnet :
 * - le portrait de famille (image fournie, peinture recadrée à l'intérieur de son cadre doré
 *   dessiné, sans retouche), dans un cadre debout de bois laqué noir à filet d'or, sous verre,
 *   tourné vers sa place et éclairé par la bougie et l'andon de la pièce ;
 * - la bandelette de Kaen, pliée avec soin en accordéon, l'extrémité posée à plat, sur un fukusa plié
 *   dans un petit plateau laqué : un objet conservé, pas jeté.
 * Le portrait est chargé à la demande (seulement quand le bureau est monté).
 */
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { M, cachedMaterial, dynamicTexture } from '../assets'
import { chamferBoxGeo } from '../geo'
import { PBR, PBR_SIZE } from '../pbr'
import { makeCanvas, ctx2d, LATIN_FONT } from '../../textures/util'
import { rng } from '../../core/math'

/** Position du coin des souvenirs (monde) : sur le bureau, à gauche de la place assise. */
export const MEMORY = {
  portrait: { x: -0.45, y: 0.32, z: -54.46, ry: 0.46 },
  tray: { x: -0.43, y: 0.32, z: -54.2, ry: 0.32 },
}

const PAINT_W = 0.24
const PAINT_H = PAINT_W / 0.8458 // proportions de la peinture fournie

/* ------------------------------ portrait ------------------------------ */
function engravingTexture() {
  // « Famille ♡ », gravé comme sur le cadre de l'image d'origine
  return dynamicTexture('portrait-engraving', () => {
    const c = makeCanvas(512, 64)
    const ctx = ctx2d(c)
    ctx.fillStyle = '#2a1f19'
    ctx.fillRect(0, 0, 512, 64)
    ctx.font = `italic 500 38px ${LATIN_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillText('Famille ♡', 257, 35)
    ctx.fillStyle = 'rgba(196,154,85,0.85)'
    ctx.fillText('Famille ♡', 256, 33)
    return c
  })
}

function usePortraitTexture() {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let alive = true
    new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/office/portrait-famille.jpg`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      if (alive) setTex(t)
      else t.dispose()
    })
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => () => tex?.dispose(), [tex])
  return tex
}

export function FamilyPortrait() {
  const tex = usePortraitTexture()
  const m = M()
  const parts = useMemo(() => {
    const rail = 0.03
    const bottom = 0.042
    const W = PAINT_W + rail * 2
    const H = PAINT_H + rail + bottom
    const D = 0.02
    const lacquer = cachedMaterial('portrait-lacquer', () => {
      const l = m.woodBlack.clone()
      l.roughness = 0.32
      l.color.setHex(0x2a211c)
      return l
    })
    const geo = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const g = chamferBoxGeo(w, h, d, 0.004, 'v')
      g.translate(x, y, z)
      return g
    }
    const yc = bottom + PAINT_H / 2
    const frame = [
      geo(W, rail, D, 0, H - rail / 2, 0),
      geo(W, bottom, D, 0, bottom / 2, 0),
      geo(rail, PAINT_H + 0.002, D, -W / 2 + rail / 2, yc, 0),
      geo(rail, PAINT_H + 0.002, D, W / 2 - rail / 2, yc, 0),
    ]
    // filet d'or intérieur (rappel du cadre doré de la peinture)
    const f = 0.005
    const fillet = [
      geo(PAINT_W + f, f, 0.012, 0, yc + PAINT_H / 2 - f / 2 + 0.002, 0.003),
      geo(PAINT_W + f, f, 0.012, 0, yc - PAINT_H / 2 + f / 2 - 0.002, 0.003),
      geo(f, PAINT_H, 0.012, -PAINT_W / 2 + f / 2 - 0.002, yc, 0.003),
      geo(f, PAINT_H, 0.012, PAINT_W / 2 - f / 2 + 0.002, yc, 0.003),
    ]
    const back = geo(W - 0.01, H - 0.01, 0.006, 0, H / 2, -D / 2 - 0.002)
    // chevalet : patte arrière
    const strut = chamferBoxGeo(0.035, H * 0.82, 0.006, 0.002)
    strut.translate(0, H * 0.41, 0)
    strut.rotateX(-0.42)
    strut.translate(0, 0, -D / 2 - 0.004)
    const plate = new THREE.PlaneGeometry(W * 0.62, bottom * 0.56)
    plate.translate(0, bottom * 0.5, D / 2 + 0.0008)
    const paint = new THREE.PlaneGeometry(PAINT_W, PAINT_H)
    paint.translate(0, yc, 0.0015)
    const glass = new THREE.PlaneGeometry(PAINT_W, PAINT_H)
    glass.translate(0, yc, 0.0062)
    return { frame, fillet, back, strut, plate, paint, glass, lacquer, H }
  }, [m])
  useEffect(
    () => () => {
      ;[...parts.frame, ...parts.fillet, parts.back, parts.strut, parts.plate, parts.paint, parts.glass].forEach((g) => g.dispose())
    },
    [parts],
  )
  const paintMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, map: null }), [])
  useEffect(() => {
    paintMat.map = tex
    paintMat.color.setHex(tex ? 0xffffff : 0xd8ccb0)
    paintMat.needsUpdate = true
  }, [paintMat, tex])
  const glassMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.035, roughness: 0.05, metalness: 0, depthWrite: false, envMapIntensity: 0.9 }),
    [],
  )
  const plateMat = useMemo(() => new THREE.MeshStandardMaterial({ map: engravingTexture(), roughness: 0.5 }), [])
  useEffect(
    () => () => {
      paintMat.dispose()
      glassMat.dispose()
      plateMat.dispose()
    },
    [paintMat, glassMat, plateMat],
  )
  const P = MEMORY.portrait
  return (
    <group position={[P.x, P.y, P.z]} rotation={[0, P.ry, 0]}>
      {/* le cadre repose sur sa base, légèrement incliné vers l'arrière */}
      <group rotation={[-0.21, 0, 0]}>
        {parts.frame.map((g, i) => (
          <mesh key={`f${i}`} geometry={g} material={parts.lacquer} castShadow receiveShadow />
        ))}
        {parts.fillet.map((g, i) => (
          <mesh key={`g${i}`} geometry={g} material={m.gold} />
        ))}
        <mesh geometry={parts.back} material={m.woodDark} castShadow />
        <mesh geometry={parts.strut} material={m.woodDark} castShadow />
        <mesh geometry={parts.plate} material={plateMat} />
        <mesh geometry={parts.paint} material={paintMat} receiveShadow />
        <mesh geometry={parts.glass} material={glassMat} renderOrder={2} />
      </group>
    </group>
  )
}

/* ------------------------------ bandelette ------------------------------ */
function linenMaterial() {
  return cachedMaterial('kaen-linen-v2', () => {
    const s = PBR().rough_linen
    // lin : diffusion mate et léger lustre des fibres (sheen), lin un peu jauni par l'âge
    const base: THREE.MeshPhysicalMaterialParameters = {
      color: 0xe6dccb,
      roughness: 1,
      vertexColors: true,
      side: THREE.DoubleSide,
      sheen: 0.6,
      sheenColor: new THREE.Color(0xfff4e0),
      sheenRoughness: 0.6,
    }
    if (!s) return new THREE.MeshPhysicalMaterial({ ...base, map: M().fabricDark.map, color: 0xd8cdb8 })
    // trame à l'échelle réelle du lin grossier (tuile de 27 cm)
    const rep = 1 / PBR_SIZE.rough_linen
    const c = (t: THREE.Texture) => {
      const x = t.clone()
      x.repeat.set(rep, rep)
      x.needsUpdate = true
      return x
    }
    const arm = c(s.arm)
    return new THREE.MeshPhysicalMaterial({ ...base, map: c(s.map), normalMap: c(s.normalMap), normalScale: new THREE.Vector2(1.6, 1.6), roughnessMap: arm, aoMap: arm })
  })
}

/**
 * Bande de lin pliée en accordéon : quatre épaisseurs légèrement décalées (chaque pli se voit),
 * plis arrondis, section un peu creusée, froissures en travers ; l'extrémité libre redescend sur
 * le tissu en s'incurvant vers la place de Shikae et s'achève sur quelques fils effilochés.
 * Couleurs par sommet : lin jauni, bords plus usés.
 */
function bandageGeometry() {
  const w = 0.042 // largeur de la bande
  const layers = 4
  const run = 0.095 // longueur d'une épaisseur
  const gap = 0.006 // écart entre deux épaisseurs (tissu souple, non tassé)
  const r = rng(77)
  // ligne médiane 3D de la bande
  const path: THREE.Vector3[] = []
  const shift = [0, 0.005, -0.002, 0.006]
  for (let l = 0; l < layers; l++) {
    const y = 0.0012 + l * gap
    const dir = l % 2 ? -1 : 1
    const z0 = dir > 0 ? -run / 2 : run / 2
    const N = 26
    for (let i = l === 0 ? 0 : 1; i <= N; i++) {
      const t = i / N
      path.push(new THREE.Vector3(shift[l] + Math.sin(t * 3 + l) * 0.0012, y + Math.sin(t * Math.PI) * 0.0014, z0 + dir * t * run))
    }
    if (l < layers - 1) {
      const zc = z0 + dir * run
      for (let i = 1; i < 9; i++) {
        const a = (i / 9) * Math.PI
        const sx = shift[l] + (shift[l + 1] - shift[l]) * (i / 9)
        path.push(new THREE.Vector3(sx, y + gap / 2 - Math.cos(a) * (gap / 2), zc + dir * Math.sin(a) * (gap / 2 + 0.0018)))
      }
    }
  }
  // extrémité libre : redescend sur le tissu en s'incurvant
  const last = path[path.length - 1].clone()
  const dirEnd = layers % 2 ? 1 : -1
  const tail = 34
  for (let i = 1; i <= tail; i++) {
    const t = i / tail
    const drop = THREE.MathUtils.smoothstep(t, 0.04, 0.4)
    path.push(
      new THREE.Vector3(
        last.x + 0.03 * t * t,
        last.y * (1 - drop) + 0.0009 + Math.sin(t * Math.PI * 1.7) * 0.0008 * t,
        last.z + dirEnd * (0.005 + t * 0.07),
      ),
    )
  }
  const pos: number[] = []
  const col: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const across = 8
  let L = 0
  const tint = new THREE.Color()
  const tan = new THREE.Vector3()
  const side = new THREE.Vector3(1, 0, 0)
  const up = new THREE.Vector3(0, 1, 0)
  // froissures : quelques plis transversaux irréguliers
  const creases = Array.from({ length: 14 }, () => ({ at: r(), amp: 0.0004 + r() * 0.0008, width: 0.004 + r() * 0.006 }))
  let total = 0
  for (let i = 1; i < path.length; i++) total += path[i].distanceTo(path[i - 1])
  for (let i = 0; i < path.length; i++) {
    if (i > 0) L += path[i].distanceTo(path[i - 1])
    tan.subVectors(path[Math.min(path.length - 1, i + 1)], path[Math.max(0, i - 1)])
    // la largeur reste horizontale et perpendiculaire à la marche (pas de torsion dans les plis)
    const flat = new THREE.Vector3(tan.x, 0, tan.z)
    if (flat.lengthSq() > 1e-8) side.crossVectors(flat.normalize(), up).normalize().negate()
    const f = L / total
    let crease = 0
    for (const c of creases) crease += c.amp * Math.exp(-(((f - c.at) * total) ** 2) / (c.width * c.width))
    const fray = i > path.length - 4 ? (r() - 0.5) * 0.004 : 0
    for (let k = 0; k <= across; k++) {
      const u = k / across
      const a = (u - 0.5) * 2
      const off = (u - 0.5) * w
      const p = path[i]
      pos.push(p.x + side.x * off, p.y - 0.0011 * (1 - a * a) * 0.6 + crease * (1 - a * a * 0.5) + (k % 3 === 0 ? fray : 0) * 0.2, p.z + side.z * off + (k % 2 ? fray : 0))
      uv.push(off, L)
      const edge = Math.pow(Math.abs(a), 3)
      const k1 = 0.94 + 0.04 * Math.sin(L * 61 + 1.3) * Math.sin(L * 23) - edge * 0.14 - crease * 22
      tint.setRGB(k1, k1 * (0.975 - edge * 0.04), k1 * (0.93 - edge * 0.07))
      col.push(tint.r, tint.g, tint.b)
    }
    if (i > 0)
      for (let k = 0; k < across; k++) {
        const a0 = (i - 1) * (across + 1) + k
        const b0 = i * (across + 1) + k
        idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1)
      }
  }
  // fils effilochés au bout : quelques brins fins qui dépassent
  const endP = path[path.length - 1]
  const endT = new THREE.Vector3().subVectors(endP, path[path.length - 2]).setY(0).normalize()
  const endS = new THREE.Vector3().crossVectors(endT, up).normalize().negate()
  for (let n = 0; n < 9; n++) {
    const off = (r() - 0.5) * w * 0.9
    const len = 0.004 + r() * 0.009
    const base = pos.length / 3
    const bend = (r() - 0.5) * 0.6
    for (let s = 0; s <= 3; s++) {
      const t = s / 3
      const dx = endT.x * len * t + endS.x * (off + bend * len * t * t)
      const dz = endT.z * len * t + endS.z * (off + bend * len * t * t)
      for (const h of [-0.0004, 0.0004]) {
        pos.push(endP.x + dx + endS.x * h, endP.y + 0.0002, endP.z + dz + endS.z * h)
        uv.push(off, L + len * t)
        col.push(0.86, 0.83, 0.78)
      }
      if (s > 0) idx.push(base + (s - 1) * 2, base + s * 2, base + (s - 1) * 2 + 1, base + (s - 1) * 2 + 1, base + s * 2, base + s * 2 + 1)
    }
  }
  const strip = new THREE.BufferGeometry()
  strip.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  strip.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  strip.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  strip.setIndex(idx)
  strip.computeVertexNormals()
  return { strip }
}

export function KaenBandage() {
  const m = M()
  const g = useMemo(() => {
    const b = bandageGeometry()
    // plateau laqué (noir dehors, vermillon dedans) et fukusa plié
    const tw = 0.24, td = 0.2, rim = 0.018, t = 0.008
    const tray = [chamferBoxGeo(tw, t, td, 0.003)]
    tray[0].translate(0, t / 2, 0)
    for (const [w, d, x, z] of [
      [tw, 0.008, 0, td / 2 - 0.004],
      [tw, 0.008, 0, -td / 2 + 0.004],
      [0.008, td - 0.016, tw / 2 - 0.004, 0],
      [0.008, td - 0.016, -tw / 2 + 0.004, 0],
    ] as const) {
      const r = chamferBoxGeo(w, rim, d, 0.002)
      r.translate(x, rim / 2, z)
      tray.push(r)
    }
    const inner = new THREE.PlaneGeometry(tw - 0.018, td - 0.018)
    inner.rotateX(-Math.PI / 2)
    inner.translate(0, t + 0.0005, 0)
    const cloth = chamferBoxGeo(0.17, 0.007, 0.155, 0.003)
    cloth.translate(0.005, t + 0.0035, -0.004)
    // pli visible du fukusa (rabat)
    const flap = chamferBoxGeo(0.18, 0.0035, 0.06, 0.0015)
    flap.translate(0.005, t + 0.0085, -0.044)
    return { ...b, tray, inner, cloth, flap }
  }, [])
  useEffect(
    () => () => {
      ;[g.strip, ...g.tray, g.inner, g.cloth, g.flap].forEach((x) => x.dispose())
    },
    [g],
  )
  const lacquer = cachedMaterial('tray-lacquer', () => {
    const l = m.woodBlack.clone()
    l.roughness = 0.22
    l.color.setHex(0x1e1916)
    return l
  })
  const redLacquer = cachedMaterial('tray-lacquer-red', () => new THREE.MeshStandardMaterial({ color: 0x7a2418, roughness: 0.25 }))
  // fukusa de soie : sans trame visible, reflet soyeux physique (sheen)
  const silk = cachedMaterial('fukusa-silk-v2', () => new THREE.MeshPhysicalMaterial({ color: 0x3e2547, roughness: 0.62, sheen: 1, sheenColor: new THREE.Color(0xc9a0d6), sheenRoughness: 0.32 }))
  const linen = linenMaterial()
  const T = MEMORY.tray
  return (
    <group position={[T.x, T.y, T.z]} rotation={[0, T.ry, 0]}>
      {g.tray.map((x, i) => (
        <mesh key={i} geometry={x} material={lacquer} castShadow receiveShadow />
      ))}
      <mesh geometry={g.inner} material={redLacquer} receiveShadow />
      <mesh geometry={g.cloth} material={silk} castShadow receiveShadow />
      <mesh geometry={g.flap} material={silk} castShadow />
      {/* la bande pliée repose sur le fukusa, l'extrémité tournée vers la place de Shikae */}
      <group position={[0.004, 0.0155, 0.01]} rotation={[0, Math.PI + 0.06, 0]}>
        <mesh geometry={g.strip} material={linen} castShadow receiveShadow />
      </group>
    </group>
  )
}
