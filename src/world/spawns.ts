/** Points d'arrivée de la navigation rapide (plan, accessibilité). */
import type { ZoneId } from './layout'
import { DOORS } from './layout'
import type { PanelId } from '../store/game'
import { useGame } from '../store/game'
import { audio } from '../audio/engine'

// yaw : 0 = regard vers le nord (−z), π/2 = vers l'ouest (−x), −π/2 = vers l'est (+x)
export const SPAWNS: Record<ZoneId, { x: number; z: number; yaw: number; panel?: PanelId }> = {
  exterior: { x: 0, z: 17, yaw: 0 },
  hall: { x: 0, z: -3.2, yaw: 0, panel: 'presentation' },
  library: { x: -11.4, z: -17.5, yaw: Math.PI / 2, panel: 'archives' },
  shogi: { x: 11.5, z: -18, yaw: -Math.PI / 2, panel: 'shogi' },
  dojo: { x: -11.5, z: -36, yaw: Math.PI / 2, panel: 'courses' },
  missions: { x: 11.4, z: -5, yaw: -Math.PI / 2, panel: 'missions' },
  council: { x: 11.4, z: -36, yaw: -Math.PI / 2, panel: 'council' },
  office: { x: 0, z: -47.3, yaw: 0, panel: 'notebook' },
  recruitment: { x: -11.4, z: -4.5, yaw: Math.PI / 2, panel: 'recruitment' },
  garden: { x: 0, z: -28.6, yaw: 0 },
}

/** Ouvre les portes qui mènent à la zone (et au hall) puis y place le joueur. */
export function travelTo(zone: ZoneId) {
  const g = useGame.getState()
  for (const d of DOORS) if (d.kind !== 'window' && (d.rooms.includes(zone) || zone === 'exterior') && !g.doors[d.id]) g.setDoor(d.id, true)
  if (zone !== 'hall') {
    const gate = DOORS.find((d) => d.id === 'gate')
    if (zone === 'exterior' && gate) g.setDoor(gate.id, true)
  }
  const s = SPAWNS[zone]
  g.closePanel()
  g.requestTeleport(s.x, s.z, s.yaw)
  audio.page()
}
