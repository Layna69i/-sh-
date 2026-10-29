/**
 * Contrat d'accès aux données, commun au mode démonstration local et à Firebase.
 * Chaque méthode applique les permissions ; en mode Firebase elles sont en plus
 * (et surtout) appliquées côté serveur par les règles Firestore.
 */
import { useCallback, useEffect, useState } from 'react'
import { create } from 'zustand'
import type {
  Rank,
  Member,
  Announcement,
  ArchiveDoc,
  Course,
  Enrollment,
  Mission,
  MissionApplication,
  MissionReport,
  Candidature,
  StrategyPlan,
  Session,
  Decision,
  ReportValidation,
} from './types'

export class AccessDenied extends Error {
  constructor(message = 'Accès refusé : vos permissions ne le permettent pas.') {
    super(message)
    this.name = 'AccessDenied'
  }
}

export interface DemoAccount {
  uid: string
  label: string
  role: string
}

export interface Repository {
  mode: 'local' | 'firebase'
  /* --- authentification --- */
  demoAccounts?: DemoAccount[]
  signInDemo?(uid: string): Promise<void>
  signIn?(email: string, password: string): Promise<void>
  signUp?(email: string, password: string, displayName: string): Promise<void>
  signOut(): Promise<void>
  onSession(cb: (s: Session) => void): () => void
  resetDemo?(): Promise<void>
  seedRemote?(): Promise<void>

  /* --- grades & membres --- */
  listRanks(): Promise<Rank[]>
  saveRank(r: Rank): Promise<void>
  deleteRank(id: string): Promise<void>
  listMembers(): Promise<Member[]>
  saveMember(m: Member): Promise<void>
  deleteMember(id: string): Promise<void>

  /* --- annonces --- */
  listAnnouncements(): Promise<Announcement[]>
  saveAnnouncement(a: Announcement): Promise<void>
  deleteAnnouncement(id: string): Promise<void>

  /* --- archives --- */
  listArchives(): Promise<ArchiveDoc[]>
  saveArchive(a: ArchiveDoc): Promise<void>
  deleteArchive(id: string): Promise<void>

  /* --- enseignements --- */
  listCourses(): Promise<Course[]>
  saveCourse(c: Course): Promise<void>
  deleteCourse(id: string): Promise<void>
  listMyEnrollments(): Promise<Enrollment[]>
  listCourseEnrollments(courseId: string): Promise<Enrollment[]>
  /** Toutes les inscriptions (responsables des enseignements). */
  listAllEnrollments(): Promise<Enrollment[]>
  enroll(courseId: string): Promise<void>
  unenroll(courseId: string): Promise<void>
  setLessonDone(courseId: string, lessonId: string, done: boolean): Promise<void>

  /* --- missions --- */
  listMissions(): Promise<Mission[]>
  saveMission(m: Mission): Promise<void>
  deleteMission(id: string): Promise<void>
  listMissionApplications(missionId?: string): Promise<MissionApplication[]>
  applyToMission(missionId: string, message: string): Promise<void>
  decideMissionApplication(id: string, status: Decision): Promise<void>
  listReports(missionId: string): Promise<MissionReport[]>
  submitReport(missionId: string, body: string): Promise<void>
  reviewReport(id: string, validation: ReportValidation, note: string): Promise<void>

  /* --- candidatures --- */
  submitCandidature(c: Omit<Candidature, 'id' | 'status' | 'notes' | 'createdAt'>): Promise<void>
  listCandidatures(): Promise<Candidature[]>
  setCandidatureStatus(id: string, status: Decision): Promise<void>
  addCandidatureNote(id: string, text: string): Promise<void>

  /* --- plans stratégiques --- */
  listPlans(): Promise<StrategyPlan[]>
  savePlan(p: StrategyPlan): Promise<void>
  deletePlan(id: string): Promise<void>
}

/* ------------------------------------------------------------------ */
/* Invalidation simple : chaque écriture incrémente la version d'une clé */
/* ------------------------------------------------------------------ */
interface VersionStore {
  v: Record<string, number>
  bump: (...keys: string[]) => void
}
export const useVersions = create<VersionStore>((set, get) => ({
  v: {},
  bump: (...keys) => {
    const v = { ...get().v }
    for (const k of keys) v[k] = (v[k] ?? 0) + 1
    set({ v })
  },
}))

export interface QueryState<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  reload: () => void
}

/** Lecture asynchrone rafraîchie automatiquement après chaque écriture sur `keys`. */
export function useQuery<T>(keys: string[], fn: () => Promise<T>, deps: unknown[] = []): QueryState<T> {
  const version = useVersions((s) => keys.map((k) => s.v[k] ?? 0).join('.') + ':' + (s.v.__session ?? 0))
  const [state, setState] = useState<{ data: T | undefined; error: string | null; loading: boolean }>({ data: undefined, error: null, loading: true })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    fn()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e: unknown) => alive && setState({ data: undefined, error: e instanceof Error ? e.message : String(e), loading: false }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, tick, ...deps])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}
