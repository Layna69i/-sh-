/**
 * Visée : un rayon part du centre de l'écran et sélectionne l'objet interactif
 * le plus proche dans la pièce courante. [E], clic gauche (souris capturée)
 * ou le bouton tactile déclenchent l'interaction.
 */
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGame } from '../store/game'
import { interactables, type Interactable } from './registry'

let current: Interactable | null = null
export const getCurrentTarget = () => current

export function triggerInteraction() {
  const it = current
  if (!it) return
  if (it.enabled && !it.enabled()) return
  it.onInteract()
}

const ray = new THREE.Ray()
const dir = new THREE.Vector3()
const hit = new THREE.Vector3()

export function InteractionSystem() {
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    const g = useGame.getState()
    if (g.phase !== 'playing' || g.panel || g.focus) {
      if (current) {
        current = null
        g.setHover(null)
      }
      return
    }
    camera.getWorldDirection(dir)
    ray.set(camera.position, dir)
    let best: Interactable | null = null
    let bestD = Infinity
    for (const it of interactables.values()) {
      const zones = it.zones ?? [it.zone]
      if (!zones.includes(g.zone)) continue
      if (it.enabled && !it.enabled()) continue
      if (!ray.intersectBox(it.box, hit)) continue
      const d = hit.distanceTo(camera.position)
      if (d < (it.maxDist ?? 3.2) && d < bestD) {
        best = it
        bestD = d
      }
    }
    current = best
    g.setHover(best ? { id: best.id, label: best.label, verb: best.verb } : null)
  })
  return null
}
