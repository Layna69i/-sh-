/**
 * MODE DÉMONSTRATION LOCAL
 * Les données sont conservées dans le stockage du navigateur (localStorage).
 * Les contrôles de permissions ci-dessous simulent ceux du serveur pour que
 * l'expérience soit fidèle, mais ils NE CONSTITUENT PAS une sécurité réelle :
 * n'importe qui peut modifier son stockage local. Pour un usage réel, activez
 * Firebase (règles Firestore fournies dans firestore.rules).
 */
import { AccessDenied, type Repository } from './repository'
import type { Candidature, Member, Permission, Rank, Session, StrategyPlan, Enrollment, MissionApplication, MissionReport } from './types'
import { VISITOR, nowIso, uid } from './types'
import { SEED_RANKS, SEED_MEMBERS, SEED_ANNOUNCEMENTS, SEED_ARCHIVES, SEED_COURSES, SEED_MISSIONS, SEED_CANDIDATURES, DEMO_ACCOUNTS } from './seed'
import type { Announcement, ArchiveDoc, Course, Mission } from './types'

const DB_KEY = 'osho.db.v1'
const SESSION_KEY = 'osho.session.local'

interface DB {
  ranks: Rank[]
  members: Member[]
  announcements: Announcement[]
  archives: ArchiveDoc[]
  courses: Course[]
  enrollments: Enrollment[]
  missions: Mission[]
  missionApplications: MissionApplication[]
  reports: MissionReport[]
  candidatures: Candidature[]
  plans: StrategyPlan[]
}

const fresh = (): DB => ({
  ranks: structuredClone(SEED_RANKS),
  members: structuredClone(SEED_MEMBERS),
  announcements: structuredClone(SEED_ANNOUNCEMENTS),
  archives: structuredClone(SEED_ARCHIVES),
  courses: structuredClone(SEED_COURSES),
  enrollments: [],
  missions: structuredClone(SEED_MISSIONS),
  missionApplications: [],
  reports: [],
  candidatures: structuredClone(SEED_CANDIDATURES),
  plans: [],
})

let memoryFallback: DB | null = null

function load(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return { ...fresh(), ...JSON.parse(raw) }
  } catch {
    if (memoryFallback) return memoryFallback
  }
  return fresh()
}

function save(db: DB) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    memoryFallback = db
  }
}

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60))

export function createLocalRepository(): Repository {
  let db = load()
  let session: Session = VISITOR
  const listeners = new Set<(s: Session) => void>()

  const computeSession = (userId: string | null): Session => {
    if (!userId) return VISITOR
    const acc = DEMO_ACCOUNTS.find((a) => a.uid === userId)
    const member = db.members.find((m) => m.uid === userId) ?? null
    const rank = member ? db.ranks.find((r) => r.id === member.rankId) ?? null : null
    return {
      user: { uid: userId, displayName: member?.name ?? acc?.label ?? 'Invité', provider: 'local' },
      member,
      rank,
      clearance: rank?.clearance ?? 0,
      perms: rank ? [...rank.permissions] : [],
    }
  }
  const emit = () => listeners.forEach((l) => l(session))
  const refreshSession = () => {
    session = computeSession(session.user?.uid ?? null)
    emit()
  }
  try {
    const saved = localStorage.getItem(SESSION_KEY)
    if (saved) session = computeSession(saved)
  } catch {
    /* ignoré */
  }

  const need = (p: Permission) => {
    if (!session.perms.includes(p)) throw new AccessDenied()
  }
  const needMember = () => {
    if (!session.member || !session.user) throw new AccessDenied('Réservé aux membres de l’école. Connectez-vous d’abord.')
    return { user: session.user, member: session.member }
  }
  const commit = () => save(db)
  const upsert = <T extends { id: string }>(arr: T[], item: T) => {
    const i = arr.findIndex((x) => x.id === item.id)
    if (i >= 0) arr[i] = item
    else arr.push(item)
  }

  const repo: Repository = {
    mode: 'local',
    demoAccounts: DEMO_ACCOUNTS,
    async signInDemo(id) {
      session = computeSession(id)
      try {
        localStorage.setItem(SESSION_KEY, id)
      } catch {
        /* ignoré */
      }
      emit()
    },
    async signOut() {
      session = VISITOR
      try {
        localStorage.removeItem(SESSION_KEY)
      } catch {
        /* ignoré */
      }
      emit()
    },
    onSession(cb) {
      listeners.add(cb)
      cb(session)
      return () => listeners.delete(cb)
    },
    async resetDemo() {
      db = fresh()
      commit()
      refreshSession()
    },

    /* --- grades & membres --- */
    async listRanks() {
      return delay([...db.ranks].sort((a, b) => a.order - b.order))
    },
    async saveRank(r) {
      need('ranks.manage')
      upsert(db.ranks, r)
      commit()
      refreshSession()
    },
    async deleteRank(id) {
      need('ranks.manage')
      if (db.members.some((m) => m.rankId === id)) throw new Error('Ce grade est encore attribué à des membres.')
      db.ranks = db.ranks.filter((r) => r.id !== id)
      commit()
    },
    async listMembers() {
      return delay([...db.members])
    },
    async saveMember(m) {
      const own = session.member && m.id === session.member.id
      if (!own) need('members.manage')
      else if (!session.perms.includes('members.manage')) {
        // un membre ne peut modifier que sa présentation, pas son grade
        const prev = db.members.find((x) => x.id === m.id)
        if (prev && (prev.rankId !== m.rankId || prev.uid !== m.uid)) throw new AccessDenied('Seule la direction peut modifier un grade.')
      }
      upsert(db.members, m)
      commit()
      refreshSession()
    },
    async deleteMember(id) {
      need('members.manage')
      db.members = db.members.filter((m) => m.id !== id)
      commit()
    },

    /* --- annonces --- */
    async listAnnouncements() {
      return delay(db.announcements.filter((a) => a.clearance <= session.clearance).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt)))
    },
    async saveAnnouncement(a) {
      need('announcements.manage')
      upsert(db.announcements, a)
      commit()
    },
    async deleteAnnouncement(id) {
      need('announcements.manage')
      db.announcements = db.announcements.filter((a) => a.id !== id)
      commit()
    },

    /* --- archives --- */
    async listArchives() {
      return delay(db.archives.filter((a) => a.clearance <= session.clearance).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    },
    async saveArchive(a) {
      need('archives.write')
      if (a.clearance > session.clearance) throw new AccessDenied('Vous ne pouvez pas classer un dossier au-delà de votre propre habilitation.')
      const prev = db.archives.find((x) => x.id === a.id)
      if (prev && prev.clearance > session.clearance) throw new AccessDenied()
      upsert(db.archives, { ...a, updatedAt: nowIso(), createdBy: prev?.createdBy ?? session.user?.uid })
      commit()
    },
    async deleteArchive(id) {
      need('archives.write')
      const prev = db.archives.find((x) => x.id === id)
      if (prev && prev.clearance > session.clearance) throw new AccessDenied()
      db.archives = db.archives.filter((a) => a.id !== id)
      commit()
    },

    /* --- enseignements --- */
    async listCourses() {
      const member = !!session.member
      const manager = session.perms.includes('courses.manage')
      return delay(db.courses.filter((c) => (c.visibility === 'public' || member) && (c.status !== 'brouillon' || manager)))
    },
    async saveCourse(c) {
      need('courses.manage')
      upsert(db.courses, c)
      commit()
    },
    async deleteCourse(id) {
      need('courses.manage')
      db.courses = db.courses.filter((c) => c.id !== id)
      db.enrollments = db.enrollments.filter((e) => e.courseId !== id)
      commit()
    },
    async listMyEnrollments() {
      if (!session.user) return []
      return delay(db.enrollments.filter((e) => e.uid === session.user!.uid))
    },
    async listCourseEnrollments(courseId) {
      need('courses.manage')
      return delay(db.enrollments.filter((e) => e.courseId === courseId))
    },
    async listAllEnrollments() {
      need('courses.manage')
      return delay([...db.enrollments])
    },
    async enroll(courseId) {
      const { user, member } = needMember()
      need('courses.enroll')
      const c = db.courses.find((x) => x.id === courseId)
      if (!c) throw new Error('Cours introuvable.')
      if (c.status !== 'ouvert' && c.status !== 'en_cours') throw new Error('Les inscriptions ne sont pas ouvertes pour ce cours.')
      const id = `${courseId}_${user.uid}`
      if (!db.enrollments.some((e) => e.id === id)) db.enrollments.push({ id, courseId, uid: user.uid, memberName: member.name, completed: [], enrolledAt: nowIso() })
      commit()
    },
    async unenroll(courseId) {
      const { user } = needMember()
      db.enrollments = db.enrollments.filter((e) => !(e.courseId === courseId && e.uid === user.uid))
      commit()
    },
    async setLessonDone(courseId, lessonId, done) {
      const { user } = needMember()
      const e = db.enrollments.find((x) => x.courseId === courseId && x.uid === user.uid)
      if (!e) throw new Error('Inscrivez-vous d’abord à ce cours.')
      e.completed = done ? [...new Set([...e.completed, lessonId])] : e.completed.filter((l) => l !== lessonId)
      commit()
    },

    /* --- missions --- */
    async listMissions() {
      return delay(db.missions.filter((m) => m.clearance <= session.clearance).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    },
    async saveMission(m) {
      need('missions.manage')
      upsert(db.missions, m)
      commit()
    },
    async deleteMission(id) {
      need('missions.manage')
      db.missions = db.missions.filter((m) => m.id !== id)
      commit()
    },
    async listMissionApplications(missionId) {
      if (!session.user) return []
      const manager = session.perms.includes('missions.manage')
      return delay(db.missionApplications.filter((a) => (!missionId || a.missionId === missionId) && (manager || a.uid === session.user!.uid)))
    },
    async applyToMission(missionId, message) {
      const { user, member } = needMember()
      need('missions.apply')
      const m = db.missions.find((x) => x.id === missionId)
      if (!m || m.clearance > session.clearance) throw new AccessDenied()
      if (m.status !== 'disponible') throw new Error('Cette mission n’accepte plus de candidatures.')
      if (m.participants.some((p) => p.uid === user.uid)) throw new Error('Vous participez déjà à cette mission.')
      if (db.missionApplications.some((a) => a.missionId === missionId && a.uid === user.uid && a.status === 'en_attente')) throw new Error('Votre candidature est déjà en attente.')
      db.missionApplications.push({ id: uid('ma'), missionId, uid: user.uid, name: member.name, message, status: 'en_attente', createdAt: nowIso() })
      commit()
    },
    async decideMissionApplication(id, status) {
      need('missions.manage')
      const a = db.missionApplications.find((x) => x.id === id)
      if (!a) throw new Error('Candidature introuvable.')
      a.status = status
      if (status === 'acceptee') {
        const m = db.missions.find((x) => x.id === a.missionId)
        if (m && !m.participants.some((p) => p.uid === a.uid)) {
          if (m.participants.length >= m.maxParticipants) throw new Error('L’équipe est déjà complète.')
          m.participants.push({ uid: a.uid, name: a.name })
          m.participantUids = m.participants.map((p) => p.uid)
        }
      }
      commit()
    },
    async listReports(missionId) {
      if (!session.user) return []
      const manager = session.perms.includes('missions.manage')
      return delay(db.reports.filter((r) => r.missionId === missionId && (manager || r.uid === session.user!.uid)))
    },
    async submitReport(missionId, body) {
      const { user, member } = needMember()
      const m = db.missions.find((x) => x.id === missionId)
      if (!m) throw new Error('Mission introuvable.')
      const isLeader = session.perms.includes('missions.manage')
      if (!isLeader && !m.participants.some((p) => p.uid === user.uid)) throw new AccessDenied('Seuls les participants peuvent rendre un rapport.')
      db.reports.push({ id: uid('rp'), missionId, uid: user.uid, author: member.name, body, createdAt: nowIso(), validation: 'soumis' })
      commit()
    },
    async reviewReport(id, validation, note) {
      need('missions.manage')
      const r = db.reports.find((x) => x.id === id)
      if (!r) throw new Error('Rapport introuvable.')
      r.validation = validation
      r.reviewerNote = note
      r.reviewedBy = session.member?.name
      commit()
    },

    /* --- candidatures --- */
    async submitCandidature(c) {
      db.candidatures.push({ ...c, id: uid('cand'), status: 'en_attente', notes: [], createdAt: nowIso(), uid: session.user?.uid ?? null })
      commit()
    },
    async listCandidatures() {
      need('applications.review')
      return delay([...db.candidatures].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    },
    async setCandidatureStatus(id, status) {
      need('applications.review')
      const c = db.candidatures.find((x) => x.id === id)
      if (!c) throw new Error('Candidature introuvable.')
      c.status = status
      commit()
    },
    async addCandidatureNote(id, text) {
      need('applications.review')
      const c = db.candidatures.find((x) => x.id === id)
      if (!c) throw new Error('Candidature introuvable.')
      c.notes.push({ author: session.member?.name ?? '—', text, at: nowIso() })
      commit()
    },

    /* --- plans --- */
    async listPlans() {
      if (!session.user) return []
      return delay(db.plans.filter((p) => p.ownerUid === session.user!.uid || (p.shared && !!session.member)))
    },
    async savePlan(p) {
      const { user } = needMember()
      need('strategy.use')
      const prev = db.plans.find((x) => x.id === p.id)
      if (prev && prev.ownerUid !== user.uid) throw new AccessDenied('Ce plan appartient à un autre membre.')
      upsert(db.plans, { ...p, ownerUid: user.uid, updatedAt: nowIso() })
      commit()
    },
    async deletePlan(id) {
      const { user } = needMember()
      const prev = db.plans.find((x) => x.id === id)
      if (prev && prev.ownerUid !== user.uid) throw new AccessDenied('Ce plan appartient à un autre membre.')
      db.plans = db.plans.filter((p) => p.id !== id)
      commit()
    },
  }
  return repo
}
