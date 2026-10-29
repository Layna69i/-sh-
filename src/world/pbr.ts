/**
 * Textures PBR photographiques (Poly Haven, CC0 — voir public/textures/pbr/CREDITS.md).
 * Chargées selon le profil graphique : Élevé = albédo et normale 2K, Moyen = 1K, Bas = aucune
 * (les textures procédurales légères restent utilisées). La carte ARM regroupe occlusion (R),
 * rugosité (G) et métal (B), en 1K partout : ces signaux sont de basse fréquence.
 * Les UV du décor sont en mètres : la répétition d'un jeu vaut 1 / sa taille réelle.
 */
import * as THREE from 'three'
import { QUALITY, type Quality } from '../store/settings'

/** Taille réelle couverte par une tuile de texture, en mètres (métadonnées Poly Haven). */
export const PBR_SIZE = {
  sandy_gravel: 2.1,
  white_plaster_02: 1.0,
  oak_veneer_01: 1.83,
  hinoki_planks: 1.89,
  tatami_mat: 1.8,
  lichen_rock: 2.0,
  mossy_rock: 3.0,
  trident_maple_bark: 1.8,
  grey_roof_tiles: 3.0,
  rough_linen: 0.27,
  stone_carved: 2.0,
  /** 1 m de large × 2 m de haut (texture 1:2, voir `aspect`) */
  japanese_cedar_bark: 1.0,
  pine_bark: 2.0,
} as const

export type PbrId = keyof typeof PBR_SIZE

export interface PbrSet {
  map: THREE.Texture
  normalMap: THREE.Texture
  arm: THREE.Texture
}

let lib: Partial<Record<PbrId, PbrSet>> = {}
let tierLoaded: '2k' | '1k' | null = null
/** Résolution des textures réellement chargées (fixée au démarrage de la page). */
export const loadedTier = () => tierLoaded
/** Jeux chargés (vide en profil Bas ou si le réseau a échoué : on garde alors le procédural). */
export const PBR = () => lib

export const pbrTier = (q: Quality) => QUALITY[q].textures

export async function loadPbr(quality: Quality, progress: (f: number) => void) {
  const tier = pbrTier(quality)
  tierLoaded = tier
  if (!tier) return
  const loader = new THREE.TextureLoader()
  const base = `${import.meta.env.BASE_URL}textures/pbr`
  const aniso = quality === 'high' ? 16 : 8 // three plafonne à la valeur permise par le GPU
  const ids = Object.keys(PBR_SIZE) as PbrId[]
  let done = 0
  const total = ids.length * 3
  const one = (url: string, srgb: boolean) =>
    loader.loadAsync(url).then((t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = aniso
      t.generateMipmaps = true
      t.minFilter = THREE.LinearMipmapLinearFilter
      t.magFilter = THREE.LinearFilter
      progress(++done / total)
      return t
    })
  const sets = await Promise.allSettled(
    ids.map(async (id) => {
      const [map, normalMap, arm] = await Promise.all([
        one(`${base}/${id}/albedo_${tier}.jpg`, true),
        one(`${base}/${id}/normal_${tier}.jpg`, false),
        one(`${base}/${id}/arm_1k.jpg`, false),
      ])
      return [id, { map, normalMap, arm }] as const
    }),
  )
  const out: Partial<Record<PbrId, PbrSet>> = {}
  for (const s of sets) {
    if (s.status === 'fulfilled') out[s.value[0]] = s.value[1]
    else console.warn('[pbr] texture indisponible, repli procédural :', s.reason)
  }
  lib = out
}

/** Clone partageant l'image (une seule copie en mémoire GPU) avec sa propre répétition. */
function rep(t: THREE.Texture, r: number, ry = r) {
  const c = t.clone()
  c.repeat.set(r, ry)
  c.needsUpdate = true
  return c
}

export interface PbrOpts {
  color?: THREE.ColorRepresentation
  /** multiplie la rugosité lue dans la carte (0,4 = bois ciré) */
  roughness?: number
  normalScale?: number
  aoIntensity?: number
  /** taille d'une tuile en mètres (par défaut la taille réelle du jeu) */
  size?: number
  /** étirement relatif (ex. [1, 4] : fibres d'écorce allongées) */
  aspect?: [number, number]
  side?: THREE.Side
  /** casse la répétition visible des grandes surfaces */
  antiTile?: boolean
}

/** Paramètres d'un MeshStandardMaterial PBR pour le jeu `id`, ou null s'il n'est pas chargé. */
export function pbrParams(id: PbrId, o: PbrOpts = {}): THREE.MeshStandardMaterialParameters | null {
  const s = lib[id]
  if (!s) return null
  const size = o.size ?? PBR_SIZE[id]
  const [ax, ay] = o.aspect ?? [1, 1]
  const rx = 1 / (size * ax)
  const ry = 1 / (size * ay)
  const arm = rep(s.arm, rx, ry)
  return {
    color: o.color ?? 0xffffff,
    map: rep(s.map, rx, ry),
    normalMap: rep(s.normalMap, rx, ry),
    normalScale: new THREE.Vector2(o.normalScale ?? 1, o.normalScale ?? 1),
    roughnessMap: arm,
    roughness: o.roughness ?? 1,
    aoMap: arm,
    aoMapIntensity: o.aoIntensity ?? 1,
    metalness: 0,
    ...(o.side !== undefined ? { side: o.side } : {}),
  }
}

export function pbrMaterial(id: PbrId, o: PbrOpts = {}) {
  const p = pbrParams(id, o)
  if (!p) return null
  const m = new THREE.MeshStandardMaterial(p)
  if (o.antiTile) antiTile(m)
  return m
}

/* ------------------------------------------------------------------ */
/* Anti-répétition (méthode d'Inigo Quilez, « texture repetition » n°3) :
 * chaque carte est lue deux fois avec des décalages pseudo-aléatoires choisis
 * par un bruit de basse fréquence, puis mêlée ; une variation de teinte à grande
 * échelle achève de masquer la grille des tuiles. Coût : 2 lectures par carte.  */
/* ------------------------------------------------------------------ */
const AT_HEADER = /* glsl */ `
float atHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float atNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(atHash(i), atHash(i + vec2(1.0, 0.0)), f.x), mix(atHash(i + vec2(0.0, 1.0)), atHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec4 atSample(sampler2D s, vec2 uv) {
  float k = atNoise(uv * 1.3) * 8.0;
  float i = floor(k);
  float f = fract(k);
  vec2 oa = sin(vec2(3.0, 7.0) * i);
  vec2 ob = sin(vec2(3.0, 7.0) * (i + 1.0));
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec4 a = textureGrad(s, uv + oa, dx, dy);
  vec4 b = textureGrad(s, uv + ob, dx, dy);
  return mix(a, b, smoothstep(0.2, 0.8, f - 0.1 * dot(a.rgb - b.rgb, vec3(1.0))));
}
`

export function antiTile(mat: THREE.MeshStandardMaterial, macro = 0.12) {
  const prev = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey.bind(mat)
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer)
    const C = THREE.ShaderChunk
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${AT_HEADER}`)
      .replace(
        '#include <map_fragment>',
        C.map_fragment.replace('texture2D( map, vMapUv )', 'atSample( map, vMapUv )') +
          `\n#ifdef USE_MAP\n diffuseColor.rgb *= mix(${(1 - macro).toFixed(3)}, ${(1 + macro * 0.5).toFixed(3)}, atNoise(vMapUv * 0.19) * 0.6 + atNoise(vMapUv * 0.047) * 0.4);\n#endif`,
      )
      .replace('#include <normal_fragment_maps>', C.normal_fragment_maps.split('texture2D( normalMap, vNormalMapUv )').join('atSample( normalMap, vNormalMapUv )'))
      .replace('#include <roughnessmap_fragment>', C.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', 'atSample( roughnessMap, vRoughnessMapUv )'))
      .replace('#include <aomap_fragment>', C.aomap_fragment.replace('texture2D( aoMap, vAoMapUv )', 'atSample( aoMap, vAoMapUv )'))
  }
  mat.customProgramCacheKey = () => `${prevKey()}|antitile${macro}`
  mat.needsUpdate = true
  return mat
}
