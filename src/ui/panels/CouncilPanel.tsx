/**
 * Salle du Conseil — hiérarchie inspirée du shogi, annuaire des membres,
 * administration des membres et des grades (ordre, habilitation, permissions).
 */
import { useMemo, useState } from 'react'
import { PanelFrame } from '../PanelFrame'
import type { PanelProps } from '../PanelHost'
import { Tabs, DemoBadge, ClearanceBadge, Loading, Empty, ErrorNote, SuccessNote, Field, Input, TextArea, Select, ConfirmButton, Pill, InkAvatar, SectionTitle } from '../kit'
import { useQuery } from '../../data/repository'
import { repo, useSession, mutate } from '../../data/session'
import { ALL_PERMISSIONS, CLEARANCES, VILLAGES, can, nowIso, uid, type Member, type Rank, type Permission, type Village } from '../../data/types'
import { IconPlus, IconEdit, IconTrash } from '../icons'
import { audio } from '../../audio/engine'

type Tab = 'hierarchie' | 'membres' | 'admin'

function Hierarchy({ ranks, members }: { ranks: Rank[]; members: Member[] }) {
  const sorted = [...ranks].sort((a, b) => b.order - a.order)
  return (
    <div className="space-y-2">
      <p className="mb-3 text-paper-2">Chaque grade porte le nom d’une pièce du shogi. Cette organisation est une proposition de la direction : elle peut être modifiée à tout moment.</p>
      {sorted.map((r) => {
        const count = members.filter((m) => m.rankId === r.id).length
        return (
          <div key={r.id} className="flex items-start gap-4 rounded-sm border border-amber/15 bg-ink/40 p-3">
            <div className="flex h-14 w-12 shrink-0 items-center justify-center bg-[#d9b47a] font-jp text-2xl font-extrabold text-ink" style={{ clipPath: 'polygon(50% 0, 90% 22%, 100% 100%, 0 100%, 10% 22%)' }}>
              {r.kanji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-serif text-lg text-paper">{r.name}</span>
                <span className="text-sm text-paper-3 italic">{r.jp}</span>
                <ClearanceBadge level={r.clearance} />
                <Pill>{count} membre(s)</Pill>
              </div>
              <p className="text-sm text-paper-2">{r.description}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {r.permissions
                  .filter((p) => !['courses.enroll', 'missions.apply', 'strategy.use'].includes(p))
                  .map((p) => (
                    <span key={p} className="rounded-sm bg-amber/10 px-1.5 py-0.5 text-[11px] text-amber">
                      {ALL_PERMISSIONS.find((x) => x.id === p)?.label}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MemberCard({ m, rank, stats }: { m: Member; rank?: Rank; stats: { missions: number; courses: number | null } }) {
  return (
    <div className="flex gap-3 rounded-sm border border-amber/15 bg-ink/40 p-3">
      <InkAvatar seed={m.avatarSeed} size={64} kanji={rank?.kanji} url={m.avatarUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-serif text-lg text-paper">{m.name}</span>
          <DemoBadge show={!!m.demo} />
        </div>
        <div className="text-sm text-amber/90">
          {rank ? `${rank.kanji} ${rank.name}` : 'Grade inconnu'} · {m.village}
          {m.clan ? ` · clan ${m.clan}` : ''}
        </div>
        <div className="text-sm text-paper-2 italic">{m.specialty}</div>
        <p className="mt-1 text-sm text-paper/85">{m.description}</p>
        <div className="mt-1 text-xs text-paper-3">
          Missions accomplies : {stats.missions}
          {stats.courses !== null && ` · Enseignements suivis : ${stats.courses}`}
        </div>
      </div>
    </div>
  )
}

function MemberEditor({ initial, ranks, onDone }: { initial?: Member; ranks: Rank[]; onDone: () => void }) {
  const session = useSession((s) => s.session)
  const admin = can(session, 'members.manage')
  const [m, setM] = useState<Member>(initial ?? { id: uid('m'), uid: null, name: '', rankId: 'pion', village: 'Konoha', specialty: '', description: '', avatarSeed: Math.floor(Math.random() * 999), joinedAt: nowIso() })
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    if (!m.name.trim()) return setErr('Le nom RP est obligatoire.')
    const e = await mutate(['members'], (r) => r.saveMember({ ...m, demo: initial?.demo && !admin ? initial.demo : false }))
    if (e) setErr(e)
    else {
      audio.ui('confirm')
      onDone()
    }
  }
  return (
    <div className="space-y-3 rounded-sm border border-amber/25 bg-ink/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom RP">
          <Input value={m.name} maxLength={80} onChange={(e) => setM({ ...m, name: e.target.value })} disabled={!admin} />
        </Field>
        <Field label="Grade">
          <Select value={m.rankId} onChange={(e) => setM({ ...m, rankId: e.target.value })} disabled={!admin}>
            {ranks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.kanji} {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Village d’origine">
          <Select value={m.village} onChange={(e) => setM({ ...m, village: e.target.value as Village })}>
            {VILLAGES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Clan (facultatif)">
          <Input value={m.clan ?? ''} maxLength={40} onChange={(e) => setM({ ...m, clan: e.target.value })} />
        </Field>
        <Field label="Spécialité">
          <Input value={m.specialty} maxLength={100} onChange={(e) => setM({ ...m, specialty: e.target.value })} />
        </Field>
        <Field label="Portrait (lien d’image, facultatif)" hint="Sinon, un portrait à l’encre est généré.">
          <Input value={m.avatarUrl ?? ''} onChange={(e) => setM({ ...m, avatarUrl: e.target.value.trim() || undefined })} placeholder="https://…" />
        </Field>
        {admin && (
          <Field label="Identifiant du compte lié (uid)" hint="Associe la fiche à un compte connecté.">
            <Input value={m.uid ?? ''} onChange={(e) => setM({ ...m, uid: e.target.value.trim() || null })} />
          </Field>
        )}
      </div>
      <Field label="Description">
        <TextArea rows={3} maxLength={1500} value={m.description} onChange={(e) => setM({ ...m, description: e.target.value })} />
      </Field>
      <ErrorNote>{err}</ErrorNote>
      <div className="flex gap-2">
        <button className="btn-ink primary" onClick={save}>
          Enregistrer la fiche
        </button>
        <button className="btn-ink" onClick={onDone}>
          Annuler
        </button>
      </div>
    </div>
  )
}

function RankEditor({ rank, onDone }: { rank: Rank; onDone: () => void }) {
  const [r, setR] = useState<Rank>(rank)
  const [err, setErr] = useState<string | null>(null)
  const toggle = (p: Permission) => setR({ ...r, permissions: r.permissions.includes(p) ? r.permissions.filter((x) => x !== p) : [...r.permissions, p] })
  return (
    <div className="space-y-3 rounded-sm border border-amber/25 bg-ink/40 p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Nom">
          <Input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} />
        </Field>
        <Field label="Nom japonais">
          <Input value={r.jp} onChange={(e) => setR({ ...r, jp: e.target.value })} />
        </Field>
        <Field label="Kanji">
          <Input value={r.kanji} maxLength={2} onChange={(e) => setR({ ...r, kanji: e.target.value })} />
        </Field>
        <Field label="Ordre">
          <Input type="number" value={r.order} onChange={(e) => setR({ ...r, order: Number(e.target.value) })} />
        </Field>
      </div>
      <Field label="Habilitation aux archives">
        <Select value={r.clearance} onChange={(e) => setR({ ...r, clearance: Number(e.target.value) })}>
          {CLEARANCES.map((c) => (
            <option key={c.level} value={c.level}>
              {c.jp} {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Description">
        <TextArea rows={2} value={r.description} onChange={(e) => setR({ ...r, description: e.target.value })} />
      </Field>
      <div>
        <div className="mb-1 text-sm text-paper-2">Permissions</div>
        <div className="grid gap-1 sm:grid-cols-2">
          {ALL_PERMISSIONS.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={r.permissions.includes(p.id)} onChange={() => toggle(p.id)} /> {p.label}
            </label>
          ))}
        </div>
      </div>
      <ErrorNote>{err}</ErrorNote>
      <div className="flex gap-2">
        <button
          className="btn-ink primary"
          onClick={async () => {
            const e = await mutate(['ranks'], (x) => x.saveRank(r))
            if (e) setErr(e)
            else onDone()
          }}
        >
          Enregistrer le grade
        </button>
        <button className="btn-ink" onClick={onDone}>
          Annuler
        </button>
      </div>
    </div>
  )
}

export default function CouncilPanel({ close }: PanelProps) {
  const session = useSession((s) => s.session)
  const ranks = useQuery(['ranks'], () => repo().listRanks())
  const members = useQuery(['members'], () => repo().listMembers())
  const missions = useQuery(['missions'], () => repo().listMissions(), [session.user?.uid])
  const enrollments = useQuery(
    ['enrollments'],
    () => (can(session, 'courses.manage') ? repo().listAllEnrollments() : repo().listMyEnrollments()),
    [session.user?.uid],
  )
  const [tab, setTab] = useState<Tab>('hierarchie')
  const [editMember, setEditMember] = useState<Member | 'new' | null>(null)
  const [editRank, setEditRank] = useState<Rank | null>(null)
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({})
  const [query, setQuery] = useState('')
  const canMembers = can(session, 'members.manage')
  const canRanks = can(session, 'ranks.manage')
  const rankOf = (id: string) => ranks.data?.find((r) => r.id === id)
  const sortedMembers = useMemo(
    () =>
      [...(members.data ?? [])]
        .filter((m) => !query || `${m.name} ${m.specialty} ${m.village}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => (rankOf(b.rankId)?.order ?? 0) - (rankOf(a.rankId)?.order ?? 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members.data, ranks.data, query],
  )
  const statsFor = (m: Member) => ({
    missions: (missions.data ?? []).filter((mi) => mi.status === 'terminee' && mi.participants.some((p) => p.uid === m.uid || p.name === m.name)).length,
    courses: can(session, 'courses.manage') || m.uid === session.user?.uid ? (enrollments.data ?? []).filter((e) => e.uid === m.uid).length : null,
  })

  return (
    <PanelFrame title="La Salle du Conseil" kanji="評定" subtitle="Hiérarchie et membres de l’école" onClose={close} width="xl">
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { id: 'hierarchie', label: 'Hiérarchie', kanji: '駒' },
          { id: 'membres', label: 'Membres', kanji: '名' },
          { id: 'admin', label: 'Administration', kanji: '治', hidden: !canMembers && !canRanks },
        ]}
      />
      <ErrorNote>{msg.err ?? ranks.error ?? members.error}</ErrorNote>
      <SuccessNote>{msg.ok}</SuccessNote>
      {(ranks.loading && !ranks.data) || (members.loading && !members.data) ? (
        <Loading label="Le Conseil se réunit…" />
      ) : tab === 'hierarchie' ? (
        <Hierarchy ranks={ranks.data ?? []} members={members.data ?? []} />
      ) : tab === 'membres' ? (
        <div className="space-y-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un membre…" aria-label="Rechercher un membre" />
          {session.member && !editMember && (
            <button className="btn-ink" onClick={() => setEditMember(session.member)}>
              <IconEdit /> Modifier ma fiche
            </button>
          )}
          {editMember && editMember !== 'new' && editMember.id === session.member?.id && <MemberEditor initial={editMember} ranks={ranks.data ?? []} onDone={() => setEditMember(null)} />}
          {sortedMembers.length === 0 ? (
            <Empty>Aucun membre trouvé.</Empty>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {sortedMembers.map((m) => (
                <MemberCard key={m.id} m={m} rank={rankOf(m.rankId)} stats={statsFor(m)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {canMembers && (
            <section>
              <SectionTitle kanji="名" right={<button className="btn-ink !py-1" onClick={() => setEditMember('new')}><IconPlus /> Ajouter un membre</button>}>
                Membres
              </SectionTitle>
              {editMember && <MemberEditor initial={editMember === 'new' ? undefined : editMember} ranks={ranks.data ?? []} onDone={() => setEditMember(null)} />}
              <ul className="divide-y divide-amber/10">
                {sortedMembers.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2">
                    <InkAvatar seed={m.avatarSeed} size={36} url={m.avatarUrl} />
                    <span className="flex-1">
                      {m.name} <span className="text-sm text-paper-3">· {rankOf(m.rankId)?.name}</span> {m.demo && <DemoBadge />}
                    </span>
                    <button className="btn-ink !px-2 !py-1" onClick={() => setEditMember(m)} aria-label="Modifier">
                      <IconEdit />
                    </button>
                    {m.id !== session.member?.id && (
                      <ConfirmButton className="!px-2 !py-1" onConfirm={async () => setMsg((await mutate(['members'], (r) => r.deleteMember(m.id))) ? { err: 'Suppression impossible.' } : { ok: `${m.name} a été retiré du registre.` })}>
                        <IconTrash />
                      </ConfirmButton>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {canRanks && (
            <section>
              <SectionTitle
                kanji="駒"
                right={
                  <button
                    className="btn-ink !py-1"
                    onClick={() => setEditRank({ id: uid('rank'), name: 'Nouveau grade', jp: '', kanji: '新', order: (ranks.data?.length ?? 0) + 1, clearance: 1, permissions: ['courses.enroll', 'missions.apply', 'strategy.use'], description: '' })}
                  >
                    <IconPlus /> Créer un grade
                  </button>
                }
              >
                Grades et permissions
              </SectionTitle>
              {editRank && <RankEditor rank={editRank} onDone={() => setEditRank(null)} />}
              <ul className="divide-y divide-amber/10">
                {[...(ranks.data ?? [])]
                  .sort((a, b) => a.order - b.order)
                  .map((r) => (
                    <li key={r.id} className="flex items-center gap-3 py-2">
                      <span className="font-jp text-xl text-amber">{r.kanji}</span>
                      <span className="flex-1">
                        {r.order}. {r.name} <ClearanceBadge level={r.clearance} />
                      </span>
                      <button className="btn-ink !px-2 !py-1" onClick={() => setEditRank(r)} aria-label="Modifier">
                        <IconEdit />
                      </button>
                      <ConfirmButton className="!px-2 !py-1" onConfirm={async () => setMsg((await mutate(['ranks'], (x) => x.deleteRank(r.id))) ? { err: 'Ce grade ne peut pas être supprimé (encore attribué ?).' } : { ok: 'Grade supprimé.' })}>
                        <IconTrash />
                      </ConfirmButton>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </PanelFrame>
  )
}
