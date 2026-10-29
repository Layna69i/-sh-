/**
 * Sable ratissé du jardin sec (karesansui).
 * Un champ de hauteur est calculé une fois : lignes droites parallèles, et cercles qui épousent
 * le contour réel de chaque pierre (empreinte mesurée), du bassin, des pas japonais et des
 * objets ; bande lisse le long des engawa, léger bourrelet au pied des pierres.
 * Il sert trois fois : relief géométrique (maillage subdivisé), carte de normales haute
 * définition (ombrage fin des sillons) et cavité (creux plus sombres, occlusion douce).
 * Le grain minéral vient de la texture PBR répétée (anti-répétition), combinée à la normale.
 */
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { M } from '../assets'
import { PBR, antiTile } from '../pbr'
import { footprintRadius } from '../rocks'
import { useSettings } from '../../store/settings'
import { POND, pondEdge, PATH, MAPLES, LANTERNS, STELE, TSUKUBAI, SHISHI, BENCH, SAND, RAKE_AREA } from './gardenLayout'

export interface SandObstacle {
  x: number
  z: number
  /** rayon constant, ou empreinte polaire (36 secteurs) tournée de `ry` */
  r?: number
  fp?: Float32Array
  ry?: number
  /** largeur de la zone de cercles autour de l'objet */
  ring: number
  /** bourrelet de sable au pied (m) */
  mound?: number
}

const SPACING = 0.085 // écart des dents du râteau
const DEPTH = 0.016 // profondeur des sillons (crête à creux)

function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

/** Champ de hauteur (m), ombrage (0..1) et normale tangente, sur la grille N×N de RAKE_AREA. */
function computeRake(N: number, rocks: SandObstacle[]) {
  const { x0, z0, size } = RAKE_AREA
  const px = size / N
  const sdf = new Float32Array(N * N).fill(1e3)
  const ring = new Float32Array(N * N)
  const mound = new Float32Array(N * N)
  const stamp = (o: SandObstacle, smooth: number) => {
    const reach = (o.r ?? 1.6) + o.ring + 0.3
    const i0 = Math.max(0, Math.floor((o.x - reach - x0) / px))
    const i1 = Math.min(N - 1, Math.ceil((o.x + reach - x0) / px))
    const j0 = Math.max(0, Math.floor((o.z - reach - z0) / px))
    const j1 = Math.min(N - 1, Math.ceil((o.z + reach - z0) / px))
    for (let j = j0; j <= j1; j++) {
      const wz = z0 + (j + 0.5) * px
      for (let i = i0; i <= i1; i++) {
        const wx = x0 + (i + 0.5) * px
        const dx = wx - o.x
        const dz = wz - o.z
        const dist = Math.hypot(dx, dz)
        const R = o.fp ? footprintRadius(o.fp, dx, dz, o.ry ?? 0) : o.r!
        const d = dist - R
        const k = j * N + i
        const prev = sdf[k]
        const nd = smooth > 0 ? smin(prev, d, smooth) : Math.min(prev, d)
        if (nd < prev) {
          const t = THREE.MathUtils.clamp((prev - d) / Math.max(smooth, 1e-3) * 0.5 + 0.5, 0, 1)
          ring[k] = prev > 900 ? o.ring : ring[k] * (1 - t) + o.ring * t
          sdf[k] = nd
        }
        if (o.mound) mound[k] = Math.max(mound[k], o.mound * Math.exp(-Math.max(0, d) / 0.16))
      }
    }
  }
  for (const r of rocks) stamp(r, 0.45)
  // bassin : distance exacte au contour (polygone)
  {
    const P: [number, number][] = []
    for (let i = 0; i < 64; i++) {
      const [x, z] = pondEdge((i / 64) * Math.PI * 2, 1.13)
      P.push([x, z])
    }
    const reach = 1.4
    const i0 = Math.max(0, Math.floor((POND.x - POND.rx * 1.3 - reach - x0) / px))
    const i1 = Math.min(N - 1, Math.ceil((POND.x + POND.rx * 1.3 + reach - x0) / px))
    const j0 = Math.max(0, Math.floor((POND.z - POND.rz * 1.3 - reach - z0) / px))
    const j1 = Math.min(N - 1, Math.ceil((POND.z + POND.rz * 1.3 + reach - z0) / px))
    for (let j = j0; j <= j1; j++) {
      const wz = z0 + (j + 0.5) * px
      for (let i = i0; i <= i1; i++) {
        const wx = x0 + (i + 0.5) * px
        let best = 1e9
        let inside = false
        for (let a = 0, b = P.length - 1; a < P.length; b = a++) {
          const [ax, az] = P[a]
          const [bx, bz] = P[b]
          if (az > wz !== bz > wz && wx < ((bx - ax) * (wz - az)) / (bz - az) + ax) inside = !inside
          const ex = bx - ax, ez = bz - az
          const t = THREE.MathUtils.clamp(((wx - ax) * ex + (wz - az) * ez) / (ex * ex + ez * ez), 0, 1)
          best = Math.min(best, (wx - ax - ex * t) ** 2 + (wz - az - ez * t) ** 2)
        }
        const d = inside ? -Math.sqrt(best) : Math.sqrt(best)
        const k = j * N + i
        if (d < sdf[k]) {
          sdf[k] = d
          ring[k] = 0.62
        }
      }
    }
  }
  const small: SandObstacle[] = [
    ...PATH.map((s) => ({ x: s.x, z: s.z, r: s.r * 1.02, ring: 0.17, mound: 0.004 })),
    ...MAPLES.map((m) => ({ x: m.x, z: m.z, r: 0.32 * m.s, ring: 0.26, mound: 0.006 })),
    ...LANTERNS.map((l) => ({ x: l.p[0], z: l.p[2], r: 0.36 * l.s, ring: 0.26 })),
    { x: STELE.x, z: STELE.z, r: 0.3, ring: 0.26 },
    { x: TSUKUBAI.x, z: TSUKUBAI.z, r: 0.5, ring: 0.26 },
    { x: SHISHI.x, z: SHISHI.z, r: 0.5, ring: 0.17 },
    { x: BENCH.x - 0.7, z: BENCH.z, r: 0.28, ring: 0.17 },
    { x: BENCH.x + 0.7, z: BENCH.z, r: 0.28, ring: 0.17 },
  ]
  for (const o of small) stamp(o, 0)

  // profil final
  const H = new Float32Array(N * N)
  const shade = new Float32Array(N * N)
  for (let j = 0; j < N; j++) {
    const wz = z0 + (j + 0.5) * px
    for (let i = 0; i < N; i++) {
      const wx = x0 + (i + 0.5) * px
      const k = j * N + i
      const d = sdf[k]
      // lignes droites (légèrement irrégulières, tracées à la main)
      const wob = Math.sin(wx * 0.37 + Math.sin(wz * 0.21) * 2) * 0.035 + Math.sin(wx * 1.7 + wz * 0.3) * 0.006
      const phS = (wz + wob) / SPACING
      const phR = Math.max(d, 0) / SPACING + Math.sin(Math.atan2(wz, wx) * 5 + d * 3) * 0.05
      const rw = ring[k]
      const wRing = d < 900 ? 1 - THREE.MathUtils.smoothstep(d, rw - 0.025, rw + 0.025) : 0
      const prof = (ph: number) => 0.5 - 0.5 * Math.cos(ph * Math.PI * 2)
      let h = (prof(phS) * (1 - wRing) + prof(phR) * wRing) * DEPTH
      // bande lisse au contact des objets et le long des engawa
      const edge = Math.min(wx - SAND.x0, SAND.x1 - wx, wz - SAND.z0, SAND.z1 - wz, Math.abs(wz - -44.6) + (Math.abs(wx) > 6 ? 1 : 0))
      const amp = THREE.MathUtils.smoothstep(d, 0.015, 0.07) * THREE.MathUtils.smoothstep(edge, 0.12, 0.32)
      h = h * amp + DEPTH * 0.5 * (1 - amp) + mound[k]
      if (d < 0) h = -0.03 // fond du bassin
      H[k] = h
      shade[k] = d < 0 ? 0.35 : 1
    }
  }
  // normales (tangentes : T = +x, B = -z) et cavité
  const data = new Uint8Array(N * N * 4)
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const k = j * N + i
      const hl = H[j * N + Math.max(0, i - 1)], hr = H[j * N + Math.min(N - 1, i + 1)]
      const hd = H[Math.max(0, j - 1) * N + i], hu = H[Math.min(N - 1, j + 1) * N + i]
      const gx = (hr - hl) / (2 * px)
      const gz = (hu - hd) / (2 * px)
      let nx = -gx, ny = gz, nz = 1
      const l = Math.hypot(nx, ny, nz)
      nx /= l; ny /= l; nz /= l
      // cavité : position dans le sillon (creux = sombre), atténuée hors du ratissage
      const cav = THREE.MathUtils.clamp((H[k] - DEPTH * 0.12) / (DEPTH * 0.8), 0, 1)
      const s = shade[k] * (0.78 + 0.22 * cav)
      data[k * 4] = (nx * 0.5 + 0.5) * 255
      data[k * 4 + 1] = (ny * 0.5 + 0.5) * 255
      data[k * 4 + 2] = (nz * 0.5 + 0.5) * 255
      data[k * 4 + 3] = s * 255
    }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat)
  tex.colorSpace = THREE.NoColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = 16
  tex.needsUpdate = true
  return { H, tex, N, px }
}

function sandMaterial(rake: THREE.Texture) {
  const lib = PBR()
  const s = lib.sandy_gravel
  const base = M().gravel
  const mat = new THREE.MeshStandardMaterial(
    s
      ? {
          color: 0xe4ddd0,
          map: base.map,
          normalMap: base.normalMap,
          normalScale: new THREE.Vector2(0.8, 0.8),
          roughnessMap: base.roughnessMap,
          aoMap: base.aoMap,
          roughness: 1,
        }
      : { color: base.color, map: base.map, normalMap: base.normalMap, roughness: 0.95 },
  )
  // les cartes (et leur répétition) sont celles du matériau `gravel` : même grain partout
  if (s) antiTile(mat, 0.08)
  const prev = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey.bind(mat)
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r)
    sh.uniforms.rakeMap = { value: rake }
    sh.uniforms.rakeArea = { value: new THREE.Vector3(RAKE_AREA.x0, RAKE_AREA.z0, 1 / RAKE_AREA.size) }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rakeArea;\nvarying vec2 vRakeUv;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 wp = modelMatrix * vec4(transformed, 1.0); vRakeUv = (wp.xz - rakeArea.xy) * rakeArea.z; }')
    // les blocs déjà développés par l'anti-répétition ne sont plus des #include : ancres stables
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps)
      .replace('#include <common>', '#include <common>\nuniform sampler2D rakeMap;\nvarying vec2 vRakeUv;')
      .replace('#include <color_fragment>', 'vec4 rakeS = texture(rakeMap, vRakeUv);\ndiffuseColor.rgb *= rakeS.a;\n#include <color_fragment>')
      .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale;\n{ vec3 rn = rakeS.xyz * 2.0 - 1.0; mapN = normalize(vec3(mapN.xy + rn.xy, mapN.z * rn.z)); }')
      .replace('vec3 totalDiffuse =', 'reflectedLight.indirectDiffuse *= mix(0.55, 1.0, rakeS.a);\nvec3 totalDiffuse =')
  }
  mat.customProgramCacheKey = () => `${prevKey()}|rake`
  return mat
}

/** Tuiles de sable : 4×4 morceaux à trois niveaux de détail (le relief fin n'est utile que de près). */
const TILES = 4
const LOD_DIST = [7, 13]

export function GardenSand({ rocks }: { rocks: SandObstacle[] }) {
  const quality = useSettings((s) => s.quality)
  // `grid` : subdivisions d'une tuile au niveau le plus fin (Élevé ≈ 2,7 cm entre sommets)
  const res = quality === 'high' ? { tex: 2048, grid: 160 } : quality === 'medium' ? { tex: 1024, grid: 80 } : { tex: 1024, grid: 0 }
  const { lods, material, geos } = useMemo(() => {
    const rake = computeRake(res.tex, rocks)
    const { H, N, px } = rake
    const sample = (x: number, z: number) => {
      const fx = THREE.MathUtils.clamp((x - RAKE_AREA.x0) / px - 0.5, 0, N - 1.001)
      const fz = THREE.MathUtils.clamp((z - RAKE_AREA.z0) / px - 0.5, 0, N - 1.001)
      const i = Math.floor(fx), j = Math.floor(fz)
      const tx = fx - i, tz = fz - j
      const a = H[j * N + i], b = H[j * N + i + 1], c = H[(j + 1) * N + i], e = H[(j + 1) * N + i + 1]
      return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + e * tx) * tz
    }
    const material = sandMaterial(rake.tex)
    const w = (SAND.x1 - SAND.x0) / TILES
    const d = (SAND.z1 - SAND.z0) / TILES
    const geos: THREE.BufferGeometry[] = []
    /**
     * Tuile subdivisée, hauteur lue dans le champ (bilinéaire), normales verticales : l'ombrage fin
     * vient de la carte, la géométrie donne le relief réel des sillons. Une jupe de 3 cm sous les
     * bords masque les raccords entre tuiles de niveaux différents.
     */
    const tile = (cx: number, cz: number, seg: number) => {
      const segZ = Math.max(1, Math.round((seg * d) / w))
      const g = new THREE.PlaneGeometry(w, d, Math.max(1, seg), segZ)
      g.rotateX(-Math.PI / 2)
      g.translate(cx, 0, cz)
      const pos = g.attributes.position as THREE.BufferAttribute
      const cols = Math.max(1, seg) + 1
      const rows = segZ + 1
      const P: number[] = []
      const UV: number[] = []
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i)
        P.push(x, seg > 0 ? sample(x, z) : 0.008, z)
        UV.push(x, -z)
      }
      const idx: number[] = Array.from(g.index!.array)
      if (seg > 0) {
        const ring: number[] = []
        for (let c = 0; c < cols; c++) ring.push(c)
        for (let r = 1; r < rows; r++) ring.push(r * cols + cols - 1)
        for (let c = cols - 2; c >= 0; c--) ring.push((rows - 1) * cols + c)
        for (let r = rows - 2; r > 0; r--) ring.push(r * cols)
        const base = P.length / 3
        for (const v of ring) {
          P.push(P[v * 3], P[v * 3 + 1] - 0.03, P[v * 3 + 2])
          UV.push(UV[v * 2], UV[v * 2 + 1])
        }
        for (let k = 0; k < ring.length; k++) {
          const a = ring[k], b = ring[(k + 1) % ring.length]
          const a2 = base + k, b2 = base + ((k + 1) % ring.length)
          idx.push(a, a2, b, b, a2, b2, a, b, a2, b, b2, a2)
        }
      }
      g.dispose()
      const out = new THREE.BufferGeometry()
      out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
      out.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2))
      const nor = new Float32Array(P.length)
      for (let i = 1; i < nor.length; i += 3) nor[i] = 1
      out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
      out.setIndex(idx)
      out.computeBoundingSphere()
      geos.push(out)
      return out
    }
    const lods: THREE.LOD[] = []
    for (let tz = 0; tz < TILES; tz++)
      for (let tx = 0; tx < TILES; tx++) {
        const cx = SAND.x0 + (tx + 0.5) * w
        const cz = SAND.z0 + (tz + 0.5) * d
        const lod = new THREE.LOD()
        const levels = res.grid > 0 ? [res.grid, Math.round(res.grid / 3), Math.round(res.grid / 10)] : [0]
        levels.forEach((seg, i) => {
          const m = new THREE.Mesh(tile(cx, cz, seg), material)
          m.receiveShadow = true
          lod.addLevel(m, i === 0 ? 0 : LOD_DIST[i - 1])
        })
        // les géométries sont en coordonnées monde : la distance se mesure depuis le centre de la tuile
        lod.position.set(0, 0, 0)
        lod.levels.forEach((l) => l.object.position.set(0, 0, 0))
        lod.userData.center = new THREE.Vector3(cx, 0, cz)
        lods.push(lod)
      }
    return { lods, material, geos }
  }, [rocks, res.tex, res.grid])
  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose())
      material.dispose()
    },
    [geos, material],
  )
  return (
    <>
      {lods.map((l, i) => (
        <SandTile key={i} lod={l} />
      ))}
    </>
  )
}

/** LOD dont la distance est prise au centre de la tuile (ses sommets sont en coordonnées monde). */
function SandTile({ lod }: { lod: THREE.LOD }) {
  const center = lod.userData.center as THREE.Vector3
  useFrame(({ camera }) => {
    const dist = camera.position.distanceTo(center)
    let k = 0
    for (let i = 1; i < lod.levels.length; i++) if (dist >= lod.levels[i].distance) k = i
    lod.levels.forEach((l, i) => (l.object.visible = i === k))
  })
  useEffect(() => {
    lod.autoUpdate = false
  }, [lod])
  return <primitive object={lod} />
}
