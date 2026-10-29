/**
 * Bureau de Recrutement — formulaire de candidature (public) et examen des
 * candidatures avec notes privées (responsables habilités).
 */
import { useState } from 'react'
import { PanelFrame } from '../PanelFrame'
import type { PanelProps } from '../PanelHost'
import { Tabs, DemoBadge, Loading, Empty, ErrorNote, SuccessNote, Field, Input, TextArea, Select, Pill, SectionTitle, fmtDate } from '../kit'
import { useQuery } from '../../data/repository'
import { repo, useSession, mutate } from '../../data/session'
import { DECISION_LABEL, VILLAGES, can, nowIso, uid, type Candidature, type Decision, type Village } from '../../data/types'
import { IconArrowLeft } from '../icons'
import { audio } from '../../audio/engine'

type Form = Omit<Candidature, 'id' | 'status' | 'notes' | 'createdAt'>
const EMPTY: Form = { characterName: '', village: 'Konoha', clan: '', grade: 'Genin', motivations: '', skills: '', rpExperience: '', goals: '', contact: '' }
const GRADES = ['Étudiant de l’Académie', 'Genin', 'Chūnin', 'Jōnin', 'Jōnin spécial', 'Autre']

function ApplyForm() {
  const [f, setF] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v })
  const submit = async () => {
    const e: Partial<Record<keyof Form, string>> = {}
    if (f.characterName.trim().length < 2) e.characterName = 'Indiquez le nom de votre personnage.'
    if (f.motivations.trim().length < 30) e.motivations = 'Développez un peu vos motivations (30 caractères minimum).'
    if (f.skills.trim().length < 10) e.skills = 'Décrivez au moins une compétence.'
    if (f.goals.trim().length < 10) e.goals = 'Précisez ce que vous souhaitez accomplir à l’école.'
    setErrors(e)
    if (Object.keys(e).length) {
      audio.ui('error')
      return
    }
    setBusy(true)
    const res = await mutate(['candidatures'], (r) => r.submitCandidature({ ...f, characterName: f.characterName.trim() }))
    setBusy(false)
    if (res) setErr(res)
    else {
      setSent(true)
      audio.ui('confirm')
    }
  }
  if (sent)
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="seal h-16 w-16 text-3xl">受</span>
        <h3 className="font-serif text-2xl text-paper">Candidature reçue</h3>
        <p className="max-w-md text-paper-2">Votre dossier a été déposé sur le bureau d’admission. Les responsables l’examineront avec attention ; la réponse vous parviendra en jeu.</p>
        <button
          className="btn-ink"
          onClick={() => {
            setF(EMPTY)
            setSent(false)
          }}
        >
          Déposer une autre candidature
        </button>
      </div>
    )
  return (
    <div className="space-y-3">
      <p className="text-paper-2">L’école accueille les ninjas doués pour la stratégie, l’observation ou le renseignement, indépendamment de leur grade ou de leur clan. Tous les champs concernent votre personnage RP.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom du personnage *" error={errors.characterName}>
          <Input value={f.characterName} maxLength={80} onChange={(e) => set('characterName', e.target.value)} />
        </Field>
        <Field label="Village">
          <Select value={f.village} onChange={(e) => set('village', e.target.value as Village)}>
            {VILLAGES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Clan (facultatif)">
          <Input value={f.clan} maxLength={40} onChange={(e) => set('clan', e.target.value)} />
        </Field>
        <Field label="Grade shinobi">
          <Select value={f.grade} onChange={(e) => set('grade', e.target.value)}>
            {GRADES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Motivations *" error={errors.motivations}>
        <TextArea rows={4} maxLength={3000} value={f.motivations} onChange={(e) => set('motivations', e.target.value)} />
      </Field>
      <Field label="Compétences *" hint="Observation, mémoire, négociation, filature…" error={errors.skills}>
        <TextArea rows={3} maxLength={2000} value={f.skills} onChange={(e) => set('skills', e.target.value)} />
      </Field>
      <Field label="Expérience RP">
        <TextArea rows={2} maxLength={2000} value={f.rpExperience} onChange={(e) => set('rpExperience', e.target.value)} />
      </Field>
      <Field label="Objectifs dans l’école *" error={errors.goals}>
        <TextArea rows={2} maxLength={2000} value={f.goals} onChange={(e) => set('goals', e.target.value)} />
      </Field>
      <Field label="Contact hors jeu (facultatif)" hint="Pseudonyme de serveur ou de forum. N’indiquez aucune donnée personnelle sensible.">
        <Input value={f.contact} maxLength={80} onChange={(e) => set('contact', e.target.value)} />
      </Field>
      <ErrorNote>{err}</ErrorNote>
      <button className="btn-ink primary" onClick={submit} disabled={busy}>
        {busy ? 'Dépôt en cours…' : 'Déposer ma candidature'}
      </button>
    </div>
  )
}

function Review() {
  const session = useSession((s) => s.session)
  const list = useQuery(['candidatures'], () => repo().listCandidatures(), [session.user?.uid])
  const [filter, setFilter] = useState<Decision | 'all'>('en_attente')
  const [openId, setOpenId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({})
  const open = list.data?.find((c) => c.id === openId)
  const act = async (fn: Parameters<typeof mutate>[1], ok: string, keys = ['candidatures']) => {
    const e = await mutate(keys, fn)
    setMsg(e ? { err: e } : { ok })
  }
  if (list.loading && !list.data) return <Loading label="Ouverture des dossiers…" />
  if (list.error) return <ErrorNote>{list.error}</ErrorNote>
  if (open)
    return (
      <div>
        <button className="btn-ink ghost mb-3" onClick={() => setOpenId(null)}>
          <IconArrowLeft /> Toutes les candidatures
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex-1 font-serif text-2xl text-paper">{open.characterName}</h3>
          <Pill tone={open.status === 'acceptee' ? 'ok' : open.status === 'refusee' ? 'bad' : 'warn'}>{DECISION_LABEL[open.status]}</Pill>
          <DemoBadge show={!!open.demo} />
        </div>
        <div className="text-sm text-paper-3">
          {open.village} · {open.clan || 'sans clan'} · {open.grade} · déposée le {fmtDate(open.createdAt)} {open.contact && `· contact : ${open.contact}`}
        </div>
        {(
          [
            ['Motivations', open.motivations],
            ['Compétences', open.skills],
            ['Expérience RP', open.rpExperience],
            ['Objectifs', open.goals],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="mt-3">
            <div className="text-sm text-amber/90">{k}</div>
            <p className="whitespace-pre-line">{v || '—'}</p>
          </div>
        ))}
        <SectionTitle kanji="秘">Notes privées des responsables</SectionTitle>
        {open.notes.length === 0 ? (
          <p className="text-sm text-paper-3 italic">Aucune note.</p>
        ) : (
          <ul className="space-y-2">
            {open.notes.map((n, i) => (
              <li key={i} className="rounded-sm border border-amber/15 p-2 text-sm">
                <span className="text-paper-3">
                  {n.author} · {fmtDate(n.at)}
                </span>
                <p>{n.text}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ajouter une note (invisible du candidat)" />
          <button
            className="btn-ink"
            disabled={!note.trim()}
            onClick={async () => {
              await act((r) => r.addCandidatureNote(open.id, note.trim()), 'Note ajoutée.')
              setNote('')
            }}
          >
            Noter
          </button>
        </div>
        <ErrorNote>{msg.err}</ErrorNote>
        <SuccessNote>{msg.ok}</SuccessNote>
        <div className="mt-4 flex flex-wrap gap-2">
          {(['acceptee', 'refusee', 'en_attente'] as Decision[])
            .filter((d) => d !== open.status)
            .map((d) => (
              <button key={d} className={`btn-ink ${d === 'acceptee' ? 'primary' : d === 'refusee' ? 'danger' : ''}`} onClick={() => act((r) => r.setCandidatureStatus(open.id, d), `Statut : ${DECISION_LABEL[d]}.`)}>
                {d === 'acceptee' ? 'Accepter' : d === 'refusee' ? 'Refuser' : 'Remettre en attente'}
              </button>
            ))}
          {open.status === 'acceptee' && can(session, 'members.manage') && (
            <button
              className="btn-ink"
              onClick={() =>
                act(
                  (r) => r.saveMember({ id: uid('m'), uid: open.uid ?? null, name: open.characterName, rankId: 'pion', village: open.village, clan: open.clan || undefined, specialty: open.skills.slice(0, 90), description: open.goals, avatarSeed: Math.floor(Math.random() * 999), joinedAt: nowIso() }),
                  `Fiche membre créée pour ${open.characterName} (grade : Pion).`,
                  ['members'],
                )
              }
            >
              Créer la fiche membre
            </button>
          )}
        </div>
      </div>
    )
  const items = (list.data ?? []).filter((c) => filter === 'all' || c.status === filter)
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(['en_attente', 'acceptee', 'refusee', 'all'] as const).map((f) => (
          <button key={f} className={`btn-ink !py-1 ${filter === f ? 'primary' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Toutes' : DECISION_LABEL[f]} ({(list.data ?? []).filter((c) => f === 'all' || c.status === f).length})
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <Empty kanji="空">Aucune candidature dans cette catégorie.</Empty>
      ) : (
        <ul className="divide-y divide-amber/10">
          {items.map((c) => (
            <li key={c.id}>
              <button className="flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-amber/5" onClick={() => (setOpenId(c.id), audio.page())}>
                <span className="flex-1">
                  <span className="text-paper">{c.characterName}</span>
                  <span className="ml-2 text-sm text-paper-3">
                    {c.village} · {c.grade} · {fmtDate(c.createdAt)}
                  </span>
                </span>
                {c.notes.length > 0 && <Pill>{c.notes.length} note(s)</Pill>}
                <Pill tone={c.status === 'acceptee' ? 'ok' : c.status === 'refusee' ? 'bad' : 'warn'}>{DECISION_LABEL[c.status]}</Pill>
                <DemoBadge show={!!c.demo} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function RecruitmentPanel({ close }: PanelProps) {
  const session = useSession((s) => s.session)
  const reviewer = can(session, 'applications.review')
  const [tab, setTab] = useState<'apply' | 'review'>(reviewer ? 'review' : 'apply')
  return (
    <PanelFrame title="Le Bureau de Recrutement" kanji="入門" subtitle="Candidatures et admissions" onClose={close}>
      <Tabs<'apply' | 'review'>
        value={tab}
        onChange={setTab}
        items={[
          { id: 'apply', label: 'Déposer une candidature', kanji: '志' },
          { id: 'review', label: 'Examen des candidatures', kanji: '審', hidden: !reviewer },
        ]}
      />
      {tab === 'apply' ? <ApplyForm /> : <Review />}
    </PanelFrame>
  )
}
