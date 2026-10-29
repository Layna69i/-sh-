/**
 * Points d'éclairage (lanternes, bougies, braseros). Seules les sources les
 * plus proches reçoivent une vraie lumière dynamique (« pool » de lumières à
 * nombre constant : aucun recompilation de shaders en cours de partie).
 */
import * as THREE from 'three'
import type { ZoneId } from './layout'

export interface LightAnchor {
  pos: THREE.Vector3
  color: number
  intensity: number
  distance: number
  zone: ZoneId
  flicker?: number
}

export const lightAnchors = new Map<string, LightAnchor[]>()

export function setLightAnchors(owner: string, list: LightAnchor[]) {
  lightAnchors.set(owner, list)
  return () => {
    if (lightAnchors.get(owner) === list) lightAnchors.delete(owner)
  }
}

export const anchor = (zone: ZoneId, x: number, y: number, z: number, intensity = 6, color = 0xffa55a, distance = 9, flicker = 0.12): LightAnchor => ({
  pos: new THREE.Vector3(x, y, z),
  color,
  intensity,
  distance,
  zone,
  flicker,
})
