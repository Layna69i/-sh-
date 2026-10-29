/**
 * Le carnet de Shikae Nara (bureau de la fondatrice). Seuls les éléments de
 * la fiche fournie sont présentés comme des faits ; le reste est signalé
 * comme à compléter par l'équipe RP.
 */
import { useState } from 'react'
import { PanelFrame } from '../PanelFrame'
import type { PanelProps } from '../PanelHost'
import { Tabs } from '../kit'
import { AnnouncementList } from './AnnouncementsPanel'

type Tab = 'presentation' | 'histoire' | 'philosophie' | 'projets' | 'messages'

const Page = ({ children }: { children: React.ReactNode }) => (
  <div className="relative rounded-sm border border-[#8a7a5a]/40 bg-[#d9ceb3] p-6 text-[#1b1712] shadow-inner md:p-8" style={{ backgroundImage: 'var(--paper-noise)' }}>
    <div className="pointer-events-none absolute inset-y-4 left-10 w-px bg-[#9a3326]/30" />
    <div className="space-y-4 pl-6 font-serif text-[1.08rem] leading-relaxed">{children}</div>
  </div>
)

export default function NotebookPanel({ close }: PanelProps) {
  const [tab, setTab] = useState<Tab>('presentation')
  return (
    <PanelFrame title="Le carnet de Shikae Nara" kanji="書斎" subtitle="Bureau de la fondatrice" onClose={close} width="lg">
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { id: 'presentation', label: 'Présentation' },
          { id: 'histoire', label: 'Histoire' },
          { id: 'philosophie', label: 'Philosophie' },
          { id: 'projets', label: 'Projets' },
          { id: 'messages', label: 'Messages de la direction' },
        ]}
      />
      {tab === 'presentation' && (
        <Page>
          <h3 className="text-2xl"><span className="font-jp">奈良</span> · Shikae Nara</h3>
          <p>Jeune kunoichi issue du clan Nara de Konoha, fille de Shikazu Nara et de Shiori Nara. Fondatrice de l’École des Ombres.</p>
          <p>Calme, discrète, observatrice. Elle s’intéresse à :</p>
          <ul className="list-disc pl-6">
            <li>la stratégie et l’anticipation ;</li>
            <li>le shogi et les conséquences de chaque décision ;</li>
            <li>la psychologie et l’analyse comportementale ;</li>
            <li>le maniement des mots, l’oratoire et la diplomatie ;</li>
            <li>la collecte d’informations ;</li>
            <li>la manipulation et les interrogatoires, dans le contexte RP ;</li>
            <li>la compréhension des relations entre les villages shinobi.</li>
          </ul>
        </Page>
      )}
      {tab === 'histoire' && (
        <Page>
          <p>Fille de Shikazu et de Shiori, Shikae a grandi dans l’héritage du clan Nara, entre les ombres et la forêt des cerfs.</p>
          <p className="rounded-sm border border-dashed border-[#6b5a3c] p-3 text-[0.95rem] italic">
            Les pages suivantes sont restées blanches. Le récit de son parcours sera ajouté par l’équipe RP : aucun fait n’a été inventé ici.
          </p>
        </Page>
      )}
      {tab === 'philosophie' && (
        <Page>
          <p className="text-center font-jp text-3xl">王将</p>
          <blockquote className="text-center text-xl italic">« Si le roi ne bouge pas, ses sujets ne le suivront pas. »</blockquote>
          <p>Diriger, c’est s’exposer le premier. L’école n’exige de ses membres que ce que sa direction accepte elle-même de faire.</p>
          <p>Chaque coup a des conséquences : on ne juge pas une décision à son éclat immédiat, mais à la position qu’elle laisse trois coups plus tard.</p>
          <p>L’information précède l’action, l’écoute précède la parole. Les mots, bien choisis, déplacent plus de pièces que la force.</p>
          <p className="text-[0.95rem] italic">— Notes de travail tirées de la devise de l’école.</p>
        </Page>
      )}
      {tab === 'projets' && (
        <Page>
          <h3 className="text-xl">Projets de l’établissement</h3>
          <ol className="list-decimal space-y-2 pl-6">
            <li>Former des informateurs capables d’observer sans être vus et de rapporter fidèlement.</li>
            <li>Organiser des missions RP de renseignement et de diplomatie.</li>
            <li>Transmettre des enseignements : stratégie, psychologie, oratoire, diplomatie, observation, interrogatoire et influence narrative.</li>
            <li>Constituer un répertoire d’informations sur Konoha, Suna, Ame et Kiri.</li>
            <li>Accueillir les talents de l’observation et de la stratégie, quel que soit leur grade ou leur clan.</li>
          </ol>
        </Page>
      )}
      {tab === 'messages' && <AnnouncementList channel="direction" />}
    </PanelFrame>
  )
}
