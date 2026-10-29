/**
 * Modèle de données de l'école. Les mêmes structures sont utilisées par le mode
 * démonstration local et par Firestore (une collection par type).
 */

export type Permission =
  | 'courses.enroll'
  | 'missions.apply'
  | 'strategy.use'
  | 'archives.write'
  | 'courses.manage'
  | 'missions.manage'
  | 'applications.review'
  | 'announcements.manage'
  | 'members.manage'
  | 'ranks.manage'

export const ALL_PERMISSIONS: { id: Permission; label: string }[] = [
  { id: 'courses.enroll', label: "S'inscrire aux enseignements" },
  { id: 'missions.apply', label: 'Postuler aux missions' },
  { id: 'strategy.use', label: 'Sauvegarder des plans stratégiques' },
  { id: 'archives.write', label: 'Rédiger et modifier des dossiers' },
  { id: 'courses.manage', label: 'Créer et gérer des cours' },
  { id: 'missions.manage', label: 'Créer et diriger des missions' },
  { id: 'applications.review', label: 'Examiner les candidatures' },
  { id: 'announcements.manage', label: 'Publier des annonces' },
  { id: 'members.manage', label: 'Gérer les membres' },
  { id: 'ranks.manage', label: 'Gérer les grades et permissions' },
]

export type Village = 'Konoha' | 'Suna' | 'Ame' | 'Kiri' | 'Kumo' | 'Iwa' | 'Autre'
export const VILLAGES: Village[] = ['Konoha', 'Suna', 'Ame', 'Kiri', 'Kumo', 'Iwa', 'Autre']
export const VILLAGE_KANJI: Record<string, string> = { Konoha: '木', Suna: '砂', Ame: '雨', Kiri: '霧', Kumo: '雲', Iwa: '岩', Autre: '他', 'Inter-villages': '和' }

/** Niveaux de classification (0 = public … 4 = secret). */
export const CLEARANCES = [
  { level: 0, label: 'Public', jp: '公' },
  { level: 1, label: 'Interne', jp: '内' },
  { level: 2, label: 'Restreint', jp: '限' },
  { level: 3, label: 'Confidentiel', jp: '秘' },
  { level: 4, label: 'Secret', jp: '極' },
] as const

export interface Rank {
  id: string
  name: string
  jp: string
  kanji: string
  order: number
  clearance: number
  permissions: Permission[]
  description: string
}

export interface Member {
  id: string
  uid?: string | null
  name: string
  rankId: string
  village: Village
  clan?: string
  specialty: string
  description: string
  avatarSeed: number
  avatarUrl?: string
  joinedAt: string
  demo?: boolean
}

export type ArchiveCategory = 'village' | 'diplomatie' | 'evenement' | 'organisation' | 'observation' | 'strategie'
export const ARCHIVE_CATEGORIES: { id: ArchiveCategory; label: string }[] = [
  { id: 'village', label: 'Fiches de village' },
  { id: 'diplomatie', label: 'Informations diplomatiques' },
  { id: 'evenement', label: 'Événements RP' },
  { id: 'organisation', label: 'Organisations' },
  { id: 'observation', label: "Rapports d'observation" },
  { id: 'strategie', label: 'Dossiers stratégiques' },
]

export interface Attachment {
  name: string
  url: string
}

export interface ArchiveDoc {
  id: string
  title: string
  date: string
  author: string
  village: Village | 'Inter-villages'
  category: ArchiveCategory
  clearance: number
  summary: string
  body: string
  tags: string[]
  attachments: Attachment[]
  createdAt: string
  updatedAt: string
  createdBy?: string
  demo?: boolean
}

export interface Announcement {
  id: string
  title: string
  body: string
  author: string
  createdAt: string
  pinned: boolean
  channel: 'general' | 'direction'
  clearance: number
  demo?: boolean
}

export type Discipline =
  | 'strategie'
  | 'analyse'
  | 'psychologie'
  | 'oratoire'
  | 'diplomatie'
  | 'observation'
  | 'renseignement'
  | 'interrogatoire'
  | 'influence'

export const DISCIPLINES: { id: Discipline; label: string; kanji: string }[] = [
  { id: 'strategie', label: 'Stratégie', kanji: '策' },
  { id: 'analyse', label: 'Analyse comportementale', kanji: '析' },
  { id: 'psychologie', label: 'Psychologie', kanji: '心' },
  { id: 'oratoire', label: 'Oratoire', kanji: '言' },
  { id: 'diplomatie', label: 'Diplomatie', kanji: '和' },
  { id: 'observation', label: 'Observation', kanji: '観' },
  { id: 'renseignement', label: 'Collecte de renseignements', kanji: '報' },
  { id: 'interrogatoire', label: 'Interrogatoire (RP)', kanji: '問' },
  { id: 'influence', label: 'Influence et manipulation (RP)', kanji: '影' },
]

export interface Lesson {
  id: string
  title: string
  body: string
}

export type CourseStatus = 'ouvert' | 'en_cours' | 'complet' | 'termine' | 'brouillon'
export const COURSE_STATUS: Record<CourseStatus, string> = {
  ouvert: 'Inscriptions ouvertes',
  en_cours: 'En cours',
  complet: 'Complet',
  termine: 'Terminé',
  brouillon: 'Brouillon',
}

export interface Course {
  id: string
  title: string
  discipline: Discipline
  teacher: string
  teacherId?: string
  description: string
  objectives: string[]
  lessons: Lesson[]
  level: string
  date: string
  status: CourseStatus
  visibility: 'public' | 'membres'
  createdAt: string
  demo?: boolean
}

export interface Enrollment {
  id: string
  courseId: string
  uid: string
  memberName: string
  completed: string[]
  enrolledAt: string
}

export type Difficulty = 'D' | 'C' | 'B' | 'A' | 'S'
export type MissionStatus = 'disponible' | 'en_cours' | 'terminee'
export const MISSION_STATUS: Record<MissionStatus, string> = { disponible: 'Disponible', en_cours: 'En cours', terminee: 'Terminée' }

export interface Participant {
  uid: string
  name: string
}

export interface Mission {
  id: string
  title: string
  summary: string
  objectives: string[]
  village: Village | 'Inter-villages'
  difficulty: Difficulty
  leader: string
  leaderUid?: string
  status: MissionStatus
  participants: Participant[]
  /** Copie des identifiants des participants (utilisée par les règles Firestore). */
  participantUids?: string[]
  maxParticipants: number
  clearance: number
  createdAt: string
  demo?: boolean
}

export type Decision = 'en_attente' | 'acceptee' | 'refusee'
export const DECISION_LABEL: Record<Decision, string> = { en_attente: 'En attente', acceptee: 'Acceptée', refusee: 'Refusée' }

export interface MissionApplication {
  id: string
  missionId: string
  uid: string
  name: string
  message: string
  status: Decision
  createdAt: string
}

export type ReportValidation = 'soumis' | 'valide' | 'a_revoir'
export const REPORT_LABEL: Record<ReportValidation, string> = { soumis: 'Soumis', valide: 'Validé', a_revoir: 'À revoir' }

export interface MissionReport {
  id: string
  missionId: string
  uid: string
  author: string
  body: string
  createdAt: string
  validation: ReportValidation
  reviewerNote?: string
  reviewedBy?: string
}

export interface ReviewNote {
  author: string
  text: string
  at: string
}

export interface Candidature {
  id: string
  characterName: string
  village: Village
  clan: string
  grade: string
  motivations: string
  skills: string
  rpExperience: string
  goals: string
  contact: string
  status: Decision
  notes: ReviewNote[]
  createdAt: string
  uid?: string | null
  demo?: boolean
}

/* ---------- Table stratégique ---------- */
export interface StrategyPiece {
  id: string
  type: string
  side: 0 | 1
  promoted: boolean
  x: number // 0..9 (colonne, fractionnaire possible)
  y: number // 0..9 (rangée)
}
export interface StrategyMarker {
  id: string
  x: number
  y: number
  color: string
}
export interface StrategyArrow {
  id: string
  from: [number, number]
  to: [number, number]
  color: string
}
export interface StrategyNote {
  id: string
  x: number
  y: number
  text: string
}
export interface StrategyState {
  pieces: StrategyPiece[]
  markers: StrategyMarker[]
  arrows: StrategyArrow[]
  notes: StrategyNote[]
}

export interface StrategyPlan {
  id: string
  name: string
  ownerUid: string
  ownerName: string
  shared: boolean
  data: StrategyState
  createdAt: string
  updatedAt: string
}

/* ---------- Session ---------- */
export interface AuthUser {
  uid: string
  email?: string
  displayName: string
  provider: 'local' | 'firebase'
}

export interface Session {
  user: AuthUser | null
  member: Member | null
  rank: Rank | null
  clearance: number
  perms: Permission[]
}

export const VISITOR: Session = { user: null, member: null, rank: null, clearance: 0, perms: [] }

export const can = (s: Session, p: Permission) => s.perms.includes(p)
export const nowIso = () => new Date().toISOString()
export const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
