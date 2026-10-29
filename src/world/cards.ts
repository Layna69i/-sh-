/**
 * Feuillage en cartes instanciées (plumets de cryptomère, éventails de bambou) et vent d'arbre
 * partagé par le bois et les cartes. Le déplacement est calculé après l'instanciation, à partir du
 * pied de l'arbre et de la hauteur relative, avec la même formule pour l'écorce et le feuillage :
 * tronc, branches et feuilles bougent ensemble. Atlas de 2 × 2 cases (1024 px) ; chaque dessin part
 * du bas de sa case, qui s'ancre sur le rameau.
 */
import * as THREE from 'three'
import { cachedMaterial } from './assets'
import { windUniforms } from './wind'

/** Vent d'un arbre : amplitude au sommet (m), vitesse relative, frémissement propre aux cartes (m). */
export type TreeWind = readonly [amp: number, speed: number, flutter: number]

/** Cartes d'un gabarit, dans son repère (pied de l'arbre à l'origine). */
export interface CardSet {
  cards: THREE.Matrix4[]
  colors: THREE.Color[]
  /** coin de la case d'atlas (u, v) de chaque carte */
  cells: number[]
}

const WIND = /* glsl */ `
uniform float uTime;
uniform vec3 uWind;
vec3 treeWind(vec3 base, float h) {
  float ph = base.x * 0.21 + base.z * 0.17;
  float t = uTime * uWind.y;
  float k = clamp(h, 0.0, 1.2);
  k *= k;
  return vec3(sin(t * 0.55 + ph) * 0.7 + sin(t * 1.6 + ph * 1.7) * 0.3, 0.0, cos(t * 0.45 + ph * 1.3) * 0.55) * uWind.x * k;
}
`
/** Déplacement appliqué après l'instanciation (espace du maillage = monde pour la forêt et les abords). */
const projectWithWind = (offset: string) =>
  THREE.ShaderChunk.project_vertex.replace('mvPosition = modelViewMatrix * mvPosition;', `mvPosition.xyz += ${offset};\n\tmvPosition = modelViewMatrix * mvPosition;`)

const windUniformsFor = (wind: TreeWind) => ({ uTime: windUniforms.uTime, uWind: { value: new THREE.Vector3(...wind) } })

/**
 * Ajoute le vent d'arbre à un matériau de bois instancié (une instance = un arbre).
 * `height` : expression GLSL de la hauteur relative du sommet (0 au pied, 1 en haut).
 */
export function windy<T extends THREE.Material>(mat: T, key: string, wind: TreeWind, height: string) {
  const prev = mat.onBeforeCompile
  const uniforms = windUniformsFor(wind)
  mat.onBeforeCompile = (sh, renderer) => {
    prev.call(mat, sh, renderer)
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND}`)
      .replace('#include <project_vertex>', projectWithWind(`treeWind(instanceMatrix[3].xyz, ${height})`))
  }
  mat.customProgramCacheKey = () => key
  return mat
}

const CARD_HEAD = /* glsl */ `
attribute vec4 aTree;
attribute vec2 aCell;
${WIND}
`
const CARD_OFFSET = /* glsl */ `
vec3 cardOffset;
{
  vec4 wp = instanceMatrix * vec4(transformed, 1.0);
  cardOffset = treeWind(aTree.xyz, (wp.y - aTree.y) / aTree.w);
  // frémissement propre à chaque carte (la pointe bouge plus que l'attache)
  float cp = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 2.3;
  cardOffset += vec3(sin(uTime * 3.3 + cp * 1.7) * 0.5, sin(uTime * 2.7 + cp), 0.0) * uWind.z * uv.y;
}
`
const CELL_UV = '#ifdef USE_MAP\nvMapUv += aCell;\n#endif'
/** Les cartes lointaines se dessinent à des niveaux de mipmap élevés où l'alpha moyenné fond :
 *  on le renforce selon le niveau pour garder un feuillage dense au loin. */
const ALPHA_KEEP = /* glsl */ `
#ifdef USE_MAP
{
  vec2 g = fwidth(vMapUv) * 1024.0;
  float lod = max(0.0, log2(max(g.x, g.y)));
  diffuseColor.a = min(1.0, diffuseColor.a * (1.0 + lod * 0.3));
}
#endif
`

export interface CardLook {
  roughness: number
  envMapIntensity: number
  /** lumière transmise ajoutée (feuilles fines : pas de faces noires à contre-jour) */
  glow: number
  /** part de la normale tirée vers l'extérieur de l'arbre (la couronne s'éclaire comme un volume) */
  bend: number
}

export function cardMaterial(key: string, atlas: THREE.Texture, wind: TreeWind, look: CardLook) {
  return cachedMaterial(key, () => {
    const uniforms = windUniformsFor(wind)
    const mat = new THREE.MeshStandardMaterial({
      map: atlas,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: look.roughness,
      metalness: 0,
      envMapIntensity: look.envMapIntensity,
    })
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms)
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${CARD_HEAD}`)
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
{
  // normale tirée vers l'extérieur du tronc et vers le haut
  vec3 ip = instanceMatrix[3].xyz;
  vec3 outward = normalize(vec3(ip.x - aTree.x, 0.0, ip.z - aTree.z) + vec3(0.0, 0.55, 0.0));
  vec3 localOut = normalize(transpose(mat3(instanceMatrix)) * outward);
  objectNormal = normalize(mix(objectNormal, localOut, ${look.bend.toFixed(2)}));
}`,
        )
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${CARD_OFFSET}`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>\n${CELL_UV}`)
        .replace('#include <project_vertex>', projectWithWind('cardOffset'))
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <alphatest_fragment>', `${ALPHA_KEEP}\n#include <alphatest_fragment>`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * ${look.glow.toFixed(3)};`)
    }
    mat.customProgramCacheKey = () => key
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: 0.5, side: THREE.DoubleSide })
    depth.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms)
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${CARD_HEAD}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${CARD_OFFSET}`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>\n${CELL_UV}`)
        .replace('#include <project_vertex>', projectWithWind('cardOffset'))
      sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', `${ALPHA_KEEP}\n#include <alphatest_fragment>`)
    }
    depth.customProgramCacheKey = () => `${key}-depth`
    mat.userData.depth = depth
    return mat
  })
}

/**
 * Feuillage d'un ensemble d'arbres d'un même gabarit, en un seul maillage instancié.
 * `trees` : matrices des arbres (pied au sol) ; `tints` : teinte de chaque arbre ;
 * `height` : hauteur du gabarit, référence du vent.
 */
export function cardMesh(set: CardSet, trees: THREE.Matrix4[], tints: THREE.Color[], mat: THREE.MeshStandardMaterial, height: number) {
  const cards: THREE.Matrix4[] = []
  const colors: THREE.Color[] = []
  const cells: number[] = []
  const feet: number[] = []
  const base = new THREE.Vector3()
  const sc = new THREE.Vector3()
  trees.forEach((T, ti) => {
    base.setFromMatrixPosition(T)
    sc.setFromMatrixScale(T)
    for (let i = 0; i < set.cards.length; i++) {
      cards.push(new THREE.Matrix4().multiplyMatrices(T, set.cards[i]))
      colors.push(set.colors[i].clone().multiply(tints[ti]))
      cells.push(set.cells[i * 2], set.cells[i * 2 + 1])
      feet.push(base.x, base.y, base.z, height * sc.y)
    }
  })
  return looseCardMesh({ cards, colors, cells }, feet, mat)
}

/**
 * Cartes déjà placées dans l'espace du maillage, chacune rattachée à son propre pied
 * (`feet` : x, y, z du pied et hauteur de référence, 4 valeurs par carte) — haies, buissons.
 */
export function looseCardMesh(set: CardSet, feet: number[], mat: THREE.MeshStandardMaterial) {
  const card = new THREE.PlaneGeometry(1, 1)
  card.translate(0, 0.38, 0) // le dessin part du bas de la carte : elle s'ancre sur le rameau
  const uvs = card.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * 0.5, uvs.getY(i) * 0.5)
  const count = set.cards.length
  const mesh = new THREE.InstancedMesh(card, mat, Math.max(1, count))
  mesh.count = count
  set.cards.forEach((m, k) => {
    mesh.setMatrixAt(k, m)
    mesh.setColorAt(k, set.colors[k])
  })
  const pad = (a: number[], n: number) => new Float32Array(a.length ? a : new Array(n).fill(0))
  card.setAttribute('aCell', new THREE.InstancedBufferAttribute(pad(set.cells, 2), 2))
  card.setAttribute('aTree', new THREE.InstancedBufferAttribute(pad(feet, 4), 4))
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.customDepthMaterial = mat.userData.depth as THREE.MeshDepthMaterial
  mesh.computeBoundingSphere()
  return mesh
}
