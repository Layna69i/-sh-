import { useEffect, useMemo, useRef, type JSX } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette, ToneMapping, N8AO, SMAA } from '@react-three/postprocessing'
import { ToneMappingMode, SMAAPreset, ShaderPass, type VignetteEffect } from 'postprocessing'
import { useSettings, QUALITY } from '../store/settings'
import { useGame } from '../store/game'
import { damp } from '../core/math'

/**
 * Passe de finition, appliquée à l'image déjà tonemappée, dans une passe à part (elle lit les
 * pixels voisins) :
 * - accentuation adaptative au contraste (d'après AMD FidelityFX CAS) : renforce les détails
 *   doux sans surligner les bords déjà nets ni créer de halos ;
 * - étalonnage léger : contraste en S autour du gris moyen (en espace perceptuel) et saturation,
 *   pour des noirs denses et des lumières ambrées plutôt qu'une image délavée.
 * (Les effets de contraste et de saturation de la chaîne fusionnée s'appliquaient avant le tone
 * mapping et faisaient déborder les hautes lumières en taches blanches.)
 */
function finishPass(sharpness: number, contrast: number, saturation: number) {
  const material = new THREE.ShaderMaterial({
    uniforms: { inputBuffer: { value: null }, sharpness: { value: sharpness }, contrast: { value: contrast }, saturation: { value: saturation } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D inputBuffer;
      uniform float sharpness, contrast, saturation;
      varying vec2 vUv;
      void main() {
        vec2 px = 1.0 / vec2(textureSize(inputBuffer, 0));
        vec4 c4 = texture2D(inputBuffer, vUv);
        vec3 c = clamp(c4.rgb, 0.0, 1.0);
        if (sharpness > 0.0) {
          vec3 n = clamp(texture2D(inputBuffer, vUv + vec2(0.0, px.y)).rgb, 0.0, 1.0);
          vec3 s = clamp(texture2D(inputBuffer, vUv - vec2(0.0, px.y)).rgb, 0.0, 1.0);
          vec3 e = clamp(texture2D(inputBuffer, vUv + vec2(px.x, 0.0)).rgb, 0.0, 1.0);
          vec3 w = clamp(texture2D(inputBuffer, vUv - vec2(px.x, 0.0)).rgb, 0.0, 1.0);
          vec3 mn = min(c, min(min(n, s), min(e, w)));
          vec3 mx = max(c, max(max(n, s), max(e, w)));
          vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));
          vec3 wgt = -amp / mix(8.0, 5.0, sharpness);
          c = clamp((c + (n + s + e + w) * wgt) / (1.0 + 4.0 * wgt), 0.0, 1.0);
        }
        vec3 g = pow(c, vec3(1.0 / 2.2));
        g = clamp((g - 0.5) * (1.0 + contrast) + 0.5, 0.0, 1.0);
        c = pow(g, vec3(2.2));
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = clamp(mix(vec3(l), c, 1.0 + saturation), 0.0, 1.0);
        gl_FragColor = vec4(c, c4.a);
      }`,
    depthTest: false,
    depthWrite: false,
  })
  return new ShaderPass(material, 'inputBuffer')
}

/** Vignettage plus marqué pendant l'accueil (regard ramené vers le centre), plus léger ensuite. */
function useIntroVignette() {
  const ref = useRef<VignetteEffect>(null)
  useFrame((_, dt) => {
    const v = ref.current
    if (!v) return
    const phase = useGame.getState().phase
    v.darkness = damp(v.darkness, phase === 'intro' ? 0.72 : 0.5, 2, dt)
  })
  return ref
}

/**
 * Chaîne d'image : occlusion ambiante (contact des objets, angles) en Élevé, halo des seules
 * sources lumineuses (seuil haut : les murs éclairés ne bavent pas), tone mapping AgX, finition
 * (accentuation adaptative, contraste, saturation), anti-crénelage (MSAA 4× et suréchantillonnage
 * en Élevé, SMAA qualité haute en Moyen), vignettage. Pas de grain : il brouille les détails fins.
 */
export function PostFX() {
  const quality = useSettings((s) => s.quality)
  const Q = QUALITY[quality]
  const vignette = useIntroVignette()
  const finish = useMemo(() => finishPass(Q.sharpen, 0.1, 0.1), [Q.sharpen])
  useEffect(() => () => finish.dispose(), [finish])
  if (!Q.bloom) return null
  const hi = quality === 'high'
  const fx: JSX.Element[] = []
  if (Q.ao) fx.push(<N8AO key="ao" halfRes={!hi} quality={hi ? 'medium' : 'low'} aoRadius={0.55} distanceFalloff={0.55} intensity={1.35} color="#120c0a" />)
  fx.push(<Bloom key="bloom" mipmapBlur intensity={0.75} luminanceThreshold={0.62} luminanceSmoothing={0.28} radius={0.6} />)
  fx.push(<ToneMapping key="tm" mode={ToneMappingMode.AGX} />)
  if (!hi) fx.push(<SMAA key="smaa" preset={SMAAPreset.HIGH} />)
  fx.push(<primitive key="finish" object={finish} />)
  fx.push(<Vignette key="vig" ref={vignette} eskil={false} offset={0.26} darkness={0.5} />)
  return (
    <EffectComposer multisampling={hi ? 4 : 0} enableNormalPass={false}>
      {fx}
    </EffectComposer>
  )
}
