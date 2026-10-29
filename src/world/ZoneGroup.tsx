import type { ReactNode } from 'react'
import { useGame } from '../store/game'
import { VISIBILITY, type ZoneId } from './layout'

/** Groupe affiché seulement si la zone est visible depuis la zone courante. */
export function ZoneGroup({ zone, children }: { zone: ZoneId; children: ReactNode }) {
  const current = useGame((s) => s.zone)
  const all = useGame((s) => !s.worldReady)
  return <group visible={all || VISIBILITY[current].includes(zone)}>{children}</group>
}
