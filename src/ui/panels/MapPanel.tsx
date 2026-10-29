/**
 * Plan de l'école : carte interactive générée depuis la géographie réelle du
 * domaine, position du joueur, navigation rapide (accessibilité).
 */
import { useState } from 'react'
import { PanelFrame } from '../PanelFrame'
import type { PanelProps } from '../PanelHost'
import { ROOMS, DOORS, TERRACE, STAIRS, ROOM_BY_ID, type ZoneId } from '../../world/layout'
import { player } from '../../player/PlayerController'
import { useGame } from '../../store/game'
import { SPAWNS, travelTo } from '../../world/spawns'
import { audio } from '../../audio/engine'

const FUNCTION: Record<ZoneId, string> = {
  hall: 'Accueil, présentation, annonces',
  library: 'Archives et renseignements',
  shogi: 'Shogi et table stratégique',
  dojo: 'Catalogue des enseignements',
  missions: 'Missions RP et rapports',
  council: 'Hiérarchie et membres',
  office: 'Fondatrice et direction',
  recruitment: 'Candidatures et admissions',
  garden: 'Contemplation et réflexions',
  exterior: 'Forêt, torii, chemin des lanternes',
}

export default function MapPanel({ close }: PanelProps) {
  const zone = useGame((s) => s.zone)
  const [sel, setSel] = useState<ZoneId>(zone)
  const X0 = -31
  const X1 = 27
  const Z0 = -59
  const Z1 = 13
  const room = sel === 'exterior' ? null : ROOM_BY_ID[sel]
  const openDirect = () => {
    const s = SPAWNS[sel]
    travelTo(sel)
    if (s.panel) window.setTimeout(() => useGame.getState().openPanel(s.panel!), 350)
  }
  return (
    <PanelFrame title="Plan de l’école" kanji="見取図" subtitle="Cliquez une salle pour la sélectionner" onClose={close} width="xl" align="center">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <svg viewBox={`${X0} ${Z0} ${X1 - X0} ${Z1 - Z0}`} className="w-full rounded-sm border border-amber/20 bg-[#16130f]" role="img" aria-label="Plan du domaine">
          <defs>
            <pattern id="tatami" width="1.8" height="0.9" patternUnits="userSpaceOnUse">
              <rect width="1.8" height="0.9" fill="none" stroke="rgba(211,161,91,0.06)" strokeWidth="0.05" />
            </pattern>
          </defs>
          {/* terrasse et escalier */}
          <rect x={TERRACE.x0} y={TERRACE.z0} width={TERRACE.x1 - TERRACE.x0} height={TERRACE.z1 - TERRACE.z0} fill="rgba(90,70,50,0.35)" stroke="rgba(211,161,91,0.3)" strokeWidth="0.12" />
          <rect x={STAIRS.x0} y={STAIRS.z0} width={STAIRS.x1 - STAIRS.x0} height={STAIRS.z1 - STAIRS.z0} fill="rgba(120,120,110,0.35)" />
          <text x="0" y="12.2" textAnchor="middle" fontSize="1.2" fill="#b9b09a" fontFamily="EB Garamond, serif">
            vers la forêt et le torii ↓
          </text>
          {ROOMS.map((r) => {
            const active = sel === r.id
            const here = zone === r.id
            return (
              <g
                key={r.id}
                onClick={() => {
                  setSel(r.id)
                  audio.ui('tab')
                }}
                className="cursor-pointer"
              >
                <rect
                  x={r.x0}
                  y={r.z0}
                  width={r.x1 - r.x0}
                  height={r.z1 - r.z0}
                  fill={r.open ? 'rgba(64,83,75,0.45)' : active ? 'rgba(211,161,91,0.22)' : 'rgba(48,37,31,0.75)'}
                  stroke={active ? '#d3a15b' : here ? '#9a3326' : 'rgba(220,212,191,0.35)'}
                  strokeWidth={active ? 0.35 : 0.2}
                />
                <rect x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} fill="url(#tatami)" pointerEvents="none" />
                <text x={(r.x0 + r.x1) / 2} y={(r.z0 + r.z1) / 2 - 0.4} textAnchor="middle" fontSize={r.x1 - r.x0 < 11 ? 1.5 : 2} fill="#e2c78f" fontFamily="Shippori Mincho, serif" fontWeight={800} pointerEvents="none">
                  {r.kanji}
                </text>
                <text x={(r.x0 + r.x1) / 2} y={(r.z0 + r.z1) / 2 + 1.6} textAnchor="middle" fontSize="1.05" fill="#dcd4bf" fontFamily="EB Garamond, serif" pointerEvents="none">
                  {r.ordinal} · {r.short}
                </text>
              </g>
            )
          })}
          {DOORS.filter((d) => d.kind !== 'window').map((d) => (
            <line
              key={d.id}
              x1={d.axis === 'x' ? d.center - d.width / 2 : d.at}
              x2={d.axis === 'x' ? d.center + d.width / 2 : d.at}
              y1={d.axis === 'x' ? d.at : d.center - d.width / 2}
              y2={d.axis === 'x' ? d.at : d.center + d.width / 2}
              stroke="#d3a15b"
              strokeWidth="0.55"
              strokeLinecap="round"
            />
          ))}
          {/* position du joueur */}
          <g transform={`translate(${player.x} ${player.z}) rotate(${(-player.yaw * 180) / Math.PI})`}>
            <circle r="0.9" fill="#9a3326" stroke="#f4e4d0" strokeWidth="0.2" />
            <path d="M0 -2.2 L0.8 -0.6 L-0.8 -0.6 Z" fill="#f4e4d0" />
          </g>
        </svg>
        <aside className="space-y-4">
          <div>
            <div className="font-jp text-sm tracking-[0.3em] text-amber/80">{room ? room.kanji : '奈良の森'}</div>
            <h3 className="font-serif text-2xl text-paper">{room ? room.name : 'La Forêt des Nara'}</h3>
            <p className="mt-1 text-paper-2">{FUNCTION[sel]}</p>
            {zone === sel && <p className="mt-1 text-sm text-[#e9a597]">Vous êtes ici.</p>}
          </div>
          <div className="flex flex-col gap-2">
            <button className="btn-ink primary" onClick={() => travelTo(sel)}>
              Se rendre dans cette salle
            </button>
            {SPAWNS[sel].panel && (
              <button className="btn-ink" onClick={openDirect}>
                Ouvrir directement sa fonction
              </button>
            )}
            <button className="btn-ink ghost" onClick={() => travelTo('exterior')}>
              Retourner au chemin de la forêt
            </button>
          </div>
          <div className="hairline" />
          <nav aria-label="Navigation rapide">
            <ul className="grid grid-cols-2 gap-1 text-sm">
              {ROOMS.map((r) => (
                <li key={r.id}>
                  <button className={`w-full rounded-sm px-2 py-1 text-left hover:bg-amber/10 ${sel === r.id ? 'text-amber' : 'text-paper-2'}`} onClick={() => setSel(r.id)}>
                    <span className="font-jp">{r.ordinal}</span> {r.short}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <p className="text-xs text-paper-3">Touche M pour ouvrir ou fermer le plan. La navigation rapide ouvre les portes nécessaires.</p>
        </aside>
      </div>
    </PanelFrame>
  )
}
