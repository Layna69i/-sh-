import * as THREE from 'three'

/** Uniformes partagés pour le vent (feuillages, bannières, herbes). */
export const windUniforms = { uTime: { value: 0 } }

/**
 * Injecte une oscillation de vent dans un matériau standard.
 * L'amplitude croît avec la hauteur locale (y) du sommet.
 */
export function applyWind(mat: THREE.Material, strength = 0.15, heightRef = 10, freq = 1) {
  const m = mat as THREE.MeshStandardMaterial
  const key = `wind-${strength}-${heightRef}-${freq}`
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float hk = clamp(position.y / ${heightRef.toFixed(2)}, 0.0, 1.0);
          hk *= hk;
          float ph = ip.x * 0.21 + ip.z * 0.17;
          float t = uTime * ${freq.toFixed(2)};
          transformed.x += (sin(t * 0.9 + ph) * 0.7 + sin(t * 2.3 + ph * 1.7) * 0.3) * ${strength.toFixed(3)} * hk;
          transformed.z += (cos(t * 0.7 + ph * 1.3) * 0.6) * ${strength.toFixed(3)} * hk * 0.6;
        }`,
      )
  }
  m.customProgramCacheKey = () => key
  m.needsUpdate = true
  return m
}

/** Tissu suspendu (bannières, noren) : le haut est fixe, le bas ondule (uv.y = 1 en haut). */
export function applyCloth(mat: THREE.Material, strength = 0.12, freq = 1.4) {
  const m = mat as THREE.MeshStandardMaterial
  const key = `cloth-${strength}-${freq}`
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float hang = pow(1.0 - uv.y, 1.4);
          vec3 wp = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float ph = wp.x * 0.37 + wp.z * 0.23;
          float t = uTime * ${freq.toFixed(2)};
          transformed.z += (sin(t + ph + uv.y * 3.0) * 0.7 + sin(t * 2.7 + ph + uv.x * 4.0) * 0.3) * ${strength.toFixed(3)} * hang;
          transformed.x += sin(t * 0.8 + ph) * ${strength.toFixed(3)} * 0.3 * hang;
        }`,
      )
  }
  m.customProgramCacheKey = () => key
  m.needsUpdate = true
  return m
}
