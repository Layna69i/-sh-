/**
 * Bureau des Missions — missions disponibles / en cours / terminées,
 * candidatures, décisions du responsable, rapports et validation.
 */
import { useMemo, useState } from 'react'
import { PanelFrame } from '../PanelFrame'
import type { PanelProps } from '../PanelHost'
import { Tabs, DemoBadge, ClearanceBadge, Loading, Empty, ErrorNote, SuccessNote, Field, Input, TextArea, Select, ConfirmButton, Pill, SectionTitle, fmtDate } from '../kit'
import { useQuery } from '../../data/repository'
import { repo, useSession, mutate } from '../../data/session'
import { CLEARANCES, DECISION_LABEL, MISSION_STATUS, REPORT_LABEL, VILLAGES, VILLAGE_KANJI, can, nowIso, uid, type Difficulty, type Mission, type MissionStatus, type ReportValidation } from '../../data/types'
import { IconPlus, IconEdit, IconTrash, IconArrowLeft } from '../icons'
import { audio } from '../../audio/engine'

const DIFF_COLOR: Record<Difficulty, string> = { D: '#8a8270', C: '#5f8f7c', B: '#6d8ac0', A: '#c08a4a', S: '#c0503c' }

function DiffSeal({ d }: { d: Difficulty }) {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-sm font-serif text-lg font-semibold text-ink" style={{ background: DIFF_COLOR[d] }} title={`Rang ${d}`}>
      {d}
    </span>
  )
}

function MissionEditor({ initial, onDone }: { initial?: Mission; onDone: (id?: string) => void }) {
  const session = useSession((s) => s.session)
  const [m, setM] = useState<Mission>(
    initial ?? { id: uid('mi'), title: '', summary: '', objectives: [], village: 'Konoha', difficulty: 'C', leader: session.member?.name ?? '', leaderUid: session.user?.uid, status: 'disponible', participants: [], maxParticipants: 3, clearance: 1, createdAt: nowIso() },
  )
  const [objectives, setObjectives] = useState(m.objectives.join('\n'))
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    if (!m.title.trim()) return setErr('Le titre est obligatoire.')
    const mission = { ...m, objectives: objectives.split('\n').map((o) => o.trim()).filter(Boolean), demo: false }
    const e = await mutate(['missions'], (r) => r.saveMission(mission))
    if (e) setErr(e)
    else {
      audio.ui('confirm')
      onDone(mission.id)
    }
  }
  return (
    <div className="space-y-3">
      <Field label="Titre de la mission">
        <Input value={m.title} maxLength={120} onChange={(e) => setM({ ...m, title: e.target.value })} />
      </Field>
      <Field label="Résumé">
        <TextArea rows={3} maxLength={1500} value={m.summary} onChange={(e) => setM({ ...m, summary: e.target.value })} />
      </Field>
      <Field label="Objectifs (un par ligne)">
        <TextArea rows={3} value={objectives} onChange={(e) => setObjectives(e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Village concerné">
          <Select value={m.village} onChange={(e) => setM({ ...m, village: e.target.value as Mission['village'] })}>
            {[...VILLAGES, 'Inter-villages'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Difficulté">
          <Select value={m.difficulty} onChange={(e) => setM({ ...m, difficulty: e.target.value as Difficulty })}>
            {(['D', 'C', 'B', 'A', 'S'] as Difficulty[]).map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Statut">
          <Select value={m.status} onChange={(e) => setM({ ...m, status: e.target.value as MissionStatus })}>
            {Object.entries(MISSION_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Responsable">
          <Input value={m.leader} onChange={(e) => setM({ ...m, leader: e.target.value })} />
        </Field>
        <Field label="Participants max.">
          <Input type="number" min={1} max={12} value={m.maxParticipants} onChange={(e) => setM({ ...m, maxParticipants: Math.max(1, Number(e.target.value)) })} />
        </Field>
        <Field label="Classification">
          <Select value={m.clearance} onChange={(e) => setM({ ...m, clearance: Number(e.target.value) })}>
            {CLEARANCES.map((c) => (
              <option key={c.level} value={c.level} disabled={c.level > session.clearance}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <ErrorNote>{err}</ErrorNote>
      <div className="flex gap-2">
        <button className="btn-ink primary" onClick={save}>
          Enregistrer
        </button>
        <button className="btn-ink" onClick={() => onDone(initial?.id)}>
          Annuler
        </button>
      </div>
    </div>
  )
}

function MissionSheet({ mission, onBack, onEdit }: { mission: Mission; onBack: () => void; onEdit: () => void }) {
  const session = useSession((s) => s.session)
  const manager = can(session, 'missions.manage')
  const apps = useQuery(['missionApps'], () => repo().listMissionApplications(mission.id), [mission.id, session.user?.uid])
  const reports = useQuery(['reports'], () => repo().listReports(mission.id), [mission.id, session.user?.uid])
  const [message, setMessage] = useState('')
  const [report, setReport] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({})
  const isParticipant = mission.participants.some((p) => p.uid === session.user?.uid)
  const myApp = apps.data?.find((a) => a.uid === session.user?.uid)
  const full = mission.participants.length >= mission.maxParticipants
  const act = async (keys: string[], fn: Parameters<typeof mutate>[1], ok: string) => {
    const e = await mutate(keys, fn)
    setMsg(e ? { err: e } : { ok })
    if (!e) audio.ui('confirm')
  }
  return (
    <div>
      <button className="btn-ink ghost mb-3" onClick={onBack}>
        <IconArrowLeft /> Toutes les missions
      </button>
      <div className="flex items-start gap-4">
        <DiffSeal d={mission.difficulty} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={mission.status === 'disponible' ? 'ok' : mission.status === 'en_cours' ? 'amber' : 'neutral'}>{MISSION_STATUS[mission.status]}</Pill>
            <ClearanceBadge level={mission.clearance} />
            <DemoBadge show={!!mission.demo} />
          </div>
          <h3 className="mt-2 font-serif text-2xl text-paper">{mission.title}</h3>
          <div className="text-sm text-paper-3">
            <span className="font-jp">{VILLAGE_KANJI[mission.village]}</span> {mission.village} · Responsable : {mission.leader} · créée le {fmtDate(mission.createdAt)}
          </div>
        </div>
      </div>
      <p className="mt-4 whitespace-pre-line">{mission.summary}</p>
      <SectionTitle kanji="的">Objectifs</SectionTitle>
      <ul className="list-disc space-y-1 pl-5">{mission.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
      <SectionTitle kanji="隊">
        Équipe ({mission.participants.length}/{mission.maxParticipants})
      </SectionTitle>
      {mission.participants.length === 0 ? <p className="text-sm text-paper-3 italic">Aucun participant pour l’instant.</p> : <div className="flex flex-wrap gap-2">{mission.participants.map((p) => <Pill key={p.uid}>{p.name}</Pill>)}</div>}

      <ErrorNote>{msg.err ?? apps.error}</ErrorNote>
      <SuccessNote>{msg.ok}</SuccessNote>

      {/* Candidature d'un membre */}
      {mission.status === 'disponible' && !isParticipant && (
        <div className="mt-4 rounded-sm border border-amber/20 bg-ink/40 p-4">
          {!session.member ? (
            <p className="text-sm text-paper-2">Seuls les membres connectés peuvent postuler à une mission.</p>
          ) : myApp ? (
            <p className="text-sm">
              Votre candidature : <Pill tone={myApp.status === 'acceptee' ? 'ok' : myApp.status === 'refusee' ? 'bad' : 'warn'}>{DECISION_LABEL[myApp.status]}</Pill>
            </p>
          ) : full ? (
            <p className="text-sm text-paper-2">L’équipe est complète.</p>
          ) : !can(session, 'missions.apply') ? (
            <p className="text-sm text-paper-2">Votre grade ne permet pas de postuler.</p>
          ) : (
            <div className="space-y-2">
              <Field label="Message au responsable">
                <TextArea rows={2} maxLength={800} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Pourquoi vous, pour cette mission ?" />
              </Field>
              <button className="btn-ink primary" onClick={() => act(['missionApps'], (r) => r.applyToMission(mission.id, message.trim()), 'Candidature transmise au responsable.')}>
                Postuler
              </button>
            </div>
          )}
        </div>
      )}

      {/* Décisions du responsable */}
      {manager && (
        <>
          <SectionTitle kanji="選">Candidatures reçues</SectionTitle>
          {!apps.data?.length ? (
            <p className="text-sm text-paper-3 italic">Aucune candidature.</p>
          ) : (
            <ul className="space-y-2">
              {apps.data.map((a) => (
                <li key={a.id} className="rounded-sm border border-amber/15 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex-1 text-paper">{a.name}</span>
                    <Pill tone={a.status === 'acceptee' ? 'ok' : a.status === 'refusee' ? 'bad' : 'warn'}>{DECISION_LABEL[a.status]}</Pill>
                  </div>
                  {a.message && <p className="mt-1 text-sm text-paper-2 italic">« {a.message} »</p>}
                  {a.status === 'en_attente' && (
                    <div className="mt-2 flex gap-2">
                      <button className="btn-ink primary !py-1" onClick={() => act(['missionApps', 'missions'], (r) => r.decideMissionApplication(a.id, 'acceptee'), `${a.name} rejoint l’équipe.`)}>
                        Accepter
                      </button>
                      <button className="btn-ink danger !py-1" onClick={() => act(['missionApps'], (r) => r.decideMissionApplication(a.id, 'refusee'), 'Candidature refusée.')}>
                        Refuser
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {mission.status !== 'en_cours' && (
              <button className="btn-ink" onClick={() => act(['missions'], (r) => r.saveMission({ ...mission, status: 'en_cours' }), 'Mission lancée.')}>
                Lancer la mission
              </button>
            )}
            {mission.status !== 'terminee' && (
              <button className="btn-ink" onClick={() => act(['missions'], (r) => r.saveMission({ ...mission, status: 'terminee' }), 'Mission close.')}>
                Clore la mission
              </button>
            )}
            <button className="btn-ink" onClick={onEdit}>
              <IconEdit /> Modifier
            </button>
            <ConfirmButton onConfirm={async () => ((await mutate(['missions'], (r) => r.deleteMission(mission.id))) ? setMsg({ err: 'Suppression impossible.' }) : onBack())}>
              <IconTrash /> Supprimer
            </ConfirmButton>
          </div>
        </>
      )}

      {/* Rapports */}
      {(isParticipant || manager) && (
        <>
          <SectionTitle kanji="報">Rapports de mission</SectionTitle>
          {reports.loading && !reports.data ? (
            <Loading label="Lecture des rapports…" />
          ) : !reports.data?.length ? (
            <p className="text-sm text-paper-3 italic">Aucun rapport rendu.</p>
          ) : (
            <ul className="space-y-3">
              {reports.data.map((rp) => (
                <li key={rp.id} className="rounded-sm border border-amber/15 bg-ink/35 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex-1 text-paper">
                      {rp.author} · {fmtDate(rp.createdAt)}
                    </span>
                    <Pill tone={rp.validation === 'valide' ? 'ok' : rp.validation === 'a_revoir' ? 'bad' : 'warn'}>{REPORT_LABEL[rp.validation]}</Pill>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-line">{rp.body}</p>
                  {rp.reviewerNote && (
                    <p className="mt-2 text-sm text-paper-2 italic">
                      Note de {rp.reviewedBy} : {rp.reviewerNote}
                    </p>
                  )}
                  {manager && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Input className="min-w-[200px] flex-1 !py-1" placeholder="Note pour l’auteur" value={notes[rp.id] ?? ''} onChange={(e) => setNotes({ ...notes, [rp.id]: e.target.value })} />
                      {(['valide', 'a_revoir'] as ReportValidation[]).map((v) => (
                        <button key={v} className={`btn-ink !py-1 ${v === 'valide' ? 'primary' : 'danger'}`} onClick={() => act(['reports'], (r) => r.reviewReport(rp.id, v, notes[rp.id] ?? ''), `Rapport marqué « ${REPORT_LABEL[v]} ».`)}>
                          {REPORT_LABEL[v]}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {isParticipant && mission.status !== 'disponible' && (
            <div className="mt-3 space-y-2">
              <Field label="Rendre un rapport">
                <TextArea rows={4} maxLength={8000} value={report} onChange={(e) => setReport(e.target.value)} placeholder="Ce que j’ai vu, ce que j’ai entendu, ce que j’en déduis." />
              </Field>
              <button
                className="btn-ink primary"
                disabled={!report.trim()}
                onClick={async () => {
                  await act(['reports'], (r) => r.submitReport(mission.id, report.trim()), 'Rapport transmis.')
                  setReport('')
                }}
              >
                Transmettre le rapport
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function MissionsPanel({ close, params }: PanelProps) {
  const session = useSession((s) => s.session)
  const missions = useQuery(['missions'], () => repo().listMissions(), [session.user?.uid])
  const myApps = useQuery(['missionApps'], () => repo().listMissionApplications(), [session.user?.uid])
  const [tab, setTab] = useState<MissionStatus | 'mine'>((params?.tab as MissionStatus) ?? 'disponible')
  const [openId, setOpenId] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'new'>('view')
  const manager = can(session, 'missions.manage')
  const list = useMemo(() => {
    const all = missions.data ?? []
    if (tab === 'mine') return all.filter((m) => m.participants.some((p) => p.uid === session.user?.uid) || myApps.data?.some((a) => a.missionId === m.id && a.uid === session.user?.uid))
    return all.filter((m) => m.status === tab)
  }, [missions.data, tab, myApps.data, session.user?.uid])
  const open = missions.data?.find((m) => m.id === openId)

  return (
    <PanelFrame title="Le Bureau des Missions" kanji="任務" subtitle="Ordres, équipes et rapports" onClose={close} width="xl">
      {mode === 'new' && <MissionEditor onDone={(id) => (setMode('view'), setOpenId(id ?? null))} />}
      {mode === 'edit' && open && <MissionEditor initial={open} onDone={() => setMode('view')} />}
      {mode === 'view' && open && <MissionSheet mission={open} onBack={() => setOpenId(null)} onEdit={() => setMode('edit')} />}
      {mode === 'view' && !open && (
        <>
          <div className="flex flex-wrap items-start gap-2">
            <div className="flex-1">
              <Tabs<MissionStatus | 'mine'>
                value={tab}
                onChange={setTab}
                items={[
                  { id: 'disponible', label: 'Disponibles', kanji: '募' },
                  { id: 'en_cours', label: 'En cours', kanji: '進' },
                  { id: 'terminee', label: 'Terminées', kanji: '了' },
                  { id: 'mine', label: 'Mes missions', kanji: '我', hidden: !session.member },
                ]}
              />
            </div>
            {manager && (
              <button className="btn-ink" onClick={() => setMode('new')}>
                <IconPlus /> Nouvelle mission
              </button>
            )}
          </div>
          <ErrorNote>{missions.error}</ErrorNote>
          {missions.loading && !missions.data ? (
            <Loading label="Consultation des ordres…" />
          ) : list.length === 0 ? (
            <Empty kanji="空">Aucune mission dans cette catégorie.</Empty>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((m) => (
                <button key={m.id} onClick={() => (setOpenId(m.id), audio.page())} className="flex gap-3 rounded-sm border border-amber/15 bg-ink/40 p-4 text-left transition hover:border-amber/50">
                  <DiffSeal d={m.difficulty} />
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-lg leading-tight text-paper">{m.title}</div>
                    <div className="text-xs text-paper-3">
                      <span className="font-jp">{VILLAGE_KANJI[m.village]}</span> {m.village} · {m.leader} · {m.participants.length}/{m.maxParticipants}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-paper-2">{m.summary}</p>
                    <div className="mt-2 flex gap-2">
                      {m.clearance > 0 && <ClearanceBadge level={m.clearance} />}
                      <DemoBadge show={!!m.demo} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {!session.member && <p className="mt-4 text-sm text-paper-3 italic">Visiteur : seules les missions publiques apparaissent. Connectez-vous pour postuler.</p>}
        </>
      )}
    </PanelFrame>
  )
}
