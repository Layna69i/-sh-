/**
 * Contrôleur à la première personne : déplacements, collisions, hauteur du sol,
 * balancement de tête, bruits de pas selon la surface, transitions de caméra
 * vers les objets consultés, téléportation (navigation rapide).
 */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGame, type FocusPose } from '../store/game'
import { useSettings } from '../store/settings'
import { input, consumeLook, moveAxes, installKeyboard } from './input'
import { resolve } from './collision'
import { floorHeight, zoneAt, EYE_HEIGHT, ROOM_BY_ID, pathDistance, STAIRS, TERRACE, type ZoneId } from '../world/layout'
import { audio, type Surface } from '../audio/engine'
import { clamp, damp, smoothstep } from '../core/math'
import { triggerInteraction } from '../interaction/InteractionSystem'

export const player = {
  x: 0,
  z: 2.5,
  y: 0,
  yaw: 0,
  pitch: 0,
  speed: 0,
}

const RADIUS = 0.3
const WALK = 2.7
const RUN = 5.0

function surfaceAt(zone: ZoneId, x: number, z: number): Surface {
  if (zone === 'exterior') {
    if (x >= TERRACE.x0 && x <= TERRACE.x1 && z >= TERRACE.z0 && z <= TERRACE.z1) return 'wood'
    if (x >= STAIRS.x0 && x <= STAIRS.x1 && z >= STAIRS.z0 && z <= STAIRS.z1) return 'stone'
    return pathDistance(x, z) < 1.6 ? 'stone' : 'forest'
  }
  const r = ROOM_BY_ID[zone]
  if (r.floor === 'gravel') {
    const edge = Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z)
    return edge < 1.5 ? 'wood' : 'gravel'
  }
  return r.floor === 'tatami' ? 'tatami' : 'wood'
}

const ease = (t: number) => t * t * (3 - 2 * t)

export function PlayerController() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const st = useRef({
    vx: 0,
    vz: 0,
    bob: 0,
    stride: 0,
    blend: 0,
    focus: null as FocusPose | null,
    zone: 'exterior' as ZoneId,
    dragging: false,
  })
  const tmp = useRef({
    qPlayer: new THREE.Quaternion(),
    qFocus: new THREE.Quaternion(),
    e: new THREE.Euler(0, 0, 0, 'YXZ'),
    pPlayer: new THREE.Vector3(),
    pFocus: new THREE.Vector3(),
    m: new THREE.Matrix4(),
    up: new THREE.Vector3(0, 1, 0),
  })

  // Verrouillage du pointeur et regard à la souris
  useEffect(() => {
    const el = gl.domElement
    const onLockChange = () => useGame.getState().setPointerLocked(document.pointerLockElement === el)
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement === el || st.current.dragging) {
        input.lookDX += e.movementX
        input.lookDY += e.movementY
      }
    }
    const onDown = (e: PointerEvent) => {
      const g = useGame.getState()
      if (g.phase !== 'playing' || g.panel) return
      if (document.pointerLockElement === el) {
        if (e.button === 0) triggerInteraction()
        return
      }
      if (e.pointerType === 'touch') return
      st.current.dragging = true
      const req = el.requestPointerLock?.() as unknown as Promise<void> | undefined
      req?.catch?.(() => undefined)
    }
    const onUp = () => (st.current.dragging = false)
    document.addEventListener('pointerlockchange', onLockChange)
    window.addEventListener('mousemove', onMove)
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    return () => {
      document.removeEventListener('pointerlockchange', onLockChange)
      window.removeEventListener('mousemove', onMove)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
    }
  }, [gl])

  // Raccourcis clavier
  useEffect(
    () =>
      installKeyboard((code) => {
        const g = useGame.getState()
        if (g.phase !== 'playing') return
        if (code === 'KeyE' && !g.panel) triggerInteraction()
        if (code === 'KeyM') {
          if (g.panel?.id === 'map') g.closePanel()
          else if (!g.panel) {
            document.exitPointerLock?.()
            g.openPanel('map')
            audio.ui('open')
          }
        }
        if (code === 'Escape' && g.panel) {
          g.closePanel()
          audio.ui('close')
        }
      }),
    [],
  )

  // Libère la souris lorsqu'un panneau s'ouvre
  useEffect(
    () =>
      useGame.subscribe((s, prev) => {
        if (s.panel && !prev.panel && document.pointerLockElement) document.exitPointerLock()
      }),
    [],
  )

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const g = useGame.getState()
    const set = useSettings.getState()
    const s = st.current
    const t = tmp.current

    if (g.teleport) {
      player.x = g.teleport.x
      player.z = g.teleport.z
      player.yaw = g.teleport.yaw
      player.pitch = 0
      player.y = floorHeight(player.x, player.z)
      s.vx = s.vz = 0
      g.clearTeleport()
    }

    if (g.phase !== 'playing') return

    // --- Regard
    const [dx, dy] = consumeLook()
    const free = !g.panel && !g.focus
    if (free) {
      const k = 0.0022 * set.sensitivity
      player.yaw -= dx * k
      player.pitch -= dy * k * (set.invertY ? -1 : 1)
      player.pitch = clamp(player.pitch, -1.35, 1.35)
    }

    // --- Déplacement
    const ax = free ? moveAxes() : { x: 0, y: 0, run: false }
    const speed = ax.run ? RUN : WALK
    const sin = Math.sin(player.yaw)
    const cos = Math.cos(player.yaw)
    const wantX = (ax.x * cos - ax.y * sin) * speed
    const wantZ = (-ax.x * sin - ax.y * cos) * speed
    const accel = ax.x || ax.y ? 10 : 12
    s.vx = damp(s.vx, wantX, accel, dt)
    s.vz = damp(s.vz, wantZ, accel, dt)
    const p = { x: player.x + s.vx * dt, z: player.z + s.vz * dt }
    resolve(p, RADIUS)
    const moved = Math.hypot(p.x - player.x, p.z - player.z)
    player.speed = moved / Math.max(dt, 1e-4)
    player.x = p.x
    player.z = p.z
    const fy = floorHeight(player.x, player.z)
    player.y = Math.abs(fy - player.y) > 1.5 ? fy : damp(player.y, fy, 14, dt)

    // --- Zone courante
    const zone = zoneAt(player.x, player.z)
    if (zone !== s.zone) {
      s.zone = zone
      g.setZone(zone)
      audio.setZone(zone)
    }

    // --- Pas et balancement
    const moving = player.speed > 0.4
    if (moving) {
      s.stride += moved
      s.bob += moved * (ax.run ? 2.2 : 2.6)
      const strideLen = ax.run ? 0.95 : 0.72
      if (s.stride > strideLen) {
        s.stride = 0
        audio.step(surfaceAt(zone, player.x, player.z), ax.run)
      }
    }
    const bobAmp = set.headBob ? smoothstep(0.3, 3, player.speed) * (ax.run ? 0.045 : 0.03) : 0
    const bobY = Math.sin(s.bob * 2) * bobAmp
    const bobX = Math.cos(s.bob) * bobAmp * 0.5

    // --- Pose joueur
    t.e.set(player.pitch, player.yaw, Math.sin(s.bob) * bobAmp * 0.08, 'YXZ')
    t.qPlayer.setFromEuler(t.e)
    t.pPlayer.set(player.x + Math.cos(player.yaw) * bobX, player.y + EYE_HEIGHT + bobY, player.z - Math.sin(player.yaw) * bobX)

    // --- Transition vers / depuis un objet consulté
    if (g.focus) s.focus = g.focus
    s.blend = damp(s.blend, g.focus ? 1 : 0, g.focus ? 3.2 : 4.5, dt)
    if (s.blend < 0.002 && !g.focus) s.blend = 0
    let fov = set.fov
    if (s.focus && s.blend > 0) {
      const f = s.focus
      t.pFocus.set(...f.position)
      t.m.lookAt(t.pFocus, new THREE.Vector3(...f.target), t.up)
      t.qFocus.setFromRotationMatrix(t.m)
      const k = ease(s.blend)
      camera.position.copy(t.pPlayer).lerp(t.pFocus, k)
      camera.quaternion.copy(t.qPlayer).slerp(t.qFocus, k)
      fov = fov + ((f.fov ?? fov) - fov) * k
    } else {
      camera.position.copy(t.pPlayer)
      camera.quaternion.copy(t.qPlayer)
    }
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  })

  return null
}
