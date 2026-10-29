/** Notes révélées par les objets : réflexions du Jardin du Silence, souvenirs du bureau de Shikae. */
import { PanelFrame } from '../PanelFrame'
import type { PanelProps } from '../PanelHost'

const NOTES: Record<string, { kanji: string; title: string; kind: string; text: string[]; place?: string; footer?: string }> = {
  lanterne: {
    kanji: '灯',
    title: 'La lanterne de pierre',
    kind: 'Réflexion',
    text: ['Une lanterne n’éclaire jamais tout le jardin. Elle choisit ce qu’elle montre — et, par là même, ce qu’elle laisse dans l’ombre.', 'L’informateur fait de même : la lumière qu’il porte sur un fait dessine aussi la forme de ce qu’il tait.'],
  },
  pierre: {
    kanji: '静観',
    title: 'La stèle « Seikan »',
    kind: 'Réflexion',
    text: ['静観 — observer en silence, sans intervenir.', 'Avant de jouer, le joueur de shogi regarde longtemps le plateau sans toucher une pièce. Ce temps n’est pas perdu : c’est là que la partie se gagne.'],
  },
  shishi: {
    kanji: '鹿威',
    title: 'Le shishi-odoshi',
    kind: 'Anecdote',
    text: ['Le nom de cette fontaine signifie littéralement « effraie-cerfs » : le claquement du bambou éloignait jadis les animaux des cultures.', 'Ironie douce pour un jardin du clan Nara, gardien des cerfs. Ici, le bambou ne chasse personne ; il mesure seulement le temps de la réflexion, goutte après goutte.'],
  },
  banc: {
    kanji: '間',
    title: 'Le banc de contemplation',
    kind: 'Réflexion',
    text: ['Ma (間) : l’intervalle, l’espace entre deux choses.', 'Dans une conversation comme dans une partie, ce qui compte n’est pas seulement le coup joué, mais l’espace laissé à l’autre pour se révéler.'],
  },
  bassin: {
    kanji: '水',
    title: 'Le bassin',
    kind: 'Réflexion',
    text: ['Une eau agitée ne reflète rien. Une eau calme montre le ciel tout entier.', 'Ainsi de l’esprit de l’observateur : tant qu’il s’agite, il ne voit que lui-même.'],
  },
  erable: {
    kanji: '紅葉',
    title: 'L’érable',
    kind: 'Réflexion',
    text: ['Les feuilles tombent sans bruit, une à une. Personne ne remarque la première ; tout le monde voit l’arbre nu.', 'Les grandes manœuvres commencent rarement par un éclat. Elles commencent par des détails que personne ne prend la peine de compter.'],
  },
  fenetre: {
    kanji: '森',
    title: 'La forêt des Nara',
    kind: 'Anecdote',
    place: 'Bureau de Shikae',
    footer: 'Le vent passe dans les cèdres ; au loin, un cerf traverse parfois la lisière.',
    text: ['Dans l’univers de Naruto, le clan Nara veille sur une forêt où vivent ses cerfs ; leurs bois entrent dans la préparation de remèdes réputés.', 'Depuis cette fenêtre, la forêt semble immobile. Elle ne l’est jamais : il suffit d’attendre assez longtemps pour voir passer une ombre entre les cèdres.'],
  },
  portrait: {
    kanji: '家族',
    title: 'Le portrait de famille',
    kind: 'Souvenir',
    place: 'Bureau de Shikae',
    footer: 'Le cadre est tourné vers sa place : il suffit de lever les yeux de ses notes.',
    text: ['Un portrait de famille, encadré avec soin, posé sur le bureau où Shikae travaille.', 'Entre les carnets d’analyse et les pièces de shogi, il est à portée de regard.'],
  },
  bandelette: {
    kanji: '包帯',
    title: 'La bandelette de Kaen',
    kind: 'Souvenir',
    place: 'Bureau de Shikae',
    footer: 'Pliée avec soin sur un tissu de soie, dans un plateau laqué, près du portrait.',
    text: ['Une bandelette ayant appartenu à Kaen, le frère de Shikae.', 'Elle n’est pas rangée dans un tiroir : Shikae la garde près d’elle, à portée de main.'],
  },
}

export default function GardenPanel({ close, params }: PanelProps) {
  const n = NOTES[(params?.note as string) ?? 'pierre'] ?? NOTES.pierre
  return (
    <PanelFrame title={n.title} kanji={n.kanji} subtitle={`${n.kind} · ${n.place ?? 'Jardin du Silence'}`} onClose={close} width="md">
      <div className="space-y-4 py-2">
        {n.text.map((t, i) => (
          <p key={i} className={i === 0 ? 'font-serif text-xl text-paper italic' : 'text-paper/90'}>
            {t}
          </p>
        ))}
        <div className="hairline" />
        <p className="text-sm text-paper-3">{n.footer ?? 'Restez un instant. Le son de l’eau et du bambou accompagne la réflexion.'}</p>
      </div>
    </PanelFrame>
  )
}
