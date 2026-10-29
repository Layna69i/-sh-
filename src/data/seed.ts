/**
 * Données initiales. Tout ce qui n'est pas issu de la fiche fournie pour
 * Shikae Nara est marqué `demo: true` et présenté comme FICTIF dans l'interface,
 * en attendant les véritables informations RP.
 */
import type { Rank, Member, Announcement, ArchiveDoc, Course, Mission, Candidature, Permission } from './types'

const BASE: Permission[] = ['courses.enroll', 'missions.apply', 'strategy.use']

export const SEED_RANKS: Rank[] = [
  { id: 'pion', name: 'Pion', jp: 'Fuhyō', kanji: '歩', order: 1, clearance: 1, permissions: [...BASE], description: "Élève récemment admis. Observe, apprend, rend compte. Une fois au bout du plateau, un pion peut devenir or." },
  { id: 'lance', name: 'Lance', jp: 'Kyōsha', kanji: '香', order: 2, clearance: 1, permissions: [...BASE], description: "Avance droit vers l'objectif : éclaireur, messager, agent de liaison." },
  { id: 'cavalier', name: 'Cavalier', jp: 'Keima', kanji: '桂', order: 3, clearance: 2, permissions: [...BASE], description: 'Contourne les obstacles : approches indirectes, filatures, infiltration discrète.' },
  { id: 'argent', name: "Général d'argent", jp: 'Ginshō', kanji: '銀', order: 4, clearance: 2, permissions: [...BASE, 'archives.write'], description: "Analyste de terrain. Rédige les rapports d'observation et alimente les archives." },
  { id: 'or', name: "Général d'or", jp: 'Kinshō', kanji: '金', order: 5, clearance: 3, permissions: [...BASE, 'archives.write', 'courses.manage'], description: 'Enseignant et gardien des archives : transmet les arts de la parole et du renseignement.' },
  { id: 'fou', name: 'Fou', jp: 'Kakugyō', kanji: '角', order: 6, clearance: 3, permissions: [...BASE, 'archives.write', 'courses.manage', 'missions.manage'], description: 'Stratège des chemins détournés : conçoit et coordonne les missions.' },
  { id: 'tour', name: 'Tour', jp: 'Hisha', kanji: '飛', order: 7, clearance: 4, permissions: [...BASE, 'archives.write', 'courses.manage', 'missions.manage', 'applications.review', 'announcements.manage'], description: 'Bras droit de la direction : recrutement, annonces, supervision.' },
  { id: 'roi', name: 'Roi', jp: 'Ōshō', kanji: '王', order: 8, clearance: 4, permissions: [...BASE, 'archives.write', 'courses.manage', 'missions.manage', 'applications.review', 'announcements.manage', 'members.manage', 'ranks.manage'], description: "Direction de l'école. « Si le roi ne bouge pas, ses sujets ne le suivront pas. »" },
]

export const SHIKAE_MEMBER: Member = {
  id: 'm-shikae',
  uid: 'demo-shikae',
  name: 'Shikae Nara',
  rankId: 'roi',
  village: 'Konoha',
  clan: 'Nara',
  specialty: 'Stratégie · psychologie · renseignement',
  description:
    "Fondatrice de l'École des Ombres. Jeune kunoichi du clan Nara de Konoha, fille de Shikazu Nara et de Shiori Nara. Calme, discrète et observatrice, elle s'intéresse à la stratégie, au shogi, à la psychologie, à l'art de la parole et aux relations entre les villages shinobi.",
  avatarSeed: 7,
  joinedAt: '2026-01-01T00:00:00.000Z',
  demo: false,
}

const d = (n: number) => new Date(Date.UTC(2026, 8, 1 + n)).toISOString()

export const SEED_MEMBERS: Member[] = [
  SHIKAE_MEMBER,
  { id: 'm-kagero', uid: 'demo-tour', name: 'Kagerō', rankId: 'tour', village: 'Konoha', specialty: 'Recrutement · contre-renseignement', description: 'Personnage fictif de démonstration : bras droit chargé des admissions.', avatarSeed: 21, joinedAt: d(2), demo: true },
  { id: 'm-mizore', name: 'Mizore', rankId: 'fou', village: 'Kiri', specialty: 'Planification de missions', description: 'Personnage fictif de démonstration : coordinatrice des opérations.', avatarSeed: 34, joinedAt: d(4), demo: true },
  { id: 'm-tsumugi', name: 'Tsumugi', rankId: 'or', village: 'Konoha', specialty: 'Oratoire · diplomatie', description: 'Personnage fictif de démonstration : enseignante du Dojo de l’Éloquence.', avatarSeed: 45, joinedAt: d(5), demo: true },
  { id: 'm-hayate', name: 'Hayate', rankId: 'argent', village: 'Suna', specialty: 'Observation · rapports', description: 'Personnage fictif de démonstration : analyste de terrain.', avatarSeed: 52, joinedAt: d(9), demo: true },
  { id: 'm-ren', name: 'Ren', rankId: 'cavalier', village: 'Ame', specialty: 'Filature', description: 'Personnage fictif de démonstration.', avatarSeed: 63, joinedAt: d(12), demo: true },
  { id: 'm-sora', name: 'Sora', rankId: 'lance', village: 'Konoha', specialty: 'Liaison', description: 'Personnage fictif de démonstration.', avatarSeed: 77, joinedAt: d(14), demo: true },
  { id: 'm-aki', uid: 'demo-pion', name: 'Aki', rankId: 'pion', village: 'Konoha', specialty: 'Élève', description: 'Personnage fictif de démonstration : élève récemment admis.', avatarSeed: 88, joinedAt: d(20), demo: true },
]

export const DEMO_ACCOUNTS = [
  { uid: 'demo-shikae', label: 'Shikae Nara', role: 'Roi — direction (accès complet)' },
  { uid: 'demo-tour', label: 'Kagerō (fictif)', role: 'Tour — recrutement, annonces, missions' },
  { uid: 'demo-pion', label: 'Aki (fictif)', role: 'Pion — élève (accès restreint)' },
]

export const SEED_ANNOUNCEMENTS: Announcement[] = [
  { id: 'a-1', title: 'Ouverture du registre des admissions', body: "Le Bureau de Recrutement reçoit désormais les candidatures. Toute aptitude à l'observation, à la stratégie ou à la parole mérite d'être présentée, quel que soit le grade ou le clan.", author: 'Direction', createdAt: d(10), pinned: true, channel: 'general', clearance: 0, demo: true },
  { id: 'a-2', title: 'Premier cycle d’enseignements', body: 'Le Dojo de l’Éloquence publie son catalogue. Les inscriptions sont ouvertes aux membres admis.', author: 'Direction', createdAt: d(12), pinned: false, channel: 'general', clearance: 0, demo: true },
  { id: 'a-3', title: 'Rappel aux membres', body: 'Les archives classées ne quittent jamais la Bibliothèque des Secrets. Ce qui est lu ici reste ici.', author: 'Direction', createdAt: d(14), pinned: false, channel: 'general', clearance: 1, demo: true },
  { id: 'a-dir-1', title: 'Le mot de la direction', body: "Chaque pièce de cette école possède une fonction, comme chaque pièce d'un plateau de shogi. Avant d'avancer, observez. Avant de parler, écoutez. (Message de démonstration — à remplacer par la direction.)", author: 'Shikae Nara', createdAt: d(11), pinned: true, channel: 'direction', clearance: 0, demo: true },
]

const ARCH = (a: Omit<ArchiveDoc, 'createdAt' | 'updatedAt' | 'attachments' | 'demo'> & { attachments?: ArchiveDoc['attachments'] }): ArchiveDoc => ({
  attachments: [],
  ...a,
  createdAt: d(3),
  updatedAt: d(3),
  demo: true,
})

const DEMO_NOTE = "\n\n— Dossier de démonstration : contenu fictif à remplacer par de véritables informations RP."

export const SEED_ARCHIVES: ArchiveDoc[] = [
  ARCH({ id: 'ar-konoha', title: 'Fiche de village — Konoha', date: 'An I, saison des érables', author: 'Archives de l’école', village: 'Konoha', category: 'village', clearance: 0, summary: 'Structure de présentation d’une fiche de village : gouvernance, forces, alliances, points d’attention.', body: "Gouvernance : à compléter.\nForces notables : à compléter.\nAlliances connues : à compléter.\nPoints d'attention : à compléter." + DEMO_NOTE, tags: ['fiche', 'Pays du Feu'] }),
  ARCH({ id: 'ar-suna', title: 'Fiche de village — Suna', date: 'An I, saison des érables', author: 'Archives de l’école', village: 'Suna', category: 'village', clearance: 0, summary: 'Modèle de fiche pour le Village caché du Sable.', body: 'Gouvernance : à compléter.\nRoutes commerciales : à compléter.\nRelations avec Konoha : à compléter.' + DEMO_NOTE, tags: ['fiche', 'Pays du Vent'] }),
  ARCH({ id: 'ar-ame', title: 'Fiche de village — Ame', date: 'An I, saison des érables', author: 'Archives de l’école', village: 'Ame', category: 'village', clearance: 1, summary: 'Modèle de fiche pour le Village caché de la Pluie.', body: 'Situation géographique : entre les grandes nations.\nInformations disponibles : à compléter.' + DEMO_NOTE, tags: ['fiche', 'Pays de la Pluie'] }),
  ARCH({ id: 'ar-kiri', title: 'Fiche de village — Kiri', date: 'An I, saison des érables', author: 'Archives de l’école', village: 'Kiri', category: 'village', clearance: 1, summary: 'Modèle de fiche pour le Village caché de la Brume.', body: 'Gouvernance : à compléter.\nAccès maritimes : à compléter.' + DEMO_NOTE, tags: ['fiche', "Pays de l'Eau"] }),
  ARCH({ id: 'ar-obs-1', title: 'Observation — affluence au poste frontière', date: 'An I, 3e lune', author: 'Hayate (fictif)', village: 'Suna', category: 'observation', clearance: 2, summary: 'Exemple de rapport : horaires, volumes, comportements inhabituels.', body: 'Méthode : trois jours d’observation, relevés matin et soir.\nConstats : exemple de constat.\nHypothèses : exemple d’hypothèse, à confirmer.' + DEMO_NOTE, tags: ['frontière', 'commerce'] }),
  ARCH({ id: 'ar-dipl-1', title: 'Note diplomatique — canaux d’échange', date: 'An I, 4e lune', author: 'Tsumugi (fictif)', village: 'Inter-villages', category: 'diplomatie', clearance: 2, summary: 'Exemple de note : interlocuteurs, sujets sensibles, formules à éviter.', body: 'Interlocuteurs : à compléter.\nSujets sensibles : à compléter.\nRecommandations : écouter davantage que l’on ne parle.' + DEMO_NOTE, tags: ['diplomatie'] }),
  ARCH({ id: 'ar-evt-1', title: 'Événement RP — modèle de compte rendu', date: 'An I, 5e lune', author: 'Archives de l’école', village: 'Konoha', category: 'evenement', clearance: 0, summary: 'Gabarit à suivre pour consigner un événement RP.', body: 'Date : —\nLieu : —\nParticipants : —\nDéroulé : —\nConséquences : —' + DEMO_NOTE, tags: ['gabarit'] }),
  ARCH({ id: 'ar-org-1', title: 'Organisation — fiche d’analyse', date: 'An I, 5e lune', author: 'Mizore (fictif)', village: 'Inter-villages', category: 'organisation', clearance: 3, summary: 'Exemple de fiche confidentielle sur une organisation.', body: 'Nom : —\nObjectifs supposés : —\nMembres identifiés : —\nNiveau de menace : —' + DEMO_NOTE, tags: ['organisation'] }),
  ARCH({ id: 'ar-strat-1', title: 'Dossier stratégique — trois coups d’avance', date: 'An I, 6e lune', author: 'Direction (démo)', village: 'Konoha', category: 'strategie', clearance: 3, summary: 'Exemple de dossier : scénarios, réponses préparées, signaux d’alerte.', body: 'Scénario A : —\nScénario B : —\nRéponses préparées : —\nSignaux d’alerte : —' + DEMO_NOTE, tags: ['anticipation'] }),
  ARCH({ id: 'ar-secret-1', title: 'Registre scellé', date: 'An I, 7e lune', author: 'Direction (démo)', village: 'Konoha', category: 'strategie', clearance: 4, summary: 'Exemple de dossier de niveau Secret, visible uniquement par la Tour et le Roi.', body: 'Ce registre illustre le plus haut niveau de classification.' + DEMO_NOTE, tags: ['secret'] }),
]

const L = (id: string, title: string, body: string) => ({ id, title, body })
const C = (c: Omit<Course, 'createdAt' | 'demo'>): Course => ({ ...c, createdAt: d(6), demo: true })

export const SEED_COURSES: Course[] = [
  C({ id: 'c-strat', title: 'Trois coups d’avance', discipline: 'strategie', teacher: 'Mizore (fictif)', description: 'Apprendre à anticiper les conséquences de chaque décision, à la manière d’une partie de shogi.', objectives: ['Identifier les options de l’adversaire', 'Évaluer les conséquences à trois coups', 'Préparer des réponses avant d’en avoir besoin'], lessons: [L('l1', 'Le plateau avant les pièces', 'Avant de bouger, on regarde le terrain : qui contrôle quoi, quelles cases sont menacées, quelles ressources restent en main.'), L('l2', 'Penser en arbres', 'Chaque décision ouvre des branches. On apprend à en suivre trois, puis à élaguer celles qui ne mènent nulle part.'), L('l3', 'Le sacrifice utile', 'Céder une pièce peut ouvrir une ligne. On étudie quand perdre peu permet de gagner beaucoup.')], level: 'Ouvert à tous les membres', date: 'Chaque 1re lune', status: 'ouvert', visibility: 'public' }),
  C({ id: 'c-analyse', title: 'Lire les intentions', discipline: 'analyse', teacher: 'Hayate (fictif)', description: 'Bases de l’analyse comportementale : posture, rythme, écarts au comportement habituel.', objectives: ['Établir une ligne de base', 'Repérer les écarts', 'Distinguer indice et preuve'], lessons: [L('l1', 'La ligne de base', 'On ne peut repérer un changement qu’en connaissant l’état normal d’une personne.'), L('l2', 'Les écarts', 'Hésitations, gestes répétés, détours de langage : ce sont des indices, jamais des preuves.')], level: 'Pion et plus', date: 'Chaque 2e lune', status: 'ouvert', visibility: 'public' }),
  C({ id: 'c-psy', title: 'Psychologie du shinobi', discipline: 'psychologie', teacher: 'Tsumugi (fictif)', description: 'Motivations, peurs et loyautés : comprendre ce qui fait agir un ninja.', objectives: ['Comprendre les motivations', 'Gérer sa propre pression', 'Reconnaître la manipulation'], lessons: [L('l1', 'Ce qui fait agir', 'Devoir, peur, ambition, attachement : quatre moteurs que l’on retrouve dans presque chaque décision.'), L('l2', 'Sous pression', 'Respiration, recul, silence : garder la tête froide quand tout presse.')], level: 'Pion et plus', date: 'Chaque 2e lune', status: 'en_cours', visibility: 'public' }),
  C({ id: 'c-oratoire', title: 'L’art de la parole', discipline: 'oratoire', teacher: 'Tsumugi (fictif)', description: 'Structurer un discours, choisir ses mots, maîtriser les silences.', objectives: ['Construire un argument', 'Adapter son registre', 'Utiliser le silence'], lessons: [L('l1', 'Un discours en trois temps', 'Accrocher, démontrer, conclure. Le reste n’est que décoration.'), L('l2', 'Le poids d’un silence', 'Un silence bien placé pèse plus lourd qu’une phrase de trop.'), L('l3', 'Atelier', 'Exercice pratique en RP : défendre une position devant le Conseil.')], level: 'Ouvert à tous les membres', date: 'Chaque 3e lune', status: 'ouvert', visibility: 'public' }),
  C({ id: 'c-diplo', title: 'Diplomatie entre villages', discipline: 'diplomatie', teacher: 'Tsumugi (fictif)', description: 'Comprendre les relations entre Konoha, Suna, Ame et Kiri, et l’art de négocier sans céder l’essentiel.', objectives: ['Cartographier les intérêts', 'Préparer une négociation', 'Préserver la relation'], lessons: [L('l1', 'Intérêts et positions', 'Une position est ce que l’on demande ; un intérêt est ce dont on a besoin. On négocie sur les intérêts.')], level: 'Cavalier et plus', date: 'Chaque 4e lune', status: 'ouvert', visibility: 'public' }),
  C({ id: 'c-obs', title: 'L’œil patient', discipline: 'observation', teacher: 'Hayate (fictif)', description: 'Techniques d’observation discrète : se fondre, mémoriser, rapporter fidèlement.', objectives: ['Mémoriser une scène', 'Rédiger un rapport factuel'], lessons: [L('l1', 'Voir sans être vu', 'La meilleure cachette est souvent une place où l’on a toutes les raisons d’être.'), L('l2', 'Le rapport factuel', 'Ce que j’ai vu, ce que j’ai entendu, ce que j’en déduis : trois colonnes à ne jamais mélanger.')], level: 'Ouvert à tous les membres', date: 'Chaque 1re lune', status: 'ouvert', visibility: 'public' }),
  C({ id: 'c-rens', title: 'Collecte de renseignements', discipline: 'renseignement', teacher: 'Mizore (fictif)', description: 'Sources, recoupements et protection des informateurs.', objectives: ['Évaluer une source', 'Recouper une information', 'Protéger ses informateurs'], lessons: [L('l1', 'Évaluer une source', 'Fiabilité de la source, plausibilité de l’information : deux notes distinctes.')], level: 'Cavalier et plus', date: 'Chaque 5e lune', status: 'ouvert', visibility: 'membres' }),
  C({ id: 'c-interro', title: 'Interrogatoire (cadre RP)', discipline: 'interrogatoire', teacher: 'Kagerō (fictif)', description: 'Conduire un interrogatoire dans un cadre narratif : préparation, questions ouvertes, cohérence du récit.', objectives: ['Préparer un interrogatoire RP', 'Mener des questions ouvertes', 'Respecter le cadre consenti entre joueurs'], lessons: [L('l1', 'Le cadre', 'En RP, tout interrogatoire se joue dans un cadre accepté par les joueurs. La narration prime sur la « victoire ».')], level: "Général d'argent et plus", date: 'Sur convocation', status: 'complet', visibility: 'membres' }),
  C({ id: 'c-influence', title: 'Influence et manipulation (cadre RP)', discipline: 'influence', teacher: 'Kagerō (fictif)', description: 'Leviers d’influence dans la narration : réciprocité, autorité, rareté — et comment les reconnaître.', objectives: ['Identifier les leviers', 'S’en protéger', 'Les utiliser avec cohérence dans le RP'], lessons: [L('l1', 'Six leviers', 'Réciprocité, engagement, preuve sociale, autorité, sympathie, rareté.')], level: "Général d'or et plus", date: 'Sur convocation', status: 'brouillon', visibility: 'membres' }),
]

export const SEED_MISSIONS: Mission[] = [
  { id: 'mi-1', title: 'Relevé des patrouilles de la lisière', summary: 'Noter les horaires et itinéraires des patrouilles à la lisière de la forêt des Nara.', objectives: ['Observer trois jours', 'Rédiger un rapport factuel'], village: 'Konoha', difficulty: 'D', leader: 'Mizore (fictif)', status: 'disponible', participants: [], maxParticipants: 3, clearance: 0, createdAt: d(15), demo: true },
  { id: 'mi-2', title: 'Écouter le marché de Suna', summary: 'Recueillir les rumeurs commerciales du marché sans attirer l’attention.', objectives: ['Identifier trois sources', 'Recouper les rumeurs'], village: 'Suna', difficulty: 'C', leader: 'Mizore (fictif)', status: 'disponible', participants: [{ uid: 'demo-x', name: 'Ren (fictif)' }], maxParticipants: 2, clearance: 1, createdAt: d(16), demo: true },
  { id: 'mi-3', title: 'Escorte d’un émissaire', summary: 'Accompagner discrètement un émissaire jusqu’à la frontière du Pays de la Pluie.', objectives: ['Assurer la discrétion', 'Observer les contacts'], village: 'Ame', difficulty: 'B', leader: 'Kagerō (fictif)', status: 'en_cours', participants: [{ uid: 'demo-y', name: 'Hayate (fictif)' }, { uid: 'demo-z', name: 'Sora (fictif)' }], maxParticipants: 3, clearance: 2, createdAt: d(8), demo: true },
  { id: 'mi-4', title: 'Cartographier les criques', summary: 'Relever les points d’accès maritimes près de Kiri.', objectives: ['Relever les accès', 'Estimer les courants'], village: 'Kiri', difficulty: 'C', leader: 'Mizore (fictif)', status: 'terminee', participants: [{ uid: 'demo-y', name: 'Hayate (fictif)' }], maxParticipants: 2, clearance: 0, createdAt: d(1), demo: true },
  { id: 'mi-5', title: 'Opération scellée', summary: 'Mission de démonstration de niveau Confidentiel.', objectives: ['—'], village: 'Inter-villages', difficulty: 'A', leader: 'Direction (démo)', status: 'disponible', participants: [], maxParticipants: 2, clearance: 3, createdAt: d(18), demo: true },
]

export const SEED_CANDIDATURES: Candidature[] = [
  { id: 'cand-1', characterName: 'Yūgure (fictif)', village: 'Konoha', clan: '—', grade: 'Genin', motivations: 'Candidature de démonstration : apprendre l’observation et la stratégie.', skills: 'Mémoire visuelle, patience.', rpExperience: 'Deux ans de RP (exemple).', goals: 'Devenir informatrice.', contact: 'yugure#0000 (fictif)', status: 'en_attente', notes: [], createdAt: d(19), demo: true },
  { id: 'cand-2', characterName: 'Tōya (fictif)', village: 'Suna', clan: '—', grade: 'Chūnin', motivations: 'Candidature de démonstration.', skills: 'Négociation.', rpExperience: 'Débutant (exemple).', goals: 'Diplomatie entre villages.', contact: '—', status: 'acceptee', notes: [{ author: 'Kagerō (fictif)', text: 'Entretien concluant (exemple).', at: d(20) }], createdAt: d(17), demo: true },
]
