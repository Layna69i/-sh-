/** Hall des Ombres — présentation de l'école (contenu fondé sur la fiche fournie). */
import { useState } from 'react'
import { PanelFrame } from '../PanelFrame'
import type { PanelProps } from '../PanelHost'
import { Tabs, SectionTitle } from '../kit'
import { Emblem } from '../Emblem'
import { useQuery } from '../../data/repository'
import { repo } from '../../data/session'

type Tab = 'ecole' | 'histoire' | 'principes' | 'objectifs' | 'fonctionnement'

function Ecole() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-5">
        <Emblem color="#d3a15b" className="h-20 w-20 shrink-0" />
        <p className="text-lg">
          <strong className="font-medium text-paper">Ōshō — L’École des Ombres</strong> est une école secrète des arts de la stratégie, de la parole et du renseignement, fondée par <strong className="font-medium text-paper">Shikae Nara</strong>, kunoichi du clan Nara de Konoha.
        </p>
      </div>
      <blockquote className="border-l-2 border-amber/50 pl-4 font-serif text-xl text-paper italic">« Si le roi ne bouge pas, ses sujets ne le suivront pas. »</blockquote>
      <p>
        Organisation d’apprentissage et de renseignement indépendante des forces spéciales, elle reste liée aux intérêts de Konoha et à l’héritage du clan Nara. Elle accueille des ninjas doués pour la stratégie, l’observation ou le renseignement, <em>indépendamment de leur grade ou de leur appartenance à un clan</em>.
      </p>
      <p>Son nom, Ōshō (王将), désigne le roi du shogi : la pièce qui ne se perd pas, et autour de laquelle toutes les autres prennent sens. La hiérarchie de l’école s’inspire de ces pièces.</p>
    </div>
  )
}

function Histoire() {
  return (
    <div className="space-y-4">
      <p>
        L’école est née de la volonté de Shikae Nara, fille de Shikazu Nara et de Shiori Nara. Calme, discrète et observatrice, elle a voulu réunir en un même lieu ce qui l’anime : l’anticipation, le shogi et la conséquence de chaque décision, la psychologie, l’art des mots et la compréhension des relations entre les villages shinobi.
      </p>
      <p>Le domaine se dissimule dans une forêt ancienne du Pays du Feu, là où les cerfs — emblèmes du clan Nara — continuent de passer entre les cèdres.</p>
      <p className="rounded-sm border border-amber/20 bg-ink/40 p-3 text-sm text-paper-2 italic">
        Les étapes précises de la fondation (dates, premiers membres, événements marquants) seront consignées ici par l’équipe RP. Aucun fait définitif n’a été inventé pour cette page.
      </p>
    </div>
  )
}

const PRINCIPLES = [
  { k: '先', t: 'Anticiper', d: 'Voir trois coups plus loin que l’adversaire. Une décision se juge à ses conséquences, pas à son éclat.' },
  { k: '観', t: 'Observer', d: 'Avant d’agir, regarder. Avant de parler, écouter. L’information précède toujours l’action.' },
  { k: '言', t: 'Peser ses mots', d: 'La parole est une arme : elle ouvre des portes, désarme des conflits et révèle ceux qui parlent trop.' },
  { k: '影', t: 'Rester dans l’ombre', d: 'La discrétion protège l’école, ses membres et leurs informateurs. Ce qui est appris ici reste ici.' },
  { k: '王', t: 'Montrer la voie', d: 'Celui qui dirige avance le premier. Le roi qui ne bouge pas ne sera pas suivi.' },
  { k: '和', t: 'Servir Konoha', d: 'L’école sert les intérêts de Konoha et l’héritage du clan Nara, tout en comprenant ceux des autres villages.' },
]

function Principes() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PRINCIPLES.map((p) => (
        <div key={p.t} className="flex gap-3 rounded-sm border border-amber/15 bg-ink/40 p-3">
          <span className="font-jp text-3xl text-amber/90">{p.k}</span>
          <div>
            <div className="font-medium text-paper">{p.t}</div>
            <div className="text-sm text-paper-2">{p.d}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Objectifs() {
  return (
    <ul className="space-y-3">
      {[
        ['報', 'Former des informateurs', 'Transmettre l’observation, la collecte et la protection des sources.'],
        ['任', 'Organiser des missions RP', 'Proposer, encadrer et consigner des missions de renseignement et de diplomatie.'],
        ['教', 'Transmettre des enseignements', 'Stratégie, analyse comportementale, psychologie, oratoire, diplomatie, interrogatoire et influence dans le cadre narratif.'],
        ['庫', 'Constituer un répertoire', 'Rassembler les informations concernant Konoha, Suna, Ame et Kiri dans la Bibliothèque des Secrets.'],
      ].map(([k, t, d]) => (
        <li key={t} className="flex gap-3">
          <span className="seal h-9 w-9 shrink-0 text-base">{k}</span>
          <div>
            <div className="font-medium text-paper">{t}</div>
            <div className="text-sm text-paper-2">{d}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function Fonctionnement() {
  const ranks = useQuery(['ranks'], () => repo().listRanks())
  return (
    <div className="space-y-4">
      <p>Chaque salle du domaine possède une fonction, comme chaque pièce d’un plateau de shogi :</p>
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        <li><span className="font-jp text-amber">弐</span> Bibliothèque des Secrets — archives et renseignements</li>
        <li><span className="font-jp text-amber">参</span> Chambre du Shogi — stratégie et réflexion</li>
        <li><span className="font-jp text-amber">肆</span> Dojo de l’Éloquence — enseignements</li>
        <li><span className="font-jp text-amber">伍</span> Bureau des Missions — missions et rapports</li>
        <li><span className="font-jp text-amber">陸</span> Salle du Conseil — hiérarchie et membres</li>
        <li><span className="font-jp text-amber">漆</span> Bureau de Shikae Nara — direction</li>
        <li><span className="font-jp text-amber">捌</span> Bureau de Recrutement — admissions</li>
        <li><span className="font-jp text-amber">玖</span> Jardin du Silence — contemplation</li>
      </ul>
      <SectionTitle kanji="駒">Hiérarchie</SectionTitle>
      <p className="text-sm text-paper-2">Les grades s’inspirent des pièces du shogi. Ils déterminent l’habilitation aux archives et les responsabilités ; la direction peut les modifier.</p>
      <div className="flex flex-wrap gap-2">
        {ranks.data?.map((r) => (
          <span key={r.id} className="flex items-center gap-1.5 rounded-sm border border-amber/20 px-2 py-1 text-sm">
            <span className="font-jp text-amber">{r.kanji}</span>
            {r.name}
          </span>
        ))}
      </div>
      <p className="text-sm text-paper-2">
        Visiteurs : présentation, enseignements publics, annonces publiques, hiérarchie et dépôt de candidature. Membres : archives selon l’habilitation, inscriptions, missions et table stratégique.
      </p>
    </div>
  )
}

export default function PresentationPanel({ close, params }: PanelProps) {
  const [tab, setTab] = useState<Tab>((params?.tab as Tab) ?? 'ecole')
  return (
    <PanelFrame title="L’École des Ombres" kanji="王将" subtitle="Hall des Ombres — présentation" onClose={close}>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { id: 'ecole', label: 'L’école' },
          { id: 'histoire', label: 'Histoire' },
          { id: 'principes', label: 'Principes' },
          { id: 'objectifs', label: 'Objectifs' },
          { id: 'fonctionnement', label: 'Fonctionnement' },
        ]}
      />
      {tab === 'ecole' && <Ecole />}
      {tab === 'histoire' && <Histoire />}
      {tab === 'principes' && <Principes />}
      {tab === 'objectifs' && <Objectifs />}
      {tab === 'fonctionnement' && <Fonctionnement />}
    </PanelFrame>
  )
}
