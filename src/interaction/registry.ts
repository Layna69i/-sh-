/**
 * Registre des objets interactifs du monde. Hors de React pour éviter tout
 * rendu inutile : le système de visée interroge ce registre à chaque image.
 */
import * as THREE from 'three'
import type { ZoneId } from '../world/layout'
import type { FocusPose } from '../store/game'

export interface Interactable {
  id: string
  zone: ZoneId
  /** Zones depuis lesquelles l'objet est utilisable (par défaut : `zone`). */
  zones?: ZoneId[]
  label: string
  verb: string
  box: THREE.Box3
  maxDist?: number
  /** Pose caméra lors de l'interaction (facultatif). */
  focus?: FocusPose
  /** Point vers lequel l'ombre-guide se dirige. */
  anchor?: THREE.Vector3
  enabled?: () => boolean
  onInteract: () => void
}

export const interactables = new Map<string, Interactable>()

export function registerInteractable(it: Interactable) {
  interactables.set(it.id, it)
  return () => {
    if (interactables.get(it.id) === it) interactables.delete(it.id)
  }
}

/** Boîte centrée utilitaire. */
export function boxAt(x: number, y: number, z: number, w: number, h: number, d: number) {
  return new THREE.Box3(new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2), new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2))
}

/** Calcule une pose de caméra regardant `target` depuis une direction (yaw) et une distance. */
export function focusFrom(target: [number, number, number], yaw: number, dist: number, height: number, fov?: number): FocusPose {
  return {
    position: [target[0] + Math.sin(yaw) * dist, target[1] + height, target[2] + Math.cos(yaw) * dist],
    target,
    fov,
  }
}
