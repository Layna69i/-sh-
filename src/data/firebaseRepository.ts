/**
 * Adaptateur Firebase (Authentication + Firestore).
 * Activé automatiquement lorsque les variables VITE_FIREBASE_* sont définies.
 * Les permissions sont appliquées par les règles Firestore (firestore.rules) ;
 * les vérifications côté client ne servent qu'à guider l'interface.
 * Le SDK est chargé dynamiquement : il n'alourdit pas le mode local.
 */
import { AccessDenied, type Repository } from './repository'
import type { Candidature, Course, Enrollment, Member, Mission, MissionApplication, MissionReport, Permission, Rank, Session, StrategyPlan, Announcement, ArchiveDoc } from './types'
import { VISITOR, nowIso } from './types'
import { SEED_RANKS, SEED_ANNOUNCEMENTS, SEED_ARCHIVES, SEED_COURSES, SEED_MISSIONS } from './seed'

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId: string
}

export function readFirebaseConfig(): FirebaseConfig | null {
  const e = import.meta.env
  if (!e.VITE_FIREBASE_API_KEY || !e.VITE_FIREBASE_PROJECT_ID || !e.VITE_FIREBASE_APP_ID) return null
  return {
    apiKey: e.VITE_FIREBASE_API_KEY,
    authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: e.VITE_FIREBASE_PROJECT_ID,
    storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: e.VITE_FIREBASE_APP_ID,
  }
}

const translate = (e: unknown) => {
  const code = (e as { code?: string })?.code ?? ''
  if (code === 'permission-denied') return new AccessDenied()
  if (code.startsWith('auth/')) {
    const map: Record<string, string> = {
      'auth/invalid-credential': 'Identifiants incorrects.',
      'auth/wrong-password': 'Mot de passe incorrect.',
      'auth/user-not-found': 'Aucun compte avec cette adresse.',
      'auth/email-already-in-use': 'Cette adresse est déjà utilisée.',
      'auth/weak-password': 'Mot de passe trop faible (6 caractères minimum).',
      'auth/invalid-email': 'Adresse e-mail invalide.',
      'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
    }
    return new Error(map[code] ?? 'Erreur d’authentification.')
  }
  return e instanceof Error ? e : new Error(String(e))
}

export async function createFirebaseRepository(cfg: FirebaseConfig): Promise<Repository> {
  const [{ initializeApp }, A, F] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')])
  const app = initializeApp(cfg)
  const auth = A.getAuth(app)
  const db = F.getFirestore(app)

  let session: Session = VISITOR
  const listeners = new Set<(s: Session) => void>()
  const emit = () => listeners.forEach((l) => l(session))

  const col = (name: string) => F.collection(db, name)
  const ref = (name: string, id: string) => F.doc(db, name, id)
  const all = async <T,>(q: ReturnType<typeof F.query> | ReturnType<typeof F.collection>): Promise<T[]> => {
    try {
      const snap = await F.getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T)
    } catch (e) {
      throw translate(e)
    }
  }
  const write = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (e) {
      throw translate(e)
    }
  }
  const strip = <T extends { id: string }>(o: T) => {
    const { id: _id, ...rest } = o
    return JSON.parse(JSON.stringify(rest)) as Omit<T, 'id'>
  }

  async function computeSession(user: { uid: string; email: string | null; displayName: string | null } | null): Promise<Session> {
    if (!user) return VISITOR
    let member: Member | null = null
    let rank: Rank | null = null
    try {
      const m = await F.getDoc(ref('members', user.uid))
      if (m.exists()) {
        member = { id: m.id, ...(m.data() as Omit<Member, 'id'>) }
        const r = await F.getDoc(ref('ranks', member.rankId))
        if (r.exists()) rank = { id: r.id, ...(r.data() as Omit<Rank, 'id'>) }
      }
    } catch {
      /* compte sans fiche membre */
    }
    return {
      user: { uid: user.uid, email: user.email ?? undefined, displayName: member?.name ?? user.displayName ?? user.email ?? 'Membre', provider: 'firebase' },
      member,
      rank,
      clearance: rank?.clearance ?? 0,
      perms: rank ? [...rank.permissions] : [],
    }
  }

  A.onAuthStateChanged(auth, async (u) => {
    session = await computeSession(u)
    emit()
  })
  const refresh = async () => {
    session = await computeSession(auth.currentUser)
    emit()
  }

  const need = (p: Permission) => {
    if (!session.perms.includes(p)) throw new AccessDenied()
  }
  const needMember = () => {
    if (!session.member || !session.user) throw new AccessDenied('Réservé aux membres de l’école. Connectez-vous d’abord.')
    return { user: session.user, member: session.member }
  }

  const repo: Repository = {
    mode: 'firebase',
    async signIn(email, password) {
      try {
        await A.signInWithEmailAndPassword(auth, email, password)
      } catch (e) {
        throw translate(e)
      }
    },
    async signUp(email, password, displayName) {
      try {
        const cred = await A.createUserWithEmailAndPassword(auth, email, password)
        await A.updateProfile(cred.user, { displayName })
        await refresh()
      } catch (e) {
        throw translate(e)
      }
    },
    async signOut() {
      await A.signOut(auth)
    },
    onSession(cb) {
      listeners.add(cb)
      cb(session)
      return () => listeners.delete(cb)
    },
    /** Écrit les grades et contenus de démonstration (direction uniquement). */
    async seedRemote() {
      need('ranks.manage')
      await write(async () => {
        const batch = F.writeBatch(db)
        for (const r of SEED_RANKS) batch.set(ref('ranks', r.id), strip(r))
        for (const a of SEED_ANNOUNCEMENTS) batch.set(ref('announcements', a.id), strip(a))
        for (const a of SEED_ARCHIVES) batch.set(ref('archives', a.id), strip(a))
        for (const c of SEED_COURSES) batch.set(ref('courses', c.id), strip(c))
        for (const m of SEED_MISSIONS) batch.set(ref('missions', m.id), strip({ ...m, participantUids: m.participants.map((p) => p.uid) }))
        await batch.commit()
      })
    },

    /* --- grades & membres --- */
    async listRanks() {
      return (await all<Rank>(col('ranks'))).sort((a, b) => a.order - b.order)
    },
    async saveRank(r) {
      need('ranks.manage')
      await write(() => F.setDoc(ref('ranks', r.id), strip(r)))
      await refresh()
    },
    async deleteRank(id) {
      need('ranks.manage')
      await write(() => F.deleteDoc(ref('ranks', id)))
    },
    async listMembers() {
      return all<Member>(col('members'))
    },
    async saveMember(m) {
      await write(() => F.setDoc(ref('members', m.id), strip(m)))
      if (m.id === session.user?.uid) await refresh()
    },
    async deleteMember(id) {
      need('members.manage')
      await write(() => F.deleteDoc(ref('members', id)))
    },

    /* --- annonces --- */
    async listAnnouncements() {
      const list = await all<Announcement>(F.query(col('announcements'), F.where('clearance', '<=', session.clearance)))
      return list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt))
    },
    async saveAnnouncement(a) {
      need('announcements.manage')
      await write(() => F.setDoc(ref('announcements', a.id), strip(a)))
    },
    async deleteAnnouncement(id) {
      need('announcements.manage')
      await write(() => F.deleteDoc(ref('announcements', id)))
    },

    /* --- archives --- */
    async listArchives() {
      const list = await all<ArchiveDoc>(F.query(col('archives'), F.where('clearance', '<=', session.clearance)))
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async saveArchive(a) {
      need('archives.write')
      if (a.clearance > session.clearance) throw new AccessDenied('Vous ne pouvez pas classer un dossier au-delà de votre habilitation.')
      await write(() => F.setDoc(ref('archives', a.id), strip({ ...a, updatedAt: nowIso(), createdBy: a.createdBy ?? session.user?.uid })))
    },
    async deleteArchive(id) {
      need('archives.write')
      await write(() => F.deleteDoc(ref('archives', id)))
    },

    /* --- enseignements --- */
    async listCourses() {
      const q = session.member ? col('courses') : F.query(col('courses'), F.where('visibility', '==', 'public'))
      const manager = session.perms.includes('courses.manage')
      return (await all<Course>(q)).filter((c) => c.status !== 'brouillon' || manager)
    },
    async saveCourse(c) {
      need('courses.manage')
      await write(() => F.setDoc(ref('courses', c.id), strip(c)))
    },
    async deleteCourse(id) {
      need('courses.manage')
      await write(() => F.deleteDoc(ref('courses', id)))
    },
    async listMyEnrollments() {
      if (!session.user) return []
      return all<Enrollment>(F.query(col('enrollments'), F.where('uid', '==', session.user.uid)))
    },
    async listCourseEnrollments(courseId) {
      need('courses.manage')
      return all<Enrollment>(F.query(col('enrollments'), F.where('courseId', '==', courseId)))
    },
    async listAllEnrollments() {
      need('courses.manage')
      return all<Enrollment>(col('enrollments'))
    },
    async enroll(courseId) {
      const { user, member } = needMember()
      const id = `${courseId}_${user.uid}`
      await write(() => F.setDoc(ref('enrollments', id), { courseId, uid: user.uid, memberName: member.name, completed: [], enrolledAt: nowIso() }))
    },
    async unenroll(courseId) {
      const { user } = needMember()
      await write(() => F.deleteDoc(ref('enrollments', `${courseId}_${user.uid}`)))
    },
    async setLessonDone(courseId, lessonId, done) {
      const { user } = needMember()
      await write(() => F.updateDoc(ref('enrollments', `${courseId}_${user.uid}`), { completed: done ? F.arrayUnion(lessonId) : F.arrayRemove(lessonId) }))
    },

    /* --- missions --- */
    async listMissions() {
      const list = await all<Mission>(F.query(col('missions'), F.where('clearance', '<=', session.clearance)))
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    async saveMission(m) {
      need('missions.manage')
      await write(() => F.setDoc(ref('missions', m.id), strip({ ...m, participantUids: m.participants.map((p) => p.uid) })))
    },
    async deleteMission(id) {
      need('missions.manage')
      await write(() => F.deleteDoc(ref('missions', id)))
    },
    async listMissionApplications(missionId) {
      if (!session.user) return []
      const manager = session.perms.includes('missions.manage')
      const filters = [] as ReturnType<typeof F.where>[]
      if (missionId) filters.push(F.where('missionId', '==', missionId))
      if (!manager) filters.push(F.where('uid', '==', session.user.uid))
      return all<MissionApplication>(F.query(col('missionApplications'), ...filters))
    },
    async applyToMission(missionId, message) {
      const { user, member } = needMember()
      need('missions.apply')
      await write(() => F.addDoc(col('missionApplications'), { missionId, uid: user.uid, name: member.name, message, status: 'en_attente', createdAt: nowIso() }))
    },
    async decideMissionApplication(id, status) {
      need('missions.manage')
      await write(async () => {
        const snap = await F.getDoc(ref('missionApplications', id))
        if (!snap.exists()) throw new Error('Candidature introuvable.')
        const a = snap.data() as MissionApplication
        const batch = F.writeBatch(db)
        batch.update(ref('missionApplications', id), { status })
        if (status === 'acceptee') batch.update(ref('missions', a.missionId), { participants: F.arrayUnion({ uid: a.uid, name: a.name }), participantUids: F.arrayUnion(a.uid) })
        await batch.commit()
      })
    },
    async listReports(missionId) {
      if (!session.user) return []
      const manager = session.perms.includes('missions.manage')
      const filters = [F.where('missionId', '==', missionId)]
      if (!manager) filters.push(F.where('uid', '==', session.user.uid))
      return all<MissionReport>(F.query(col('reports'), ...filters))
    },
    async submitReport(missionId, body) {
      const { user, member } = needMember()
      await write(() => F.addDoc(col('reports'), { missionId, uid: user.uid, author: member.name, body, createdAt: nowIso(), validation: 'soumis' }))
    },
    async reviewReport(id, validation, note) {
      need('missions.manage')
      await write(() => F.updateDoc(ref('reports', id), { validation, reviewerNote: note, reviewedBy: session.member?.name ?? '' }))
    },

    /* --- candidatures --- */
    async submitCandidature(c) {
      await write(() => F.addDoc(col('candidatures'), { ...c, status: 'en_attente', notes: [], createdAt: nowIso(), uid: session.user?.uid ?? null }))
    },
    async listCandidatures() {
      need('applications.review')
      return (await all<Candidature>(col('candidatures'))).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    async setCandidatureStatus(id, status) {
      need('applications.review')
      await write(() => F.updateDoc(ref('candidatures', id), { status }))
    },
    async addCandidatureNote(id, text) {
      need('applications.review')
      await write(() => F.updateDoc(ref('candidatures', id), { notes: F.arrayUnion({ author: session.member?.name ?? '—', text, at: nowIso() }) }))
    },

    /* --- plans --- */
    async listPlans() {
      if (!session.user) return []
      const mine = await all<StrategyPlan>(F.query(col('plans'), F.where('ownerUid', '==', session.user.uid)))
      const shared = session.member ? await all<StrategyPlan>(F.query(col('plans'), F.where('shared', '==', true))) : []
      const map = new Map([...mine, ...shared].map((p) => [p.id, p]))
      return [...map.values()]
    },
    async savePlan(p) {
      const { user } = needMember()
      await write(() => F.setDoc(ref('plans', p.id), strip({ ...p, ownerUid: user.uid, updatedAt: nowIso() })))
    },
    async deletePlan(id) {
      needMember()
      await write(() => F.deleteDoc(ref('plans', id)))
    },
  }
  return repo
}
