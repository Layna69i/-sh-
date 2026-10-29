/**
 * Bibliothèque des Secrets — système d'archives : recherche plein texte,
 * filtres (village, catégorie, classification), lecture, rédaction et
 * modification selon les permissions, niveaux d'habilitation.
 */
import { useMemo, useState } from 'react'
import { PanelFrame } from '../PanelFrame'
import type { PanelProps } from '../PanelHost'
import { DemoBadge, ClearanceBadge, Loading, Empty, ErrorNote, Field, Input, TextArea, Select, ConfirmButton, fmtDate, Pill } from '../kit'
import { useQuery } from '../../data/repository'
import { repo, useSession, mutate } from '../../data/session'
import { ARCHIVE_CATEGORIES, CLEARANCES, VILLAGES, VILLAGE_KANJI, can, nowIso, uid, type ArchiveDoc } from '../../data/types'
import { IconSearch, IconPlus, IconEdit, IconTrash, IconArrowLeft, IconLock } from '../icons'
import { audio } from '../../audio/engine'

const VILLAGE_OPTIONS = [...VILLAGES, 'Inter-villages'] as const
const catLabel = (id: string) => ARCHIVE_CATEGORIES.find((c) => c.id === id)?.label ?? id
const safeUrl = (u: string) => /^https?:\/\//i.test(u.trim())

function Editor({ initial, onDone }: { initial?: ArchiveDoc; onDone: (id?: string) => void }) {
  const session = useSession((s) => s.session)
  const [d, setD] = useState<ArchiveDoc>(
    initial ?? {
      id: uid('ar'),
      title: '',
      date: '',
      author: session.member?.name ?? '',
      village: 'Konoha',
      category: 'observation',
      clearance: Math.min(1, session.clearance),
      summary: '',
      body: '',
      tags: [],
      attachments: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  )
  const [tags, setTags] = useState(d.tags.join(', '))
  const [att, setAtt] = useState(d.attachments.map((a) => `${a.name} | ${a.url}`).join('\n'))
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    if (!d.title.trim()) return setErr('Le titre est obligatoire.')
    if (!d.body.trim()) return setErr('Le corps du dossier est vide.')
    const attachments = att
      .split('\n')
      .map((l) => l.split('|').map((x) => x.trim()))
      .filter(([n, u]) => n && u)
      .map(([name, url]) => ({ name, url }))
    if (attachments.some((a) => !safeUrl(a.url))) return setErr('Les pièces jointes doivent être des liens http(s).')
    const doc: ArchiveDoc = { ...d, tags: tags.split(',').map((t) => t.trim()).filter(Boolean), attachments, demo: false }
    const e = await mutate(['archives'], (r) => r.saveArchive(doc))
    if (e) setErr(e)
    else {
      audio.ui('confirm')
      onDone(doc.id)
    }
  }
  return (
    <div className="space-y-3">
      <Field label="Titre">
        <Input value={d.title} maxLength={140} onChange={(e) => setD({ ...d, title: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date (calendrier RP)" hint="Ex. : An II, 3e lune">
          <Input value={d.date} maxLength={60} onChange={(e) => setD({ ...d, date: e.target.value })} />
        </Field>
        <Field label="Auteur">
          <Input value={d.author} maxLength={80} onChange={(e) => setD({ ...d, author: e.target.value })} />
        </Field>
        <Field label="Village">
          <Select value={d.village} onChange={(e) => setD({ ...d, village: e.target.value as ArchiveDoc['village'] })}>
            {VILLAGE_OPTIONS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Catégorie">
          <Select value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as ArchiveDoc['category'] })}>
            {ARCHIVE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Classification" hint="Impossible de classer au-delà de votre habilitation.">
          <Select value={d.clearance} onChange={(e) => setD({ ...d, clearance: Number(e.target.value) })}>
            {CLEARANCES.map((c) => (
              <option key={c.level} value={c.level} disabled={c.level > session.clearance}>
                {c.jp} {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mots-clés" hint="Séparés par des virgules">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
      </div>
      <Field label="Résumé">
        <TextArea rows={2} maxLength={400} value={d.summary} onChange={(e) => setD({ ...d, summary: e.target.value })} />
      </Field>
      <Field label="Corps du dossier">
        <TextArea rows={10} maxLength={20000} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} />
      </Field>
      <Field label="Pièces jointes (une par ligne : nom | lien)">
        <TextArea rows={2} value={att} onChange={(e) => setAtt(e.target.value)} placeholder="Croquis du col | https://…" />
      </Field>
      <ErrorNote>{err}</ErrorNote>
      <div className="flex gap-2">
        <button className="btn-ink primary" onClick={save}>
          Archiver
        </button>
        <button className="btn-ink" onClick={() => onDone(initial?.id)}>
          Annuler
        </button>
      </div>
    </div>
  )
}

function DocView({ doc, onEdit, onDeleted, canWrite }: { doc: ArchiveDoc; onEdit: () => void; onDeleted: () => void; canWrite: boolean }) {
  const [err, setErr] = useState<string | null>(null)
  return (
    <article>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="seal h-8 w-8 text-sm" title={doc.village}>
          {VILLAGE_KANJI[doc.village] ?? '他'}
        </span>
        <ClearanceBadge level={doc.clearance} />
        <Pill>{catLabel(doc.category)}</Pill>
        <DemoBadge show={!!doc.demo} />
      </div>
      <h3 className="font-serif text-2xl text-paper">{doc.title}</h3>
      <div className="mt-1 text-sm text-paper-3">
        {doc.date || 'Date RP non précisée'} · {doc.author} · {doc.village} · mis à jour le {fmtDate(doc.updatedAt)}
      </div>
      {doc.summary && <p className="mt-3 border-l-2 border-amber/40 pl-3 text-paper-2 italic">{doc.summary}</p>}
      <div className="mt-4 whitespace-pre-line text-paper/90">{doc.body}</div>
      {doc.attachments.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-sm text-paper-2">Pièces jointes</div>
          <ul className="list-disc pl-5 text-sm">
            {doc.attachments.map((a) => (
              <li key={a.url}>
                {safeUrl(a.url) ? (
                  <a href={a.url} target="_blank" rel="noreferrer noopener" className="text-amber underline">
                    {a.name}
                  </a>
                ) : (
                  a.name
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {doc.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1">
          {doc.tags.map((t) => (
            <span key={t} className="rounded-sm bg-amber/10 px-2 py-0.5 text-xs text-amber">
              #{t}
            </span>
          ))}
        </div>
      )}
      <ErrorNote>{err}</ErrorNote>
      {canWrite && (
        <div className="mt-5 flex gap-2">
          <button className="btn-ink" onClick={onEdit}>
            <IconEdit /> Modifier
          </button>
          <ConfirmButton
            onConfirm={async () => {
              const e = await mutate(['archives'], (r) => r.deleteArchive(doc.id))
              if (e) setErr(e)
              else onDeleted()
            }}
          >
            <IconTrash /> Détruire le dossier
          </ConfirmButton>
        </div>
      )}
    </article>
  )
}

export default function ArchivesPanel({ close, params }: PanelProps) {
  const session = useSession((s) => s.session)
  const list = useQuery(['archives'], () => repo().listArchives(), [session.user?.uid])
  const [q, setQ] = useState('')
  const [village, setVillage] = useState<string>((params?.village as string) ?? 'all')
  const [cat, setCat] = useState('all')
  const [level, setLevel] = useState(-1)
  const [openId, setOpenId] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'new'>('view')
  const writer = can(session, 'archives.write')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (list.data ?? []).filter(
      (d) =>
        (village === 'all' || d.village === village) &&
        (cat === 'all' || d.category === cat) &&
        (level < 0 || d.clearance === level) &&
        (!needle || [d.title, d.summary, d.body, d.author, d.tags.join(' '), d.village].join(' ').toLowerCase().includes(needle)),
    )
  }, [list.data, q, village, cat, level])
  const open = list.data?.find((d) => d.id === openId) ?? null
  const rank = CLEARANCES[session.clearance]

  return (
    <PanelFrame title="La Bibliothèque des Secrets" kanji="秘書庫" subtitle="Archives et renseignements" onClose={close} width="xl">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-paper-2">
        <span className="flex items-center gap-2">
          <IconLock width={16} /> Votre habilitation : <ClearanceBadge level={session.clearance} />
        </span>
        <span>{list.data ? `${list.data.length} dossier(s) accessibles` : ''}</span>
        {!session.member && <Pill tone="warn">Visiteur : seules les archives publiques sont consultables.</Pill>}
        {writer && mode === 'view' && (
          <button
            className="btn-ink ml-auto"
            onClick={() => {
              setMode('new')
              setOpenId(null)
            }}
          >
            <IconPlus /> Nouveau dossier
          </button>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <div className={`${openId || mode !== 'view' ? 'hidden lg:block' : ''}`}>
          <div className="relative mb-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un dossier, un nom, un mot-clé…" className="pl-9" aria-label="Rechercher" />
            <IconSearch className="absolute top-1/2 left-2.5 -translate-y-1/2 text-paper-3" width={18} />
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <Select value={village} onChange={(e) => setVillage(e.target.value)} aria-label="Village">
              <option value="all">Tous villages</option>
              {VILLAGE_OPTIONS.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </Select>
            <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Catégorie">
              <option value="all">Toutes catégories</option>
              {ARCHIVE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Select value={level} onChange={(e) => setLevel(Number(e.target.value))} aria-label="Classification">
              <option value={-1}>Toutes classifications</option>
              {CLEARANCES.filter((c) => c.level <= session.clearance).map((c) => (
                <option key={c.level} value={c.level}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <ErrorNote>{list.error}</ErrorNote>
          {list.loading && !list.data ? (
            <Loading />
          ) : filtered.length === 0 ? (
            <Empty kanji="無">Aucun dossier ne correspond à cette recherche.</Empty>
          ) : (
            <ul className="divide-y divide-amber/10">
              {filtered.map((d) => (
                <li key={d.id}>
                  <button
                    className={`flex w-full gap-3 px-2 py-3 text-left transition hover:bg-amber/5 ${openId === d.id ? 'bg-amber/10' : ''}`}
                    onClick={() => {
                      setOpenId(d.id)
                      setMode('view')
                      audio.page()
                    }}
                  >
                    <span className="font-jp text-xl text-amber/80">{VILLAGE_KANJI[d.village] ?? '他'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-paper">{d.title}</span>
                      <span className="block truncate text-xs text-paper-3">
                        {catLabel(d.category)} · {d.date || '—'}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <ClearanceBadge level={d.clearance} />
                      {d.demo && <span className="text-[10px] text-amber/80 uppercase">démo</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {session.clearance < 4 && (
            <p className="mt-3 text-xs text-paper-3">
              Les dossiers classés au-delà du niveau « {rank.label} » ne vous sont ni visibles ni accessibles.
            </p>
          )}
        </div>
        <div className={`${!openId && mode === 'view' ? 'hidden lg:block' : ''}`}>
          {(openId || mode !== 'view') && (
            <button
              className="btn-ink ghost mb-3 lg:hidden"
              onClick={() => {
                setOpenId(null)
                setMode('view')
              }}
            >
              <IconArrowLeft /> Retour à la liste
            </button>
          )}
          {mode === 'new' && <Editor onDone={(id) => (setMode('view'), setOpenId(id ?? null))} />}
          {mode === 'edit' && open && <Editor initial={open} onDone={() => setMode('view')} />}
          {mode === 'view' && open && <DocView doc={open} canWrite={writer && open.clearance <= session.clearance} onEdit={() => setMode('edit')} onDeleted={() => setOpenId(null)} />}
          {mode === 'view' && !open && (
            <Empty kanji="書">
              Choisissez un dossier dans le registre. Les exemples fournis sont <strong>fictifs</strong> et attendent de véritables informations RP.
            </Empty>
          )}
        </div>
      </div>
    </PanelFrame>
  )
}
