/** Aide : contrôles, conseils de visite, navigation rapide accessible. */
import { PanelFrame } from '../PanelFrame'
import type { PanelProps } from '../PanelHost'
import { SectionTitle } from '../kit'
import { ROOMS } from '../../world/layout'
import { SPAWNS, travelTo } from '../../world/spawns'
import { useGame } from '../../store/game'

const KEYS: [string, string][] = [
  ['Z Q S D / W A S D / flèches', 'Marcher'],
  ['Souris', 'Regarder (cliquez sur la scène pour capturer la souris)'],
  ['Maj', 'Presser le pas'],
  ['E ou clic gauche', 'Interagir, ouvrir et fermer les portes'],
  ['M', 'Plan de l’école'],
  ['Échap', 'Libérer la souris ou fermer un panneau'],
]

export default function HelpPanel({ close }: PanelProps) {
  return (
    <PanelFrame title="Aide" kanji="導" subtitle="Comment explorer l’École des Ombres" onClose={close} width="md">
      <SectionTitle kanji="鍵">Contrôles</SectionTitle>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {KEYS.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-amber">{k}</dt>
            <dd className="text-paper/90">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-paper-2">Sur téléphone : glissez à gauche pour marcher, à droite pour regarder ; un bouton « Interagir » apparaît devant les objets utilisables.</p>
      <SectionTitle kanji="影">L’ombre-guide</SectionTitle>
      <p className="text-sm text-paper-2">Lorsque votre regard se pose sur un objet utilisable, une fine ombre s’étire sur le sol jusqu’à lui — à la manière d’une technique de possession des ombres.</p>
      <SectionTitle kanji="速">Navigation rapide</SectionTitle>
      <p className="mb-2 text-sm text-paper-2">Pour l’accessibilité, chaque fonction peut être ouverte sans se déplacer :</p>
      <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
        {ROOMS.map((r) => {
          const s = SPAWNS[r.id]
          return (
            <li key={r.id} className="flex items-center gap-2">
              <span className="font-jp text-amber">{r.ordinal}</span>
              <button className="text-left text-paper underline-offset-2 hover:underline" onClick={() => travelTo(r.id)}>
                {r.short}
              </button>
              {s.panel && (
                <button className="ml-auto text-xs text-amber hover:underline" onClick={() => useGame.getState().openPanel(s.panel!)}>
                  ouvrir
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <SectionTitle kanji="記">À propos</SectionTitle>
      <p className="text-sm text-paper-3">
        Ōshō — L’École des Ombres, domaine RP de Shikae Nara dans l’univers de Naruto. Décors, textures et sons sont générés procéduralement dans le navigateur. Les contenus marqués « démo · fictif » sont des exemples à remplacer.
      </p>
    </PanelFrame>
  )
}
