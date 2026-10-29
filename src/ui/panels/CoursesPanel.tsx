/**
 * Dojo de l'Éloquence — catalogue des enseignements, fiches détaillées,
 * inscriptions, supports de cours, suivi de progression, administration.
 */
import { useMemo, useState } from 'react'
import { PanelFrame } from '../PanelFrame'
import type { PanelProps } from '../PanelHost'
import { DemoBadge, Loading, Empty, ErrorNote, SuccessNote, Field, Input, TextArea, Select, ConfirmButton, Pill, SectionTitle } from '../kit'
import { useQuery } from '../../data/repository'
import { repo, useSession, mutate } from '../../data/session'
import { COURSE_STATUS, DISCIPLINES, can, nowIso, uid, type Course, type CourseStatus, type Discipline, type Lesson } from '../../data/types'
import { IconPlus, IconEdit, IconTrash, IconArrowLeft, IconCheck } from '../icons'
import { audio } from '../../audio/engine'

const disc = (id: Discipline) => DISCIPLINES.find((d) => d.id === id)!
const statusTone = (s: CourseStatus) => (s === 'ouvert' ? 'ok' : s === 'en_cours' ? 'amber' : s === 'brouillon' ? 'warn' : 'neutral') as 'ok' | 'amber' | 'warn' | 'neutral'

function CourseEditor({ initial, onDone }: { initial?: Course; onDone: (id?: string) => void }) {
  const session = useSession((s) => s.session)
  const [c, setC] = useState<Course>(
    initial ?? {
      id: uid('c'),
      title: '',
      discipline: 'strategie',
      teacher: session.member?.name ?? '',
      description: '',
      objectives: [],
      lessons: [{ id: uid('l'), title: '', body: '' }],
      level: 'Ouvert à tous les membres',
      date: '',
      status: 'brouillon',
      visibility: 'public',
      createdAt: nowIso(),
    },
  )
  const [objectives, setObjectives] = useState(c.objectives.join('\n'))
  const [err, setErr] = useState<string | null>(null)
  const setLesson = (i: number, patch: Partial<Lesson>) => setC({ ...c, lessons: c.lessons.map((l, k) => (k === i ? { ...l, ...patch } : l)) })
  const save = async () => {
    if (!c.title.trim()) return setErr('Le titre est obligatoire.')
    const lessons = c.lessons.filter((l) => l.title.trim())
    const course: Course = { ...c, lessons, objectives: objectives.split('\n').map((o) => o.trim()).filter(Boolean), demo: false }
    const e = await mutate(['courses'], (r) => r.saveCourse(course))
    if (e) setErr(e)
    else {
      audio.ui('confirm')
      onDone(course.id)
    }
  }
  return (
    <div className="space-y-3">
      <Field label="Intitulé">
        <Input value={c.title} maxLength={120} onChange={(e) => setC({ ...c, title: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Discipline">
          <Select value={c.discipline} onChange={(e) => setC({ ...c, discipline: e.target.value as Discipline })}>
            {DISCIPLINES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.kanji} {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Professeur">
          <Input value={c.teacher} maxLength={80} onChange={(e) => setC({ ...c, teacher: e.target.value })} />
        </Field>
        <Field label="Niveau requis">
          <Input value={c.level} maxLength={80} onChange={(e) => setC({ ...c, level: e.target.value })} />
        </Field>
        <Field label="Date / rythme">
          <Input value={c.date} maxLength={80} onChange={(e) => setC({ ...c, date: e.target.value })} placeholder="Ex. : chaque 2e lune" />
        </Field>
        <Field label="Statut">
          <Select value={c.status} onChange={(e) => setC({ ...c, status: e.target.value as CourseStatus })}>
            {Object.entries(COURSE_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Visibilité">
          <Select value={c.visibility} onChange={(e) => setC({ ...c, visibility: e.target.value as Course['visibility'] })}>
            <option value="public">Visible des visiteurs</option>
            <option value="membres">Réservé aux membres</option>
          </Select>
        </Field>
      </div>
      <Field label="Description">
        <TextArea rows={3} maxLength={1200} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} />
      </Field>
      <Field label="Objectifs (un par ligne)">
        <TextArea rows={3} value={objectives} onChange={(e) => setObjectives(e.target.value)} />
      </Field>
      <SectionTitle kanji="巻">Supports de cours</SectionTitle>
      {c.lessons.map((l, i) => (
        <div key={l.id} className="space-y-2 rounded-sm border border-amber/15 p-3">
          <div className="flex gap-2">
            <Input value={l.title} placeholder={`Leçon ${i + 1} — titre`} onChange={(e) => setLesson(i, { title: e.target.value })} />
            <button className="btn-ink danger !px-2" aria-label="Retirer la leçon" onClick={() => setC({ ...c, lessons: c.lessons.filter((_, k) => k !== i) })}>
              <IconTrash />
            </button>
          </div>
          <TextArea rows={3} value={l.body} placeholder="Contenu de la leçon" onChange={(e) => setLesson(i, { body: e.target.value })} />
        </div>
      ))}
      <button className="btn-ink" onClick={() => setC({ ...c, lessons: [...c.lessons, { id: uid('l'), title: '', body: '' }] })}>
        <IconPlus /> Ajouter une leçon
      </button>
      <ErrorNote>{err}</ErrorNote>
      <div className="flex gap-2">
        <button className="btn-ink primary" onClick={save}>
          Enregistrer le cours
        </button>
        <button className="btn-ink" onClick={() => onDone(initial?.id)}>
          Annuler
        </button>
      </div>
    </div>
  )
}

function CourseSheet({ course, onBack, onEdit }: { course: Course; onBack: () => void; onEdit: () => void }) {
  const session = useSession((s) => s.session)
  const mine = useQuery(['enrollments'], () => repo().listMyEnrollments(), [session.user?.uid])
  const manager = can(session, 'courses.manage')
  const roster = useQuery(['enrollments'], () => (manager ? repo().listCourseEnrollments(course.id) : Promise.resolve([])), [course.id, manager])
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({})
  const enr = mine.data?.find((e) => e.courseId === course.id)
  const done = enr ? course.lessons.filter((l) => enr.completed.includes(l.id)).length : 0
  const pct = course.lessons.length ? Math.round((done / course.lessons.length) * 100) : 0
  const d = disc(course.discipline)
  return (
    <div>
      <button className="btn-ink ghost mb-3" onClick={onBack}>
        <IconArrowLeft /> Catalogue
      </button>
      <div className="flex items-start gap-4">
        <span className="font-jp text-5xl text-amber/90">{d.kanji}</span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={statusTone(course.status)}>{COURSE_STATUS[course.status]}</Pill>
            <Pill>{d.label}</Pill>
            {course.visibility === 'membres' && <Pill tone="warn">Membres</Pill>}
            <DemoBadge show={!!course.demo} />
          </div>
          <h3 className="mt-2 font-serif text-2xl text-paper">{course.title}</h3>
          <div className="text-sm text-paper-3">
            Professeur : {course.teacher || '—'} · Niveau : {course.level || '—'} · {course.date || 'Date à définir'}
          </div>
        </div>
      </div>
      <p className="mt-4">{course.description}</p>
      {course.objectives.length > 0 && (
        <>
          <SectionTitle kanji="的">Objectifs</SectionTitle>
          <ul className="list-disc space-y-1 pl-5">
            {course.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </>
      )}
      <SectionTitle kanji="巻" right={enr && <Pill tone="amber">Progression : {pct} %</Pill>}>
        Supports de cours
      </SectionTitle>
      {enr && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-paper/10">
          <div className="h-full bg-amber transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      <ol className="space-y-3">
        {course.lessons.map((l, i) => {
          const isDone = !!enr?.completed.includes(l.id)
          return (
            <li key={l.id} className={`rounded-sm border p-3 ${isDone ? 'border-forest/60 bg-forest/10' : 'border-amber/15 bg-ink/35'}`}>
              <div className="flex items-start gap-3">
                <span className="font-jp text-amber/80">{['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][i] ?? i + 1}</span>
                <div className="flex-1">
                  <div className="font-medium text-paper">{l.title}</div>
                  {enr || manager ? <p className="mt-1 text-sm whitespace-pre-line text-paper-2">{l.body}</p> : <p className="mt-1 text-sm text-paper-3 italic">Contenu réservé aux élèves inscrits.</p>}
                </div>
                {enr && (
                  <button
                    className={`btn-ink !px-2 !py-1 ${isDone ? 'primary' : ''}`}
                    onClick={async () => {
                      const e = await mutate(['enrollments'], (r) => r.setLessonDone(course.id, l.id, !isDone))
                      if (e) setMsg({ err: e })
                      else audio.ui(isDone ? 'tab' : 'confirm')
                    }}
                    aria-label={isDone ? 'Marquer comme non terminée' : 'Marquer comme terminée'}
                  >
                    <IconCheck /> {isDone ? 'Terminée' : 'Terminer'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <ErrorNote>{msg.err}</ErrorNote>
      <SuccessNote>{msg.ok}</SuccessNote>
      <div className="mt-5 flex flex-wrap gap-2">
        {!session.member ? (
          <Pill tone="warn">Connectez-vous en tant que membre pour vous inscrire.</Pill>
        ) : enr ? (
          <ConfirmButton onConfirm={async () => setMsg((await mutate(['enrollments'], (r) => r.unenroll(course.id))) ? { err: 'Désinscription impossible.' } : { ok: 'Vous êtes désinscrit.' })}>Se désinscrire</ConfirmButton>
        ) : (
          <button
            className="btn-ink primary"
            disabled={course.status !== 'ouvert' && course.status !== 'en_cours'}
            onClick={async () => {
              const e = await mutate(['enrollments'], (r) => r.enroll(course.id))
              setMsg(e ? { err: e } : { ok: 'Inscription enregistrée. Les supports sont désormais accessibles.' })
              if (!e) audio.ui('confirm')
            }}
          >
            S’inscrire à cet enseignement
          </button>
        )}
        {manager && (
          <>
            <button className="btn-ink" onClick={onEdit}>
              <IconEdit /> Modifier
            </button>
            <ConfirmButton onConfirm={async () => ((await mutate(['courses'], (r) => r.deleteCourse(course.id))) ? setMsg({ err: 'Suppression impossible.' }) : onBack())}>
              <IconTrash /> Supprimer
            </ConfirmButton>
          </>
        )}
      </div>
      {manager && (
        <>
          <SectionTitle kanji="名">Élèves inscrits</SectionTitle>
          {!roster.data?.length ? (
            <p className="text-sm text-paper-3 italic">Aucun élève inscrit pour l’instant.</p>
          ) : (
            <ul className="text-sm">
              {roster.data.map((e) => (
                <li key={e.id} className="flex justify-between border-b border-amber/10 py-1">
                  <span>{e.memberName}</span>
                  <span className="text-paper-3">
                    {course.lessons.filter((l) => e.completed.includes(l.id)).length}/{course.lessons.length} leçons
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export default function CoursesPanel({ close }: PanelProps) {
  const session = useSession((s) => s.session)
  const courses = useQuery(['courses'], () => repo().listCourses(), [session.user?.uid])
  const mine = useQuery(['enrollments'], () => repo().listMyEnrollments(), [session.user?.uid])
  const [filter, setFilter] = useState<Discipline | 'all' | 'mine'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'new'>('view')
  const manager = can(session, 'courses.manage')
  const list = useMemo(
    () => (courses.data ?? []).filter((c) => (filter === 'all' ? true : filter === 'mine' ? mine.data?.some((e) => e.courseId === c.id) : c.discipline === filter)),
    [courses.data, filter, mine.data],
  )
  const open = courses.data?.find((c) => c.id === openId)

  return (
    <PanelFrame title="Le Dojo de l’Éloquence" kanji="弁論" subtitle="Catalogue des enseignements" onClose={close} width="xl">
      {mode === 'new' && <CourseEditor onDone={(id) => (setMode('view'), setOpenId(id ?? null))} />}
      {mode === 'edit' && open && <CourseEditor initial={open} onDone={() => setMode('view')} />}
      {mode === 'view' && open && <CourseSheet course={open} onBack={() => setOpenId(null)} onEdit={() => setMode('edit')} />}
      {mode === 'view' && !open && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button className={`btn-ink !py-1 ${filter === 'all' ? 'primary' : ''}`} onClick={() => setFilter('all')}>
              Tous
            </button>
            {session.member && (
              <button className={`btn-ink !py-1 ${filter === 'mine' ? 'primary' : ''}`} onClick={() => setFilter('mine')}>
                Mes cours
              </button>
            )}
            {DISCIPLINES.map((d) => (
              <button key={d.id} className={`btn-ink !px-2 !py-1 ${filter === d.id ? 'primary' : ''}`} onClick={() => setFilter(d.id)} title={d.label}>
                <span className="font-jp">{d.kanji}</span>
                <span className="hidden text-sm xl:inline">{d.label.split(' ')[0]}</span>
              </button>
            ))}
            {manager && (
              <button className="btn-ink ml-auto" onClick={() => setMode('new')}>
                <IconPlus /> Nouveau cours
              </button>
            )}
          </div>
          <ErrorNote>{courses.error}</ErrorNote>
          {courses.loading && !courses.data ? (
            <Loading label="Déroulement du catalogue…" />
          ) : list.length === 0 ? (
            <Empty kanji="空">Aucun enseignement dans cette catégorie.</Empty>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {list.map((c) => {
                const d = disc(c.discipline)
                const enr = mine.data?.find((e) => e.courseId === c.id)
                const pct = enr && c.lessons.length ? Math.round((enr.completed.length / c.lessons.length) * 100) : null
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setOpenId(c.id)
                      audio.page()
                    }}
                    className="group flex flex-col rounded-sm border border-amber/15 bg-ink/40 p-4 text-left transition hover:border-amber/50"
                  >
                    <div className="flex items-start gap-3">
                      <span className="font-jp text-3xl text-amber/80 transition group-hover:text-amber">{d.kanji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs tracking-wide text-paper-3 uppercase">{d.label}</div>
                        <div className="font-serif text-lg leading-tight text-paper">{c.title}</div>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-paper-2">{c.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Pill tone={statusTone(c.status)}>{COURSE_STATUS[c.status]}</Pill>
                      {pct !== null && <Pill tone="amber">Inscrit · {pct} %</Pill>}
                      <DemoBadge show={!!c.demo} />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          {!session.member && <p className="mt-4 text-sm text-paper-3 italic">Les visiteurs voient les enseignements publics. Les inscriptions sont réservées aux membres de l’école.</p>}
        </>
      )}
    </PanelFrame>
  )
}
