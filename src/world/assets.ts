/**
 * Génération progressive des textures et création de la bibliothèque de matériaux
 * partagés (un seul programme GPU par type de surface).
 */
import * as THREE from 'three'
import * as G from '../textures/generators'
import { toTexture, nextFrame, JP_FONT, LATIN_FONT } from '../textures/util'
import type { Quality } from '../store/settings'
import { loadPbr, pbrParams, antiTile, type PbrId, type PbrOpts } from './pbr'

type TexKey =
  | 'planks' | 'planksN' | 'planksR'
  | 'grain' | 'grainN'
  | 'tatami' | 'tatamiN'
  | 'plaster' | 'plasterN' | 'plasterExt'
  | 'fabric' | 'fabricN'
  | 'shoji' | 'shojiE' | 'shojiN' | 'window' | 'windowE' | 'windowN' | 'andon' | 'andonE'
  | 'fusuma1' | 'fusuma2'
  | 'stoneBlocks' | 'stoneBlocksN' | 'stoneBlocksR'
  | 'stone' | 'stoneN'
  | 'roof' | 'roofN' | 'roofR'
  | 'ground' | 'groundN'
  | 'bark' | 'barkN'
  | 'gravel' | 'gravelN'
  | 'waterN' | 'noise'
  | 'fern' | 'leaf' | 'emblem'
  | 'lantern' | 'worldMap' | 'bookSpine'

export type Tex = Record<TexKey, THREE.Texture>

export interface Materials {
  planks: THREE.MeshStandardMaterial
  polished: THREE.MeshStandardMaterial
  tatami: THREE.MeshStandardMaterial
  woodDark: THREE.MeshStandardMaterial
  woodMid: THREE.MeshStandardMaterial
  woodLight: THREE.MeshStandardMaterial
  woodBlack: THREE.MeshStandardMaterial
  woodRed: THREE.MeshStandardMaterial
  plaster: THREE.MeshStandardMaterial
  plasterExt: THREE.MeshStandardMaterial
  ceiling: THREE.MeshStandardMaterial
  shoji: THREE.MeshStandardMaterial
  shojiLit: THREE.MeshStandardMaterial
  window: THREE.MeshStandardMaterial
  andon: THREE.MeshStandardMaterial
  fusuma1: THREE.MeshStandardMaterial
  fusuma2: THREE.MeshStandardMaterial
  stoneBlocks: THREE.MeshStandardMaterial
  stone: THREE.MeshStandardMaterial
  stoneWet: THREE.MeshStandardMaterial
  stoneDark: THREE.MeshStandardMaterial
  roof: THREE.MeshStandardMaterial
  roofUnder: THREE.MeshStandardMaterial
  ground: THREE.MeshStandardMaterial
  bark: THREE.MeshStandardMaterial
  gravel: THREE.MeshStandardMaterial
  vermilion: THREE.MeshStandardMaterial
  iron: THREE.MeshStandardMaterial
  bronze: THREE.MeshStandardMaterial
  gold: THREE.MeshStandardMaterial
  fabricDark: THREE.MeshStandardMaterial
  fabricIndigo: THREE.MeshStandardMaterial
  fabricRed: THREE.MeshStandardMaterial
  fabricOchre: THREE.MeshStandardMaterial
  fabricGreen: THREE.MeshStandardMaterial
  lanternPaper: THREE.MeshStandardMaterial
  flame: THREE.MeshBasicMaterial
  ember: THREE.MeshBasicMaterial
  wax: THREE.MeshStandardMaterial
  paperSheet: THREE.MeshStandardMaterial
  ink: THREE.MeshStandardMaterial
  ceramic: THREE.MeshStandardMaterial
  ceramicDark: THREE.MeshStandardMaterial
  rope: THREE.MeshStandardMaterial
  bamboo: THREE.MeshStandardMaterial
  moss: THREE.MeshStandardMaterial
  worldMap: THREE.MeshStandardMaterial
  books: THREE.MeshStandardMaterial
  emblemInk: THREE.MeshStandardMaterial
  emblemPaper: THREE.MeshStandardMaterial
  emblemGold: THREE.MeshStandardMaterial
}

let tex: Tex | null = null
let mats: Materials | null = null
export const T = () => tex!
export const M = () => mats!
export const assetsReady = () => mats !== null

const withRepeat = (t: THREE.Texture, rx: number, ry = rx) => {
  const c = t.clone()
  c.repeat.set(rx, ry)
  c.needsUpdate = true
  return c
}

export const CHARSET =
  '影の間秘書庫将棋弁論道場任務所評定書斎入門静寂庭奈良森王玉飛車角行金銀桂馬香歩兵龍成と全圭杏策心言和観報問志忍智静動臣従壱弐参肆伍陸漆捌玖火風雨水土雷国北木葉砂霧鹿灯月夜道'

let loading: Promise<void> | null = null
export function loadAssets(quality: Quality, progress: (p: number, label: string) => void) {
  if (!loading) loading = generate(quality, progress)
  return loading
}

async function generate(quality: Quality, progress: (p: number, label: string) => void) {
  if (mats) return
  const hi = quality === 'high'
  const lo = quality === 'low'
  const S = (n: number) => (lo ? n / 2 : n)
  // Chargement des polices nécessaires aux kanji dessinés sur canvas
  progress(0.02, 'Préparation des encres')
  try {
    await Promise.all([
      document.fonts.load(`800 64px ${JP_FONT}`, CHARSET),
      document.fonts.load(`500 64px ${JP_FONT}`, CHARSET),
      document.fonts.load(`600 24px ${LATIN_FONT}`, 'Konoha'),
      document.fonts.load(`italic 600 24px ${LATIN_FONT}`, 'Pays'),
    ])
  } catch {
    /* polices système de repli */
  }
  const t: Partial<Tex> = {}
  const steps: [string, () => void][] = [
    ['Rabotage des planchers', () => {
      const r = G.genPlanks(S(1024))
      t.planks = toTexture(r.map)
      t.planksN = toTexture(r.normal!, { srgb: false })
      t.planksR = toTexture(r.rough!, { srgb: false })
    }],
    ['Fil du bois', () => {
      const r = G.genGrain(S(512))
      t.grain = toTexture(r.map)
      t.grainN = toTexture(r.normal!, { srgb: false })
    }],
    ['Tressage des tatamis', () => {
      const r = G.genTatami(S(1024))
      t.tatami = toTexture(r.map)
      t.tatamiN = toTexture(r.normal!, { srgb: false })
    }],
    ['Enduits et papiers', () => {
      const r = G.genPlaster(S(512))
      t.plaster = toTexture(r.map)
      t.plasterN = toTexture(r.normal!, { srgb: false })
      t.plasterExt = toTexture(G.genPlaster(S(512), 43, 0xe2dccb).map)
      const f = G.genFabric(S(256))
      t.fabric = toTexture(f.map)
      t.fabricN = toTexture(f.normal!, { srgb: false })
      const s = G.genShoji(3, 6, 256, 512, 0.16)
      t.shoji = toTexture(s.map, { repeat: false })
      t.shojiE = toTexture(s.emissive!, { repeat: false })
      t.shojiN = toTexture(s.normal!, { repeat: false, srgb: false })
      const w = G.genShoji(4, 3, 256, 256, 0, 63)
      t.window = toTexture(w.map, { repeat: false })
      t.windowE = toTexture(w.emissive!, { repeat: false })
      t.windowN = toTexture(w.normal!, { repeat: false, srgb: false })
      const a = G.genShoji(2, 3, 128, 256, 0, 65)
      t.andon = toTexture(a.map, { repeat: false })
      t.andonE = toTexture(a.emissive!, { repeat: false })
    }],
    ['Peintures des fusuma', () => {
      t.fusuma1 = toTexture(G.genFusuma(72).map, { repeat: false })
      t.fusuma2 = toTexture(G.genFusuma(77).map, { repeat: false })
    }],
    ['Taille des pierres', () => {
      const r = G.genStoneBlocks(S(512))
      t.stoneBlocks = toTexture(r.map)
      t.stoneBlocksN = toTexture(r.normal!, { srgb: false })
      t.stoneBlocksR = toTexture(r.rough!, { srgb: false })
      const s = G.genStoneSurface(S(512))
      t.stone = toTexture(s.map)
      t.stoneN = toTexture(s.normal!, { srgb: false })
    }],
    ['Cuisson des tuiles', () => {
      const r = G.genRoofTiles(S(512))
      t.roof = toTexture(r.map)
      t.roofN = toTexture(r.normal!, { srgb: false })
      t.roofR = toTexture(r.rough!, { srgb: false })
    }],
    ['Sol de la forêt', () => {
      const r = G.genForestGround(S(1024))
      t.ground = toTexture(r.map)
      t.groundN = toTexture(r.normal!, { srgb: false })
      const b = G.genBark()
      t.bark = toTexture(b.map)
      t.barkN = toTexture(b.normal!, { srgb: false })
    }],
    ['Ratissage du gravier', () => {
      const r = G.genGravel(S(1024))
      t.gravel = toTexture(r.map)
      t.gravelN = toTexture(r.normal!, { srgb: false })
      t.waterN = toTexture(G.genWaterNormal(256).map, { srgb: false })
      t.noise = toTexture(G.genNoiseMask(256).map, { srgb: false })
    }],
    ['Feuillages et emblèmes', () => {
      t.fern = toTexture(G.genFern().map, { repeat: false })
      t.leaf = toTexture(G.genMapleLeaf().map, { repeat: false })
      t.emblem = toTexture(G.genEmblem(hi ? 1024 : 512).map, { repeat: false })
      t.lantern = toTexture(G.genLanternPaper().map)
      t.bookSpine = toTexture(G.genBookSpine().map, { repeat: false })
    }],
    ['Cartographie du monde shinobi', () => {
      t.worldMap = toTexture(G.genWorldMap(lo ? 768 : 1024, lo ? 480 : 640).map, { repeat: false })
    }],
  ]
  for (let i = 0; i < steps.length; i++) {
    progress(0.05 + (i / steps.length) * 0.75, steps[i][0])
    await nextFrame()
    steps[i][1]()
  }
  tex = t as Tex
  progress(0.8, 'Textures haute définition')
  await loadPbr(quality, (f) => progress(0.8 + f * 0.12, 'Textures haute définition'))
  progress(0.93, 'Préparation des matériaux')
  await nextFrame()
  mats = buildMaterials(tex)
}

function std(p: THREE.MeshStandardMaterialParameters) {
  return new THREE.MeshStandardMaterial(p)
}

/** Matériau PBR photographique si le jeu est chargé, sinon repli procédural. */
function pbrOr(id: PbrId, o: PbrOpts, fallback: THREE.MeshStandardMaterialParameters, extra: THREE.MeshStandardMaterialParameters = {}) {
  const p = pbrParams(id, o)
  const m = std(p ? { ...p, ...extra } : { ...fallback, ...extra })
  if (p && o.antiTile) antiTile(m)
  return m
}

/** Pièce dressée (bois, pierre taillée) : arêtes chanfreinées (12 mm par défaut) et fil orienté selon la longueur ('u' : lames horizontales). */
function woodPiece<T extends THREE.Material>(m: T, chamfer = 0.012, grain: 'u' | 'v' = 'v') {
  m.userData.chamfer = chamfer
  m.userData.grain = grain
  return m
}

function buildMaterials(t: Tex): Materials {
  const grain = (color: number, rough = 0.7, rep = 1) =>
    woodPiece(
      pbrOr(
        'oak_veneer_01',
        { color, roughness: Math.min(1, rough * 1.25), normalScale: 1.2 },
        { color, map: withRepeat(t.grain, rep), normalMap: withRepeat(t.grainN, rep), normalScale: new THREE.Vector2(0.4, 0.4), roughness: rough },
      ),
    )
  const fabric = (color: number) =>
    std({ color, map: withRepeat(t.fabric, 3), normalMap: withRepeat(t.fabricN, 3), normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.95 })
  const emblemMat = (color: number, emissive = 0x000000, ei = 0) =>
    std({ color, alphaMap: t.emblem, transparent: true, depthWrite: false, roughness: 0.6, emissive, emissiveIntensity: ei, polygonOffset: true, polygonOffsetFactor: -2 })

  return {
    planks: woodPiece(
      pbrOr('hinoki_planks', { color: 0xd9c3a8, antiTile: true }, { map: withRepeat(t.planks, 0.5), normalMap: withRepeat(t.planksN, 0.5), roughnessMap: withRepeat(t.planksR, 0.5), roughness: 1, color: 0xffffff }),
      0.004,
      'u',
    ),
    polished: woodPiece(
      pbrOr(
        'hinoki_planks',
        { color: 0x9a8270, roughness: 0.5, normalScale: 0.6, antiTile: true },
        { map: withRepeat(t.planks, 0.33), normalMap: withRepeat(t.planksN, 0.33), roughnessMap: withRepeat(t.planksR, 0.33), roughness: 0.42, color: 0xd8c8b8, normalScale: new THREE.Vector2(0.5, 0.5) },
      ),
      0.004,
      'u',
    ),
    tatami: pbrOr('tatami_mat', { color: 0xf2ead6, normalScale: 1.1 }, { map: withRepeat(t.tatami, 1 / 3.6), normalMap: withRepeat(t.tatamiN, 1 / 3.6), roughness: 0.92, color: 0xe2d8bc }),
    woodDark: grain(0x6e5242, 0.68),
    woodMid: grain(0x9c7456, 0.65),
    woodLight: grain(0xdab27c, 0.55),
    woodBlack: grain(0x3c312b, 0.42),
    woodRed: grain(0x8f4433, 0.6),
    plaster: pbrOr(
      'white_plaster_02',
      { color: 0xd9c9ab, normalScale: 1.1, size: 1.4, antiTile: true },
      { map: withRepeat(t.plaster, 0.5), normalMap: withRepeat(t.plasterN, 0.5), normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.95, color: 0xd8ccb2 },
    ),
    plasterExt: pbrOr(
      'white_plaster_02',
      { color: 0xece5d6, normalScale: 0.9, size: 1.6, antiTile: true },
      { map: withRepeat(t.plasterExt, 0.5), normalMap: withRepeat(t.plasterN, 0.5), normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.92, color: 0xe6dfcf },
    ),
    ceiling: grain(0x52402f, 0.8, 0.6),
    // papier washi : relief du kumiko et des fibres, lumière transmise modérée (diffusion, pas néon)
    shoji: std({ map: t.shoji, normalMap: t.shojiN, normalScale: new THREE.Vector2(0.8, 0.8), emissiveMap: t.shojiE, emissive: 0xffb469, emissiveIntensity: 0.1, roughness: 0.88, side: THREE.DoubleSide }),
    shojiLit: std({ map: t.shoji, normalMap: t.shojiN, normalScale: new THREE.Vector2(0.8, 0.8), emissiveMap: t.shojiE, emissive: 0xffa95a, emissiveIntensity: 0.55, roughness: 0.88, side: THREE.DoubleSide }),
    window: std({ map: t.window, normalMap: t.windowN, normalScale: new THREE.Vector2(0.8, 0.8), emissiveMap: t.windowE, emissive: 0xff9a45, emissiveIntensity: 0.62, roughness: 0.88 }),
    // papiers de lanternes : diffus sombre (leur propre lumière, toute proche, ne les blanchit plus), éclat ambré porté par l'émissif
    andon: std({ map: t.andon, color: 0x5a5044, emissiveMap: t.andonE, emissive: 0xffa452, emissiveIntensity: 1.2, roughness: 0.9, side: THREE.DoubleSide }),
    fusuma1: std({ map: t.fusuma1, roughness: 0.85 }),
    fusuma2: std({ map: t.fusuma2, roughness: 0.85 }),
    stoneBlocks: std({ map: withRepeat(t.stoneBlocks, 1 / 3), normalMap: withRepeat(t.stoneBlocksN, 1 / 3), roughnessMap: withRepeat(t.stoneBlocksR, 1 / 3), roughness: 1, color: 0xd0ccc4 }),
    stone: woodPiece(pbrOr('stone_carved', { color: 0xd2cec6, size: 1.4, normalScale: 0.7 }, { map: withRepeat(t.stone, 0.6), normalMap: withRepeat(t.stoneN, 0.6), roughness: 0.82, color: 0xc4c0b8 }), 0.01),
    stoneWet: woodPiece(pbrOr('stone_carved', { color: 0x7d7973, roughness: 0.72, size: 1.4, normalScale: 0.8 }, { map: withRepeat(t.stone, 0.8), normalMap: withRepeat(t.stoneN, 0.8), roughness: 0.32, color: 0x77736c, normalScale: new THREE.Vector2(0.8, 0.8) }), 0.01),
    stoneDark: woodPiece(pbrOr('stone_carved', { color: 0x7a766f, size: 1.4, normalScale: 0.7 }, { map: withRepeat(t.stone, 0.8), normalMap: withRepeat(t.stoneN, 0.8), roughness: 0.55, color: 0x625e5a }), 0.01),
    roof: pbrOr(
      'grey_roof_tiles',
      { color: 0x8e949c, normalScale: 1.6, size: 2.4, antiTile: true },
      { map: withRepeat(t.roof, 1 / 1.2), normalMap: withRepeat(t.roofN, 1 / 1.2), roughnessMap: withRepeat(t.roofR, 1 / 1.2), roughness: 1, color: 0x9da2a8 },
    ),
    roofUnder: grain(0x4f3d30, 0.85, 0.5),
    ground: std({ map: withRepeat(t.ground, 0.1), normalMap: withRepeat(t.groundN, 0.1), roughness: 0.96, color: 0xd8ccbc }),
    bark: std({ map: withRepeat(t.bark, 1, 0.25), normalMap: withRepeat(t.barkN, 1, 0.25), roughness: 0.95, color: 0xb59e8c }),
    gravel: pbrOr(
      'sandy_gravel',
      { color: 0xd6d0c4, normalScale: 1, antiTile: true },
      { map: withRepeat(t.gravel, 0.25), normalMap: withRepeat(t.gravelN, 0.25), roughness: 0.95, color: 0xb2aca0 },
    ),
    vermilion: grain(0xa8452f, 0.62),
    iron: std({ color: 0x2c2a28, metalness: 0.75, roughness: 0.55 }),
    bronze: std({ color: 0x4a3b28, metalness: 0.8, roughness: 0.45 }),
    gold: std({ color: 0xa88447, metalness: 1, roughness: 0.32 }),
    fabricDark: fabric(0x2c3036),
    fabricIndigo: fabric(0x2e3d55),
    fabricRed: fabric(0x76302a),
    fabricOchre: fabric(0xa07a42),
    fabricGreen: fabric(0x45594c),
    lanternPaper: std({ map: withRepeat(t.lantern, 1), color: 0x3a3028, emissiveMap: withRepeat(t.lantern, 1), emissive: 0xff8a2e, emissiveIntensity: 1.45, roughness: 0.9, side: THREE.DoubleSide }),
    flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb35c).multiplyScalar(3), toneMapped: false }),
    ember: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff6a2a).multiplyScalar(2.2), toneMapped: false }),
    wax: std({ color: 0xd9ceb4, roughness: 0.6, emissive: 0x6b3a12, emissiveIntensity: 0.25 }),
    paperSheet: std({ color: 0xd8ccb0, roughness: 0.95, side: THREE.DoubleSide }),
    ink: std({ color: 0x0f0e0d, roughness: 0.4 }),
    ceramic: std({ color: 0x8c8172, roughness: 0.35 }),
    ceramicDark: std({ color: 0x2b2826, roughness: 0.3 }),
    rope: std({ color: 0xa8916a, roughness: 1 }),
    bamboo: std({ color: 0x8a8a52, roughness: 0.5 }),
    moss: std({ color: 0x34452d, roughness: 1 }),
    worldMap: std({ map: t.worldMap, roughness: 0.9 }),
    books: std({ map: t.bookSpine, roughness: 0.8 }),
    emblemInk: emblemMat(0x0b0b0c),
    emblemPaper: emblemMat(0xdcd4bf),
    emblemGold: emblemMat(0xc49a55, 0x6b4a1c, 0.3),
  }
}

/* ------------------------------------------------------------------ */
/* Cache de textures dessinées à la demande (calligraphies, bannières)  */
/* ------------------------------------------------------------------ */
const dyn = new Map<string, THREE.Texture>()
export function dynamicTexture(key: string, make: () => HTMLCanvasElement, repeat = false) {
  let t = dyn.get(key)
  if (!t) {
    t = toTexture(make(), { repeat })
    dyn.set(key, t)
  }
  return t
}
const dynMat = new Map<string, THREE.Material>()
export function cachedMaterial<T extends THREE.Material>(key: string, make: () => T): T {
  let m = dynMat.get(key) as T | undefined
  if (!m) {
    m = make()
    dynMat.set(key, m)
  }
  return m
}

export const kakejikuMat = (text: string, seed = 3, opts: { sub?: string; ink?: boolean } = {}) =>
  cachedMaterial(`kake:${text}:${seed}:${opts.sub ?? ''}:${opts.ink ? 1 : 0}`, () =>
    std({ map: dynamicTexture(`kake:${text}:${seed}:${opts.sub}:${opts.ink}`, () => G.genKakejiku(text, { seed, ...opts }).map), roughness: 0.85, side: THREE.DoubleSide }),
  )

export const bannerMat = (key: string, content: { emblem?: boolean; kanji?: string; sub?: string }, base?: string, ink?: string, aspect?: number) =>
  cachedMaterial(`banner:${key}`, () =>
    std({ map: dynamicTexture(`banner:${key}`, () => G.genBanner(content, key.length * 13, base, ink, aspect).map), roughness: 0.92, side: THREE.DoubleSide }),
  )

export const makuMat = (key: string, count: number, aspect: number, base?: string, ink?: string) =>
  cachedMaterial(`maku:${key}`, () =>
    std({ map: dynamicTexture(`maku:${key}`, () => G.genMaku(count, aspect, key.length * 17, base, ink).map), roughness: 0.92, side: THREE.DoubleSide }),
  )

export const inkPanelMat =(seed: number, opts: G.InkOpts = {}, w = 512, h = 512) =>
  cachedMaterial(`ink:${seed}:${JSON.stringify(opts)}:${w}x${h}`, () =>
    std({ map: dynamicTexture(`ink:${seed}:${JSON.stringify(opts)}:${w}x${h}`, () => G.genInkPanel(w, h, { seed, ...opts }).map), roughness: 0.85, side: THREE.DoubleSide }),
  )

export const shadowPanelMat = (seed: number) =>
  cachedMaterial(`shadowpanel:${seed}`, () => std({ map: dynamicTexture(`shadowpanel:${seed}`, () => G.genShadowPanel(seed).map), roughness: 0.88 }))

export const handwritingMat = (seed: number, title?: string) =>
  cachedMaterial(`hand:${seed}:${title ?? ''}`, () =>
    std({ map: dynamicTexture(`hand:${seed}:${title ?? ''}`, () => G.genHandwriting(seed, 512, 384, title).map), roughness: 0.92, side: THREE.DoubleSide }),
  )

// Les matériaux sont des singletons : toute modification de ce module recharge la page.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
