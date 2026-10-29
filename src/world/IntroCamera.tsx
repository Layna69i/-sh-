/**
 * Cinématique d'arrivée : survol de la forêt, descente le long du chemin,
 * passage sous le torii, montée de l'escalier jusqu'à la grande porte.
 * Puis, à l'entrée, les battants s'ouvrent et la caméra franchit le seuil.
 */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGame } from '../store/game'
import { terrainHeight, EYE_HEIGHT, pathX } from './layout'
import { player } from '../player/PlayerController'
import { clamp, smoothstep } from '../core/math'

export const INTRO_DURATION = 17
export const intro = { t: 0, skip: false }

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function IntroCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const enterT = useRef(0)
  const { path, look } = useMemo(() => {
    const y = (x: number, z: number, h: number) => terrainHeight(x, z) + h
    const path = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(pathX(98), y(pathX(98), 98, 17), 98),
        new THREE.Vector3(pathX(80), y(pathX(80), 80, 12), 80),
        new THREE.Vector3(pathX(62), y(pathX(62), 62, 7), 62),
        new THREE.Vector3(pathX(46) * 0.6, y(0, 46, 3.4), 46),
        new THREE.Vector3(0.3, y(0, 37, 2.3), 37),
        new THREE.Vector3(0, y(0, 30, 1.9), 30),
        new THREE.Vector3(0, y(0, 19, 1.75), 19),
        new THREE.Vector3(0, -2.4 + 1.7, 11.5),
        new THREE.Vector3(0, -0.8 + 1.68, 7.4),
        // plan final un peu en retrait : la porte et son médaillon au centre, le titre au-dessus
        new THREE.Vector3(0, EYE_HEIGHT, 4.6),
      ],
      false,
      'centripetal',
    )
    const look = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 11, -14),
      new THREE.Vector3(0, 9.5, -12),
      new THREE.Vector3(0, 7.5, -8),
      new THREE.Vector3(0, 6.5, -4),
      new THREE.Vector3(0, 5.5, 0),
      new THREE.Vector3(0, 4.5, 0),
      new THREE.Vector3(0, 3.6, 0),
      new THREE.Vector3(0, 2.6, 0),
      new THREE.Vector3(0, 2.3, -2),
      new THREE.Vector3(0, 2.45, -6),
    ])
    return { path, look }
  }, [])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const g = useGame.getState()
    if (g.phase === 'intro') {
      if (intro.skip) {
        intro.t = INTRO_DURATION
        intro.skip = false
      }
      intro.t = Math.min(INTRO_DURATION, intro.t + dt)
      const k = ease(intro.t / INTRO_DURATION)
      path.getPoint(k, camera.position)
      look.getPoint(k, tmp)
      // respiration lente une fois arrivé
      if (intro.t >= INTRO_DURATION) {
        const s = performance.now() / 1000
        camera.position.y += Math.sin(s * 0.8) * 0.015
      }
      camera.lookAt(tmp)
      if (camera.fov !== 62) {
        camera.fov = 62
        camera.updateProjectionMatrix()
      }
      const stage = intro.t > INTRO_DURATION - 0.3 ? 3 : intro.t > 9.5 ? 2 : intro.t > 2.2 ? 1 : 0
      if (stage !== g.introStage) g.setIntroStage(stage)
    } else if (g.phase === 'entering') {
      enterT.current += dt
      const t = clamp((enterT.current - 0.9) / 2.6)
      const k = smoothstep(0, 1, t)
      camera.position.set(0, EYE_HEIGHT, 4.6 - k * 7.4)
      tmp.set(0, 2.45 - k * 0.8, -6 - k * 6)
      camera.lookAt(tmp)
      if (t >= 1) {
        player.x = 0
        player.z = -2.8
        player.y = 0
        player.yaw = 0
        player.pitch = -0.03
        enterT.current = 0
        g.setPhase('playing')
        g.setZone('hall')
      }
    }
  })
  return null
}
