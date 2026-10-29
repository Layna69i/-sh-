import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGame } from '../store/game'
import { useSettings, QUALITY } from '../store/settings'
import { lightAnchors, type LightAnchor } from './lights'
import { VISIBILITY, ROOM_BY_ID, EXTERIOR_META, type ZoneId } from './layout'
import { damp } from '../core/math'
import { player } from '../player/PlayerController'

/** Conversion des intensités « artistiques » des lanternes en candelas. */
const LIGHT_SCALE = 9

export const SUN_DIR = new THREE.Vector3(-0.78, 0.13, -0.6).normalize()

const SUN_BY_ZONE: Record<ZoneId, number> = {
  exterior: 1,
  garden: 0.9,
  hall: 0.35,
  library: 0.2,
  shogi: 0.05,
  dojo: 0.25,
  missions: 0.2,
  council: 0.2,
  office: 0.25,
  recruitment: 0.2,
}

const INTERIOR_FILL: Partial<Record<ZoneId, number>> = {
  hall: 0.6,
  library: 0.62,
  shogi: 0.12,
  dojo: 0.7,
  missions: 0.65,
  council: 0.55,
  office: 0.62,
  recruitment: 0.65,
}

/** Lumières dynamiques attribuées aux lanternes les plus proches. */
function LightPool({ count }: { count: number }) {
  const lights = useRef<(THREE.PointLight | null)[]>([])
  const slots = useRef(
    Array.from({ length: count }, () => ({ anchor: null as LightAnchor | null, level: 0, seed: Math.random() * 100 })),
  )
  const timer = useRef(0)
  const camera = useThree((s) => s.camera)
  const desired = useRef<Set<LightAnchor>>(new Set())

  useFrame((state, dt) => {
    timer.current -= dt
    const zone = useGame.getState().zone
    if (timer.current <= 0) {
      timer.current = 0.2
      const vis = VISIBILITY[zone]
      const list: { a: LightAnchor; d: number }[] = []
      for (const arr of lightAnchors.values())
        for (const a of arr) {
          if (!vis.includes(a.zone)) continue
          let d = a.pos.distanceTo(camera.position)
          if (a.zone !== zone) d = d * 1.6 + 4
          list.push({ a, d })
        }
      list.sort((p, q) => p.d - q.d)
      desired.current = new Set(list.slice(0, count).map((x) => x.a))
    }
    const used = new Set(slots.current.map((s) => s.anchor))
    const t = state.clock.elapsedTime
    slots.current.forEach((s, i) => {
      const L = lights.current[i]
      if (!L) return
      const keep = s.anchor && desired.current.has(s.anchor)
      if (!keep) {
        s.level = damp(s.level, 0, 8, dt)
        if (s.level < 0.03) {
          const next = [...desired.current].find((a) => !used.has(a))
          if (next) {
            used.delete(s.anchor)
            used.add(next)
            s.anchor = next
            L.position.copy(next.pos)
            L.color.setHex(next.color)
            L.distance = next.distance
          } else s.anchor = null
        }
      } else s.level = damp(s.level, 1, 5, dt)
      const a = s.anchor
      if (!a) {
        L.intensity = 0
        return
      }
      const fl = a.flicker ?? 0
      const f = 1 - fl * (0.5 + 0.5 * Math.sin(t * 9.1 + s.seed) * Math.sin(t * 3.7 + s.seed * 2.1))
      L.intensity = a.intensity * LIGHT_SCALE * f * s.level
    })
  })

  return (
    <>
      {slots.current.map((_, i) => (
        <pointLight key={i} ref={(l) => void (lights.current[i] = l)} intensity={0} decay={2} distance={9} />
      ))}
    </>
  )
}

/**
 * Environnements d'éclairage indirect (IBL) préfiltrés : ciel de crépuscule froid (dehors),
 * ambiance boisée chaude (dedans). Ils donnent aux matériaux PBR leurs reflets (laque, métal,
 * bois ciré, pierre mouillée) et un ambiant directionnel crédible, sans texture HDR à charger.
 */
function useEnvironments() {
  const gl = useThree((s) => s.gl)
  const envs = useMemo(() => {
    const make = (top: number, horizon: number, bottom: number, glow: number, glowK: number) => {
      const scene = new THREE.Scene()
      const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color(top) },
          horizon: { value: new THREE.Color(horizon) },
          bottom: { value: new THREE.Color(bottom) },
          glow: { value: new THREE.Color(glow) },
          glowDir: { value: SUN_DIR.clone() },
          glowK: { value: glowK },
        },
        vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          uniform vec3 top, horizon, bottom, glow, glowDir; uniform float glowK; varying vec3 vDir;
          void main() {
            float y = vDir.y;
            vec3 c = y > 0.0 ? mix(horizon, top, pow(y, 0.55)) : mix(horizon, bottom, pow(-y, 0.35));
            float g = max(dot(normalize(vDir), glowDir), 0.0);
            c += glow * (pow(g, 24.0) * 2.5 + pow(g, 4.0) * 0.35) * glowK * smoothstep(-0.15, 0.1, y);
            gl_FragColor = vec4(c, 1.0);
          }`,
      })
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), mat))
      const pm = new THREE.PMREMGenerator(gl)
      const rt = pm.fromScene(scene, 0)
      pm.dispose()
      mat.dispose()
      return rt
    }
    return {
      outdoor: make(0x2b3266, 0xa86a6a, 0x16140f, 0xff9a5a, 1),
      indoor: make(0x4a3424, 0x6a4a30, 0x241a12, 0xffb070, 0.25),
    }
  }, [gl])
  useEffect(
    () => () => {
      envs.outdoor.dispose()
      envs.indoor.dispose()
    },
    [envs],
  )
  return envs
}

/** Demi-côté (m) du carré d'ombre du soleil, qui suit le joueur par pas entiers de texel. */
const SHADOW_HALF = 30
/** Direction réelle de la lumière du soleil (un peu plus haute que le disque visible dans le ciel). */
const LIGHT_DIR = SUN_DIR.clone().multiplyScalar(80).add(new THREE.Vector3(0, 20, 0)).normalize()

/** Plan final de l'accueil (approche de la porte, porte, entrée) : mise en scène lumineuse. */
const introHold = () => {
  const g = useGame.getState()
  return (g.phase === 'intro' && g.introStage >= 2) || g.phase === 'entering'
}

/**
 * Lumière de mise en valeur de la grande porte : projecteur doux et chaud placé sous l'avant-toit,
 * rasant de haut en bas pour faire lire le fil du bois, le relief des traverses, les clous et
 * l'emblème doré (ombres portées en Moyen et Élevé). Pleine pendant l'accueil, avec une
 * respiration à peine perceptible, plus discrète ensuite, éteinte à l'intérieur.
 */
function GateKeyLight({ shadows }: { shadows: boolean }) {
  const spot = useRef<THREE.SpotLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    target.position.set(0, 1.85, 0.1)
    scene.add(target)
    if (spot.current) spot.current.target = target
    return () => void scene.remove(target)
  }, [scene, target])
  useFrame((st, dt) => {
    const L = spot.current
    if (!L) return
    const zone = useGame.getState().zone
    const goal = zone !== 'exterior' ? 0 : introHold() ? 150 * (1 + 0.04 * Math.sin(st.clock.elapsedTime * 0.9)) : 70
    L.intensity = damp(L.intensity, goal, 2.5, dt)
    L.visible = L.intensity > 0.5
  })
  return (
    <spotLight
      ref={spot}
      position={[0, 5.4, 3.3]}
      color={0xffd0a0}
      intensity={0}
      angle={0.5}
      penumbra={0.85}
      decay={2}
      distance={14}
      castShadow={shadows}
      shadow-mapSize-width={1024}
      shadow-mapSize-height={1024}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
      shadow-camera-near={1}
      shadow-camera-far={12}
    />
  )
}

export function Lighting() {
  const quality = useSettings((s) => s.quality)
  const Q = QUALITY[quality]
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const amb = useRef<THREE.AmbientLight>(null)
  const scene = useThree((s) => s.scene)
  const envs = useEnvironments()
  const shadowBasis = useMemo(() => {
    const fwd = LIGHT_DIR.clone().negate()
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd).normalize()
    const up = new THREE.Vector3().crossVectors(fwd, right).normalize()
    return { right, up }
  }, [])
  const fog = useMemo(() => new THREE.FogExp2(EXTERIOR_META.fog[0], EXTERIOR_META.fog[1]), [])
  const fogTarget = useMemo(() => new THREE.Color(), [])
  const skyOut = useMemo(() => new THREE.Color(0x8a78b0), [])
  const skyIn = useMemo(() => new THREE.Color(0xffc48a), [])
  const groundOut = useMemo(() => new THREE.Color(0x2a2a1c), [])
  const groundIn = useMemo(() => new THREE.Color(0x4a3020), [])
  const tmpC = useMemo(() => new THREE.Color(), [])
  const target = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    scene.fog = fog
    scene.add(target)
    return () => {
      scene.fog = null
      scene.remove(target)
    }
  }, [scene, fog, target])

  useEffect(() => {
    if (sun.current) {
      sun.current.target = target
      sun.current.shadow.mapSize.set(Q.shadowMap, Q.shadowMap)
      sun.current.shadow.map?.dispose()
      sun.current.shadow.map = null
    }
  }, [Q.shadowMap, target])

  useFrame((_, dt) => {
    const zone = useGame.getState().zone
    const meta = zone === 'exterior' ? EXTERIOR_META : ROOM_BY_ID[zone]
    fogTarget.setHex(meta.fog[0])
    fog.color.lerp(fogTarget, 1 - Math.exp(-2 * dt))
    fog.density = damp(fog.density, meta.fog[1], 2, dt)
    const k = SUN_BY_ZONE[zone]
    const outdoorZone = zone === 'exterior' || zone === 'garden'
    const env = outdoorZone ? envs.outdoor.texture : envs.indoor.texture
    if (scene.environment !== env) scene.environment = env
    // pendant le plan final de l'accueil, le remplissage s'efface au profit des lanternes et de la porte
    const hold = outdoorZone && introHold()
    scene.environmentIntensity = damp(scene.environmentIntensity, outdoorZone ? (hold ? 0.26 : 0.36) : 0.42, 2, dt)
    if (sun.current) {
      sun.current.intensity = damp(sun.current.intensity, 2.4 * k, 2, dt)
      // centre d'ombre aligné sur la grille des texels : pas de scintillement quand on avance
      const texel = (SHADOW_HALF * 2) / Q.shadowMap
      const { right, up } = shadowBasis
      const px = right.x * player.x + right.y * player.y + right.z * player.z
      const py = up.x * player.x + up.y * player.y + up.z * player.z
      const sx = Math.round(px / texel) * texel - px
      const sy = Math.round(py / texel) * texel - py
      target.position.set(player.x + right.x * sx + up.x * sy, player.y + right.y * sx + up.y * sy, player.z + right.z * sx + up.z * sy)
      sun.current.position.copy(target.position).addScaledVector(LIGHT_DIR, 90)
    }
    if (hemi.current) {
      // À l'intérieur : lumière d'ambiance chaude (rebonds des lanternes sur le bois)
      const outdoor = zone === 'exterior' || zone === 'garden'
      const ease = 1 - Math.exp(-2 * dt)
      hemi.current.color.lerp(tmpC.copy(outdoor ? skyOut : skyIn), ease)
      hemi.current.groundColor.lerp(tmpC.copy(outdoor ? groundOut : groundIn), ease)
      // l'environnement IBL fournit désormais une partie de l'ambiant : l'hémisphère est réduit d'autant
      hemi.current.intensity = damp(hemi.current.intensity, (outdoor ? (0.3 + 1.15 * k) * (hold ? 0.5 : 0.85) : INTERIOR_FILL[zone] ?? 0.55) * 0.7, 2, dt)
    }
    if (amb.current) amb.current.intensity = damp(amb.current.intensity, outdoorZone ? (hold ? 0.05 : 0.1) : 0.2, 2, dt)
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={[0x8a78b0, 0x2a2a1c, 0.9]} />
      <ambientLight ref={amb} color={0xffd2a0} intensity={0.08} />
      <directionalLight
        ref={sun}
        color={0xff9a5a}
        intensity={2.4}
        castShadow={Q.shadows}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
        shadow-radius={quality === 'high' ? 3 : 2}
        shadow-camera-left={-SHADOW_HALF}
        shadow-camera-right={SHADOW_HALF}
        shadow-camera-top={SHADOW_HALF}
        shadow-camera-bottom={-SHADOW_HALF}
        shadow-camera-near={1}
        shadow-camera-far={200}
      />
      <LightPool key={Q.lights} count={Q.lights} />
      <GateKeyLight shadows={Q.shadows} />
    </>
  )
}
