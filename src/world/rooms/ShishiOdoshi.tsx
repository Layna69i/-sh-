/**
 * Shishi-odoshi et tsukubai du Jardin du Silence.
 * Shishi-odoshi : un tube de bambou coupé en biais pivote sur un axe entre deux poteaux ligaturés
 * de corde de palmier ; la goulotte (kakei) le remplit d'un filet d'eau continu ; plein, il bascule,
 * verse dans le bassin (onde à la surface), revient, et son talon frappe la pierre — « kon » —
 * avec un petit rebond. Tsukubai : vasque de pierre taillée, cuvette d'eau et louche de bambou.
 */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { M, cachedMaterial } from '../assets'
import { latheGeo, scaleUV } from '../geo'
import { Placer } from '../props/furniture'
import { bambooPiece, bambooPieceMaterial, type BambooPieceOpts } from '../bamboo'
import { rockGeometry, rockMaterial } from '../rocks'
import { streakTexture, ringTexture } from '../exterior/Waterfall'
import { waterMaterial } from '../exterior/Domain'
import { POND_Y } from './gardenLayout'
import { audio } from '../../audio/engine'

/* ------------------------------ mesures (repère local, +x vers le bassin) ------------------------------ */
const PIVOT_Y = 0.5
/** longueur du tube derrière l'axe (talon fermé) et devant (bec ouvert, coupé en biais) */
const BACK = 0.38
const FRONT = 0.56
const R = 0.046
/** repos : talon posé sur la pierre, bec levé sous la goulotte ; basculé : le bec verse */
const REST = 0.32
const DOWN = -0.5
const FILL_TIME = 7
/** sortie de la goulotte, au-dessus du bec au repos */
const SPOUT_OUT = new THREE.Vector3(0.5, 0.86, 0)
const SPOUT_POST = new THREE.Vector3(-0.15, 0, -0.5)

const shuroRope = () => cachedMaterial('shuro-rope', () => new THREE.MeshStandardMaterial({ color: 0x2a1f18, roughness: 1, metalness: 0 }))

/** Tronçon de bambou orienté de `a` vers `b` ; `up` : côté de la partie longue de la coupe. */
function pieceBetween(a: THREE.Vector3, b: THREE.Vector3, opts: Omit<BambooPieceOpts, 'len'>, up = new THREE.Vector3(0, 1, 0)) {
  const dir = b.clone().sub(a)
  const len = dir.length()
  const Y = dir.normalize()
  const X = up.clone().addScaledVector(Y, -up.dot(Y)).normalize()
  const Z = new THREE.Vector3().crossVectors(X, Y)
  const g = bambooPiece({ ...opts, len })
  g.applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(a))
  return g
}

/** Ligature : quelques tours de corde serrés autour d'un poteau. */
function lashing(r: number, turns: number, y: number) {
  const parts: THREE.BufferGeometry[] = []
  for (let k = 0; k < turns; k++) {
    const t = new THREE.TorusGeometry(r + 0.004, 0.0042, 5, 18)
    t.rotateX(Math.PI / 2)
    t.translate(0, y + (k - (turns - 1) / 2) * 0.009, 0)
    parts.push(t)
  }
  return parts
}

/** Filet d'eau le long d'une parabole (UV : v le long du filet, pour l'écoulement). */
function streamGeometry(from: THREE.Vector3, vel: THREE.Vector3, toY: number, radius: number) {
  const pts: THREE.Vector3[] = []
  for (let t = 0; ; t += 0.02) {
    const p = from.clone().addScaledVector(vel, t).add(new THREE.Vector3(0, -4.9 * t * t, 0))
    pts.push(p)
    if (p.y <= toY || t > 1) break
  }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, radius, 7, false)
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i) * 6)
  return g
}

/** Eau du filet : stries qui défilent ; tout ce qui passe sous `uCut` (hauteur locale) est coupé. */
function streamMaterial() {
  const tex = streakTexture().clone()
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd6e3e6,
    alphaMap: tex,
    emissive: 0x7e9298,
    emissiveIntensity: 0.25,
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  })
  const uniforms = { uCut: { value: 0 } }
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLocalY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalY = position.y;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uCut;\nvarying float vLocalY;')
      .replace('#include <alphamap_fragment>', 'if (vLocalY < uCut) discard;\n#include <alphamap_fragment>')
  }
  mat.customProgramCacheKey = () => 'shishi-stream'
  return { mat, tex, uniforms }
}

/* ------------------------------ shishi-odoshi ------------------------------ */
export function ShishiOdoshi({ x, z, ry }: { x: number; z: number; ry: number }) {
  const pivot = useRef<THREE.Group>(null)
  const ripples = useRef<THREE.Group>(null)
  const st = useRef({ phase: 'fill' as 'fill' | 'tip' | 'pour' | 'back' | 'settle', t: Math.random() * 4, angle: REST, vel: 0, ripple: 9 })

  const parts = useMemo(() => {
    const bamboo = bambooPieceMaterial()
    // tube basculant : talon fermé (nœud), nœud juste devant l'axe, bec creux coupé en biais
    const tube = bambooPiece({ len: BACK + FRONT, r: R, nodes: [BACK + 0.05], cut: 0.78, wall: 0.0065, radial: 16 })
    tube.applyMatrix4(new THREE.Matrix4().makeRotationZ(-Math.PI / 2))
    tube.translate(-BACK, 0, 0)
    // poteaux, traverse basse, axe
    const fixed: THREE.BufferGeometry[] = []
    const ropes: THREE.BufferGeometry[] = []
    for (const pz of [-0.115, 0.115]) {
      const post = bambooPiece({ len: 0.7, r: 0.03, nodes: [0.21, 0.47], radial: 12 })
      post.translate(0, -0.05, pz)
      fixed.push(post)
      for (const t of [...lashing(0.03, 3, 0.1), ...lashing(0.03, 2, 0.6)]) ropes.push(t.translate(0, 0, pz))
    }
    fixed.push(pieceBetween(new THREE.Vector3(0, 0.1, -0.2), new THREE.Vector3(0, 0.1, 0.2), { r: 0.017, nodes: [0.21], radial: 10 }))
    // goulotte : poteau, puis tube incliné jusqu'au-dessus du bec, bout biseauté vers le haut
    const sp = bambooPiece({ len: 1.02, r: 0.034, nodes: [0.3, 0.62, 0.9], radial: 12 })
    sp.translate(SPOUT_POST.x, -0.05, SPOUT_POST.z)
    fixed.push(sp)
    const inlet = new THREE.Vector3(SPOUT_POST.x, 0.93, SPOUT_POST.z)
    const toOut = SPOUT_OUT.clone().sub(inlet)
    const start = inlet.clone().addScaledVector(new THREE.Vector3(toOut.x, 0, toOut.z).normalize(), 0.02)
    fixed.push(pieceBetween(start, SPOUT_OUT, { r: 0.021, nodes: [0.35], cut: 0.62, wall: 0.004, radial: 10 }))
    for (const t of lashing(0.034, 3, 0.93)) ropes.push(t.translate(SPOUT_POST.x, 0, SPOUT_POST.z))
    const axle = new THREE.CylinderGeometry(0.0085, 0.0085, 0.31, 8)
    axle.rotateX(Math.PI / 2)
    axle.translate(0, PIVOT_Y, 0)
    // pierre de frappe sous le talon, galets mouillés au bord de l'eau
    const strike = rockGeometry(71, 'fuse', 0.34, 3)
    const heel = new THREE.Vector3(-BACK, -R, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), REST)
    const topY = PIVOT_Y + heel.y
    // pierre ramenée à la hauteur du talon, enfoncée de quelques centimètres dans le sol
    strike.geometry.computeBoundingBox()
    const bb = strike.geometry.boundingBox!
    strike.geometry.translate(0, -bb.max.y, 0)
    strike.geometry.scale(1, (topY + 0.04) / (bb.max.y - bb.min.y), 1)
    strike.geometry.translate(heel.x - 0.02, topY, 0)
    // filets d'eau : goulotte (continu), bec (pendant le versement)
    const spoutDir = new THREE.Vector3(toOut.x, 0, toOut.z).normalize()
    const spout = streamGeometry(SPOUT_OUT.clone().add(new THREE.Vector3(0, -0.012, 0)), spoutDir.multiplyScalar(0.18), POND_Y, 0.0045)
    const lip = new THREE.Vector3(FRONT - 0.02, -R * 0.6, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), DOWN)
    const pourFrom = new THREE.Vector3(lip.x, PIVOT_Y + lip.y, 0)
    const pour = streamGeometry(pourFrom, new THREE.Vector3(Math.cos(DOWN), Math.sin(DOWN), 0).multiplyScalar(0.6), POND_Y, 0.012)
    const land = (() => {
      const p = pour.attributes.position as THREE.BufferAttribute
      let lo = 0
      for (let i = 1; i < p.count; i++) if (p.getY(i) < p.getY(lo)) lo = i
      return new THREE.Vector3(p.getX(lo), POND_Y + 0.004, p.getZ(lo))
    })()
    const merged = (list: THREE.BufferGeometry[]) => {
      const out = new THREE.BufferGeometry()
      const all = list.map((g) => g.toNonIndexed())
      for (const name of Object.keys(all[0].attributes)) {
        const size = all[0].getAttribute(name).itemSize
        const arr = new Float32Array(all.reduce((n, g) => n + g.getAttribute(name).array.length, 0))
        let o = 0
        for (const g of all) {
          arr.set(g.getAttribute(name).array as Float32Array, o)
          o += g.getAttribute(name).array.length
        }
        out.setAttribute(name, new THREE.BufferAttribute(arr, size))
      }
      list.forEach((g) => g.dispose())
      all.forEach((g) => g.dispose())
      out.computeBoundingSphere()
      return out
    }
    const ropeAll = merged(ropes.map((g) => (g.deleteAttribute('uv'), g)))
    return { bamboo, tube, fixed: merged(fixed), ropes: ropeAll, axle, strike: strike.geometry, spout, pour, land }
  }, [])
  const water = useMemo(() => ({ spout: streamMaterial(), pour: streamMaterial() }), [])
  const rippleMats = useMemo(() => Array.from({ length: 3 }, () => new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, depthWrite: false, color: 0xcfdadd, opacity: 0 })), [])
  const stoneMat = useMemo(() => rockMaterial({ moss: 0.35, wet: 0.6 }), [])
  // accès de débogage (développement uniquement) : état de la bascule
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign((window as unknown as { __osho?: object }).__osho ?? {}, { shishi: st.current })
  }, [])

  useEffect(
    () => () => {
      for (const g of [parts.tube, parts.fixed, parts.ropes, parts.axle, parts.strike, parts.spout, parts.pour]) g.dispose()
      for (const w of [water.spout, water.pour]) {
        w.mat.dispose()
        w.tex.dispose()
      }
      rippleMats.forEach((m) => m.dispose())
      stoneMat.dispose()
    },
    [parts, water, rippleMats, stoneMat],
  )

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const s = st.current
    s.t += dt
    switch (s.phase) {
      case 'fill':
        // le bec s'alourdit : le tube s'incline à peine avant de basculer
        s.angle = REST - 0.05 * THREE.MathUtils.smoothstep(s.t / FILL_TIME, 0.6, 1)
        if (s.t > FILL_TIME) Object.assign(s, { phase: 'tip', vel: 0, t: 0 })
        break
      case 'tip':
        s.vel -= 7.5 * dt
        s.angle += s.vel * dt
        if (s.angle <= DOWN) Object.assign(s, { phase: 'pour', angle: DOWN, vel: 0, t: 0, ripple: 0 })
        break
      case 'pour':
        if (s.t > 0.8) Object.assign(s, { phase: 'back', t: 0 })
        break
      case 'back':
      case 'settle':
        // le talon, plus lourd une fois vide, retombe ; choc sur la pierre puis petit rebond
        s.vel += 9 * dt
        s.angle += s.vel * dt
        if (s.angle >= REST && s.vel > 0) {
          if (s.phase === 'back') audio.bamboo()
          s.angle = REST
          s.vel = -s.vel * 0.25
          s.phase = 'settle'
          if (Math.abs(s.vel) < 0.12) Object.assign(s, { phase: 'fill', vel: 0, t: 0 })
        }
        break
    }
    if (pivot.current) pivot.current.rotation.z = s.angle
    // filet de la goulotte : arrêté par le bec quand il est dessous, sinon jusqu'au bassin
    const mouthY = PIVOT_Y + Math.sin(s.angle) * FRONT
    water.spout.uniforms.uCut.value = s.angle > REST - 0.12 ? mouthY + 0.01 : POND_Y
    water.spout.tex.offset.y -= dt * 2.2
    // versement
    const pourAmt = s.phase === 'pour' ? Math.min(1, s.t / 0.1) * (1 - THREE.MathUtils.smoothstep(s.t, 0.45, 0.8)) : 0
    water.pour.mat.opacity = 0.85 * pourAmt
    water.pour.tex.offset.y -= dt * 3
    // ondes là où l'eau tombe
    s.ripple += dt
    const g = ripples.current
    if (g)
      g.children.forEach((c, i) => {
        const ph = (s.ripple - i * 0.25) / 1.6
        const on = ph > 0 && ph < 1
        c.visible = on
        if (on) {
          c.scale.setScalar(0.08 + ph * 0.6)
          rippleMats[i].opacity = (1 - ph) * 0.5
        }
      })
  })

  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <mesh geometry={parts.fixed} material={parts.bamboo} castShadow receiveShadow />
      <mesh geometry={parts.ropes} material={shuroRope()} castShadow />
      <mesh geometry={parts.axle} material={M().woodMid} />
      <mesh geometry={parts.strike} material={stoneMat} castShadow receiveShadow />
      <group ref={pivot} position={[0, PIVOT_Y, 0]}>
        <mesh geometry={parts.tube} material={parts.bamboo} castShadow receiveShadow />
      </group>
      <mesh geometry={parts.spout} material={water.spout.mat} renderOrder={3} />
      <mesh geometry={parts.pour} material={water.pour.mat} renderOrder={3} />
      <group ref={ripples} position={parts.land}>
        {rippleMats.map((m, i) => (
          <mesh key={i} material={m} rotation={[-Math.PI / 2, 0, i * 1.7]} renderOrder={2} visible={false}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* ------------------------------ tsukubai ------------------------------ */
/** Vasque de pierre taillée (flanc bombé, lèvre plate, cuvette), eau, louche, mousse au pied. */
export function tsukubai(P: Placer, x: number, z: number) {
  const m = M()
  const g = latheGeo(
    [
      [0, 0],
      [0.4, 0],
      [0.43, 0.04],
      [0.455, 0.18],
      [0.445, 0.34],
      [0.425, 0.41],
      [0.395, 0.445],
      [0.33, 0.455],
      [0.29, 0.45],
      [0.265, 0.42],
      [0.22, 0.36],
      [0.12, 0.335],
      [0, 0.33],
    ],
    32,
  )
  // irrégularités de taille, périodiques autour de l'axe (pas de couture)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getZ(i), pos.getX(i))
    const k = 1 + 0.018 * Math.sin(a * 3 + 1) + 0.008 * Math.sin(a * 7 + 2)
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i), pos.getZ(i) * k)
  }
  scaleUV(g, Math.PI * 2 * 0.45, 1.2)
  P.geo(g, m.stoneDark, [x, -0.02, z], [0, 0.4, 0], 1, true)
  P.geo(new THREE.CircleGeometry(0.27, 28).rotateX(-Math.PI / 2), waterMaterial(0x0a1012, 0x3a2a3a), [x, 0.41, z])
  P.geo(new THREE.RingGeometry(0.43, 0.66, 32).rotateX(-Math.PI / 2), m.moss, [x, 0.008, z])
  // louche (hishaku) posée en travers de la vasque
  const L = P.at(x, 0.442, z, 0.9)
  L.cyl(m.bamboo, 0.0065, 0.0065, 0.6, 6, [0.02, 0.018, 0], [0, 0, Math.PI / 2 - 0.04])
  L.geo(latheGeo([[0, 0], [0.036, 0], [0.036, 0.062], [0.032, 0.062], [0.032, 0.006], [0, 0.006]], 16), m.bamboo, [-0.2, -0.005, 0])
}
