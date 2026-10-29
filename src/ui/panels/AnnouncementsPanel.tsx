/** Tableau des annonces du Hall : lecture publique, publication réservée. */
import { useState } from 'react'
import { PanelFrame } from '../PanelFrame'
import type { PanelProps } from '../PanelHost'
import { DemoBadge, ClearanceBadge, Loading, Empty, ErrorNote, Field, Input, TextArea, Select, ConfirmButton, fmtDate, Pill } from '../kit'
import { useQuery } from '../../data/repository'
import { repo, useSession, mutate } from '../../data/session'
import { CLEARANCES, can, nowIso, uid, type Announcement } from '../../data/types'
import { IconPlus, IconEdit, IconTrash } from '../icons'

export function AnnouncementEditor({ initial, onDone, channel = 'general' }: { initial?: Announcement; onDone: () => void; channel?: Announcement['channel'] }) {
  const session = useSession((s) => s.session)
  const [a, setA] = useState<Announcement>(
    initial ?? { id: uid('ann'), title: '', body: '', author: session.member?.name ?? 'Direction', createdAt: nowIso(), pinned: false, channel, clearance: 0 },
  )
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    if (!a.title.trim() || !a.body.trim()) return setErr('Un titre et un texte sont nécessaires.')
    const e = await mutate(['announcements'], (r) => r.saveAnnouncement({ ...a, demo: false }))
    if (e) setErr(e)
    else onDone()
  }
  return (
    <div className="space-y-3 rounded-sm border border-amber/25 bg-ink/40 p-4">
      <Field label="Titre">
        <Input value={a.title} maxLength={120} onChange={(e) => setA({ ...a, title: e.target.value })} />
      </Field>
      <Field label="Texte">
        <TextArea value={a.body} rows={5} maxLength={4000} onChange={(e) => setA({ ...a, body: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Visibilité">
          <Select value={a.clearance} onChange={(e) => setA({ ...a, clearance: Number(e.target.value) })}>
            {CLEARANCES.map((c) => (
              <option key={c.level} value={c.level} disabled={c.level > session.clearance}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Canal">
          <Select value={a.channel} onChange={(e) => setA({ ...a, channel: e.target.value as Announcement['channel'] })}>
            <option value="general">Annonces générales</option>
            <option value="direction">Messages de la direction</option>
          </Select>
        </Field>
        <label className="flex items-end gap-2 pb-2 text-sm text-paper-2">
          <input type="checkbox" checked={a.pinned} onChange={(e) => setA({ ...a, pinned: e.target.checked })} /> Épinglée
        </label>
      </div>
      <ErrorNote>{err}</ErrorNote>
      <div className="flex gap-2">
        <button className="btn-ink primary" onClick={save}>
          Publier
        </button>
        <button className="btn-ink" onClick={onDone}>
          Annuler
        </button>
      </div>
    </div>
  )
}

export function AnnouncementList({ channel }: { channel: Announcement['channel'] }) {
  const session = useSession((s) => s.session)
  const list = useQuery(['announcements'], () => repo().listAnnouncements(), [session.user?.uid])
  const [editing, setEditing] = useState<Announcement | 'new' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const manager = can(session, 'announcements.manage')
  const items = list.data?.filter((a) => a.channel === channel) ?? []
  return (
    <div className="space-y-4">
      {manager && !editing && (
        <button className="btn-ink" onClick={() => setEditing('new')}>
          <IconPlus /> Nouvelle annonce
        </button>
      )}
      {editing && <AnnouncementEditor initial={editing === 'new' ? undefined : editing} channel={channel} onDone={() => setEditing(null)} />}
      <ErrorNote>{err ?? list.error}</ErrorNote>
      {list.loading && !list.data ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty kanji="空">Aucune annonce pour le moment.</Empty>
      ) : (
        items.map((a) => (
          <article key={a.id} className="rounded-sm border border-amber/15 bg-ink/35 p-4">
            <header className="mb-2 flex flex-wrap items-center gap-2">
              {a.pinned && <span className="font-jp text-amber" title="Épinglée">釘</span>}
              <h3 className="flex-1 font-serif text-xl text-paper">{a.title}</h3>
              <DemoBadge show={!!a.demo} />
              {a.clearance > 0 && <ClearanceBadge level={a.clearance} />}
            </header>
            <p className="whitespace-pre-line text-paper/90">{a.body}</p>
            <footer className="mt-3 flex flex-wrap items-center gap-2 text-sm text-paper-3">
              <span>
                {a.author} · {fmtDate(a.createdAt)}
              </span>
              {manager && (
                <span className="ml-auto flex gap-2">
                  <button className="btn-ink !px-2 !py-1" onClick={() => setEditing(a)} aria-label="Modifier">
                    <IconEdit />
                  </button>
                  <ConfirmButton className="!px-2 !py-1" onConfirm={async () => setErr(await mutate(['announcements'], (r) => r.deleteAnnouncement(a.id)))}>
                    <IconTrash />
                  </ConfirmButton>
                </span>
              )}
            </footer>
          </article>
        ))
      )}
      {!session.member && <Pill>Connectez-vous pour lire les annonces réservées aux membres.</Pill>}
    </div>
  )
}

export default function AnnouncementsPanel({ close }: PanelProps) {
  return (
    <PanelFrame title="Annonces" kanji="告知" subtitle="Tableau du Hall des Ombres" onClose={close}>
      <AnnouncementList channel="general" />
    </PanelFrame>
  )
}
