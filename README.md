# Ōshō — L'École des Ombres

Expérience web 3D explorable : le site **est** le domaine secret de Shikae Nara (univers Naruto RP).
On arrive par la forêt du Pays du Feu, on passe sous le torii, on monte l'escalier, les grandes portes
s'ouvrent et l'on parcourt à la première personne les neuf salles de l'école. Chaque fonction du site
(archives, cours, missions, hiérarchie, candidatures, shogi…) s'ouvre depuis un objet du décor.

> « Si le roi ne bouge pas, ses sujets ne le suivront pas. » — Shikae Nara

---

## Lancer le projet

Prérequis : **Node.js 20 ou plus récent** (testé avec Node 24 / npm 11).

```bash
npm install
```

```bash
npm run dev
```

Puis ouvrir l'adresse affichée (par défaut <http://localhost:5180>).

| Commande            | Effet                                                   |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | serveur de développement (Vite)                         |
| `npm run build`     | vérification TypeScript puis build de production `dist/` |
| `npm run preview`   | sert le build de production localement                  |
| `npm run typecheck` | vérification TypeScript seule                           |

### Déploiement (Netlify ou tout hébergement statique)

`netlify.toml` est fourni : commande `npm run build`, dossier publié `dist`, redirection SPA vers
`index.html` et cache longue durée des ressources. Les modèles et les sons sont **générés dans le
navigateur**. Fichiers statiques : `public/favicon.svg`, l'image de fond de l'écran de chargement,
le portrait de famille du bureau (`public/textures/office/portrait-famille.jpg`, image fournie) et
les **textures PBR photographiques** de `public/textures/pbr/` (≈ 34 Mo, CC0 Poly Haven, voir
`public/textures/pbr/CREDITS.md`). En profil Bas, aucune texture PBR n'est téléchargée.

---

## Contrôles

| Action                           | Clavier / souris                          | Tactile                         |
| -------------------------------- | ----------------------------------------- | ------------------------------- |
| Marcher                          | ZQSD (AZERTY), WASD (QWERTY) ou flèches   | glisser dans la moitié gauche   |
| Regarder                         | souris (cliquer la scène pour la capturer) | glisser dans la moitié droite   |
| Presser le pas                   | Maj                                       | bouton « course »               |
| Interagir / ouvrir une porte     | E ou clic gauche                          | bouton « Interagir »            |
| Plan de l'école                  | M                                         | bouton plan                     |
| Libérer la souris / fermer       | Échap                                     | bouton ×                        |

Les touches sont lues par position physique : ZQSD et WASD fonctionnent sans réglage.
Si la capture de la souris est refusée par le navigateur, maintenir le clic et glisser permet de regarder.

---

## Ce qui est réellement fonctionnel

### Monde 3D
- **Forêt** : relief procédural, ~600 cèdres et érables instanciés (vent animé), rochers moussus,
  ~2 600 fougères, chemin de dalles, lanternes de pierre allumées, torii avec plaque 王将, nobori,
  brume volumétrique (billboards bruités), feuilles d'érable qui tombent, lucioles,
  **cerfs sika articulés** (broutent, guettent, marchent), ciel de crépuscule procédural, montagnes.
  Les cèdres sont découpés en cellules de 44 m avec deux niveaux de détail tirés du même squelette
  (silhouette identique ; au-delà de 48 m, tronc seul et deux grandes cartes par touffe principale,
  cellules lointaines fusionnées par blocs) ; la passe d'ombres utilise toujours la version allégée.
- **Emblème** : symbole du clan Nara vectorisé depuis l'image fournie (`src/core/emblem.ts`, tracé
  unique rempli en pair-impair). Il sert à l'interface (`ui/Emblem.tsx`), à toutes les textures 3D
  (`drawEmblem` : sol du hall, porte, pignons, bannières, nobori, lanternes, tableaux) et au favicon.
  Les bannières ont une toile aux proportions de leur tissu pour que l'emblème reste rond.
- **Abords de la façade** : **cascade** sortant du soubassement (deux chutes animées, écume, remous,
  gouttelettes, bruine, bassin bordé de pierres, tōrō) avec son de chute procédural qui suit la
  distance ; pins noirs taillés en nuages (niwaki) au pied de l'escalier, haies d'azalées taillées le
  long du soubassement, bosquet de bambous à l'ouest (`Waterfall.tsx`, `Gardens.tsx`).
- **Bâtiment** généré depuis un vrai plan (`src/world/layout.ts`) : murs à colombages intérieur /
  extérieur par face, plafonds à caissons, fenêtres de papier éclairées, soubassement de pierres,
  **toitures japonaises procédurales** (pentes concaves, coins relevés, arêtiers, faîtage), pignon
  chidori-hafu à l'emblème, auvent à pignon courbe (karahafu), rideau violet à l'emblème
  (mizuhiki-maku) sous la poutre du porche, shachihoko dorés, murs de shoji éclairés, deux tours de
  guet, terrasse et escalier.
- **Portes fonctionnelles** : grande porte à deux battants (emblème coupé en deux), fusuma et shoji
  coulissants ; leur collisionneur n'est retiré qu'une fois ouvertes.
- **9 salles** décorées et interactives (voir plus bas), visibles seulement depuis les zones adjacentes
  (filtrage de rendu par pièce).
- **Collisions** (murs, mobilier, troncs, garde-corps, limites du monde), hauteur du sol (escalier,
  relief), balancement de tête, bruits de pas selon le sol (bois, tatami, pierre, gravier, forêt).
- **Système d'ombres Nara** : ombre-guide qui s'étire sur le sol jusqu'à l'objet visé, silhouettes de
  cerfs et de shinobi glissant sur les murs et le théâtre d'ombres, vrilles d'encre autour de
  l'emblème, tache d'encre à l'ouverture des menus.
- **Éclairage** : soleil couchant avec ombres portées (carré de 60 m qui suit le joueur par pas
  entiers de texel : pas de scintillement), pool de lumières dynamiques attribuées aux lanternes les
  plus proches (nombre constant → aucune recompilation de shaders), sources ponctuelles de taille
  physique minimale (0,5 m : plus de points chauds blancs près des lanternes), **éclairage indirect
  IBL** préfiltré (ciel de crépuscule froid dehors, ambiance boisée chaude dedans), halos, bloom.
- **Cinématique d'arrivée** (passable), citation, titre, ouverture des portes. **Écran d'accueil**
  retravaillé : plan final un peu en retrait (porte et médaillon au centre, titre au-dessus) ;
  pendant ce plan, le remplissage d'ambiance s'efface au profit des lanternes et d'une lumière de
  mise en valeur douce et chaude sur la porte (ombres portées en Moyen et Élevé, respiration à peine
  perceptible) ; vignettage plus marqué. Interface : titre ivoire et or sur un voile sombre et
  flou, filet doré, hiérarchie titre → kanji et nom → bouton → contrôles ; bouton **Entrer** en
  plaque laquée cerclée d'or (survol, focus clavier, respiration lumineuse) ; contrôles en touches
  lisibles sur fond discret ; apparitions échelonnées (respect de « réduire les animations »).
- **Grande porte** (`building/Doors.tsx`) : planches jointes, traverses chanfreinées, clous en
  demi-sphère sur rondelles, platines de bronze, anneaux de tirage ; **emblème doré en relief** (même
  tracé exact) sur un médaillon de laque noire cerclé d'or, partagé entre les deux battants.
- **Lanternes** : le papier ne s'éclaire plus lui-même (sa lumière, à 30 cm, le blanchissait) : diffus
  sombre et éclat ambré porté par l'émissif ; halos teintés ; lanternes de façade ramenées à 17–23 cd
  (des flaques de lumière chaude au lieu d'un éclairage plat de la porte).
- **Réglages graphiques** Bas / Moyen / Élevé et **résolution adaptative** selon les performances :

  | | Bas | Moyen (défaut ordinateur) | Élevé |
  | --- | --- | --- | --- |
  | Textures | procédurales légères | PBR 1K | PBR 2K (albédo, normale), ARM 1K |
  | Ombres | non | 2048 | 4096, douces |
  | Définition du rendu | 85–100 % de l'écran | 100–125 % (jamais en dessous) | 100–200 % (suréchantillonnage) |
  | Anticrénelage | MSAA du navigateur | SMAA qualité haute | MSAA 4× |
  | Accentuation (CAS) | non | 0,35 | 0,22 |
  | Occlusion ambiante (contact) | non | non | N8AO |
  | Relief du sable | carte de normales | maillage 80² par tuile | maillage 160² par tuile |

  Changer de profil de textures demande un rechargement (bouton proposé dans les réglages).

### Rendu : matériaux, textures et géométrie
- **Textures PBR photographiques** (Poly Haven, CC0) à l'échelle réelle (UV en mètres, taille
  physique de chaque jeu) : enduit (`white_plaster_02`), fil du bois (`oak_veneer_01`), planchers
  hinoki, tatamis, tuiles grises (kawara), granit taillé, pierres à lichen, mousse, écorce d'érable,
  lin. Albédo en sRGB, normales et ARM (occlusion / rugosité / métal) en linéaire, filtrage
  anisotrope 16×, mipmaps, **anti-répétition** des grandes surfaces (double lecture décalée par un
  bruit + variation de teinte à grande échelle). Les albédos teintables gardent la palette d'origine.
- **Bois** : toutes les pièces de bois et de pierre taillée ont des **arêtes chanfreinées** (biseaux de
  12 mm, normales plates : la lumière accroche les arêtes) et un fil orienté selon leur longueur.
- **Shoji et fenêtres** : relief du kumiko et des fibres du washi, lumière transmise ramenée à un
  niveau crédible (plus de surfaces surexposées) ; tone mapping **AgX** (exposition 1,0).
- **Image** (`world/PostFX.tsx`) : bloom réservé aux sources lumineuses (seuil haut), passe de
  finition après le tone mapping (accentuation adaptative au contraste d'après AMD CAS, léger
  contraste en S et saturation), vignettage ; plus de grain. Aucun upscaling temporel (pas de TAA,
  DLSS ou FSR : WebGL n'y a pas accès) : le flou venait surtout de la résolution adaptative, qui
  descendait jusqu'à 60 % (Bas) ou 75 % (Moyen) de la définition de l'écran, et du grain.
- **Jardin du Silence** (`rooms/GardenSand.tsx`, `world/rocks.ts`, `world/maple.ts`) :
  - sable ratissé **en relief réel** : champ de hauteur calculé une fois (lignes droites et cercles
    qui suivent l'empreinte mesurée de chaque pierre, du bassin, des pas japonais et des objets),
    utilisé pour la géométrie (16 tuiles à 3 niveaux de détail), une carte de normales haute
    définition et l'assombrissement des creux ; grain minéral PBR par-dessus ;
  - **pierres organiques** : icosaèdres subdivisés façonnés par plans de clivage, bruit 3D et
    fissures, texture triplanaire sans couture, mousse sur les faces tournées vers le ciel,
    occlusion par sommet ; pas japonais et margelle du bassin du même procédé ;
  - **érables japonais** : ramification récursive (empattement, nappes horizontales), écorce PBR,
    des milliers de cartes de feuilles palmées (5 à 7 lobes dentés, rouges, bordeaux, orangés),
    vent et frémissement dans le shader, ombres portées qui bougent avec les feuilles ;
  - **lanternes kasuga-dōrō** : socle, fût bagué, plateau en lotus, foyer à papier translucide,
    toit hexagonal aux coins relevés, hōju (mêmes lanternes sur l'allée et dans tout le domaine).
- **Forêt** : érables remplacés par le même modèle procédural (instancié). **Cryptomères (sugi)**
  refaites (`world/cedar.ts`) : tronc effilé à écorce PBR (`japanese_cedar_bark`), ~40 branches en
  spirale qui s'allongent vers le bas et retombent, rameaux secondaires, touffes de cartes croisées
  portant des plumes d'aiguilles dessinées (atlas 2 × 2) ; normales orientées vers l'extérieur de la
  couronne, teinte propre à chaque arbre, même vent appliqué à l'écorce et aux aiguilles, et densité
  d'alpha préservée au loin pour que le feuillage ne se troue pas. Moins de touffes en Moyen et Bas.
- **Bosquet de bambous** (madake, `world/bamboo.ts`) : chaumes effilés, penchés vers l'extérieur de
  la touffe et arqués en tête ; entre-nœuds courts au pied, longs au milieu ; nœuds à bourrelet,
  cicatrice de gaine et fine bande de cire, nuance propre à chaque entre-nœud ; rameaux par paires
  alternés dans la moitié haute ; éventails de feuilles lancéolées dessinées (nervures, pointes
  parfois desséchées) sur des cartes instanciées. Le vent et les cartes sont communs avec les cèdres
  (`world/cards.ts`). En Moyen et Bas : chaumes à 6 côtés, nœuds dessinés seulement, moins d'éventails.
- **Pins noirs taillés** (kuromatsu niwaki, `world/pine.ts`) : même silhouette qu'avant au pied de
  l'escalier, mais tronc sinueux à écorce PBR en plaques (`pine_bark`, désaturée vers le gris),
  charpentières coudées par la taille, rameaux rayonnant à plat sous chaque nuage ; nuages faits de
  milliers de pousses en brosse (aiguilles par deux, bourgeon terminal) en cartes croisées, denses
  dessus et dégagées dessous ; vent faible commun au bois et aux aiguilles.
- **Azalées satsuki taillées** (o-karikomi, `world/azalea.ts`) : coussins couverts d'une texture
  triplanaire de petites feuilles (relief, creux assombris), et de rameaux feuillus en cartes posées
  sur la surface (profondeur, frange) ; coussins verts ou rougis par l'automne, quelques feuilles
  rouges éparses sur les verts. Moins de pousses et de rameaux en Moyen et Bas.
- **Shishi-odoshi et tsukubai** (`rooms/ShishiOdoshi.tsx`) : tube de bambou coupé en biais et creux
  (paroi, intérieur pâle, nœud au fond) sur un axe entre deux poteaux ligaturés de corde de palmier ;
  goulotte (kakei) et son filet d'eau continu ; bascule simulée (remplissage, versement dans le
  bassin avec ondes, retour, choc du talon sur la pierre avec le « kon », petit rebond). Le bec est
  tourné vers le bassin. Tsukubai : vasque de pierre taillée, cuvette d'eau, louche de bambou, mousse.
  Les tronçons de bambou isolés viennent de `bambooPiece` (`world/bamboo.ts`).
- **Mobilier** (`props/furniture.ts`, mêmes fonctions et mêmes emprises qu'avant) : coussins
  rembourrés à glands et capiton ; zaisu à dossier cintré ; tables basses à ceinture et pieds
  effilés ; tansu à plateau débordant, poignées en anse, serrure, équerres et poignées latérales ;
  fumizukue à rebords relevés ; nécessaire à encre (pierre, bâton, pinceau, repose-pinceau, pot à
  eau) ; théière à anse latérale et tasses garnies de thé ; bonsaï de pin (pot sur pieds, tronc à
  empattement, coussinets d'aiguilles) ; ikebana d'automne (érable, chrysanthèmes) ; présentoir à
  sabres laqué avec daishō (fourreau, tsuba, poignée tressée).
- **Correctif** : les tubes de bois des érables et des cèdres avaient leurs faces tournées vers
  l'intérieur (on voyait la paroi arrière) ; ils sont maintenant éclairés du bon côté.

### Salles et fonctions
| Salle | Objet interactif | Fonction |
| --- | --- | --- |
| 01 Hall des Ombres | tableau de la devise, emblème au sol, tableau d'annonces, plan gravé (décor : lanternes suspendues, encens sur l'autel) | présentation (5 onglets), annonces (publication réservée), plan interactif + navigation rapide |
| 02 Bibliothèque des Secrets | grande table, plaques Konoha / Suna / Ame / Kiri | archives : recherche plein texte, filtres village / catégorie / classification, lecture, création, modification, suppression, pièces jointes (liens), habilitations |
| 03 Chambre du Shogi | goban | **shogi complet** en 3D + **table stratégique** |
| 04 Dojo de l'Éloquence | pupitre du maître | catalogue (9 disciplines), fiches détaillées, inscriptions, supports de cours, progression, édition des cours, liste des inscrits |
| 05 Bureau des Missions | carte murale, tableau des ordres | missions disponibles / en cours / terminées, candidatures, acceptation / refus, lancement / clôture, rapports et validation |
| 06 Salle du Conseil | table du conseil | hiérarchie shogi, annuaire des membres (portraits à l'encre générés), administration des membres, des grades, de leur ordre, habilitation et permissions |
| 07 Bureau de Shikae Nara | carnet sur le bureau, fenêtre, petit shogi, **portrait de famille**, **bandelette de Kaen** | présentation, histoire, philosophie, projets, messages de la direction ; coin des souvenirs (vue rapprochée et note pour le portrait et la bandelette) |
| 08 Bureau de Recrutement | bureau d'admission | formulaire de candidature validé ; examen avec statuts et notes privées ; création de la fiche membre |
| 09 Jardin du Silence | lanterne, stèle, shishi-odoshi animé, banc, bassin avec carpes koï, érable (sable ratissé en relief, pierres et érables détaillés) | réflexions et anecdotes |

**Bureau de Shikae — coin des souvenirs** (`rooms/OfficeMemories.tsx`) : à gauche de sa place, près de
l'encrier et du carnet, le **portrait de famille** (l'image fournie, peinture recadrée à l'intérieur de
son cadre doré dessiné, sans retouche, signature comprise) dans un cadre debout de bois laqué noir à
filet d'or, sous verre, avec la plaque « Famille ♡ » reprise du cadre d'origine ; devant lui, la
**bandelette de Kaen**, bande de lin pliée en accordéon, extrémité effilochée posée vers sa place, sur
un fukusa de soie dans un plateau laqué. Les deux objets ont leur vue rapprochée et une note sobre
(aucun fait RP ajouté au-delà de ce qui a été fourni). Le portrait n'est chargé qu'à l'ouverture du
bureau.

### Shogi (`src/shogi/engine.ts`)
Moteur maison sans dépendance, vérifié par *perft* (30 / 900 / 25 470 positions aux profondeurs 1-3,
valeurs de référence exactes) : déplacements de toutes les pièces, captures, **parachutages**,
promotions facultatives / obligatoires (choix proposé), interdiction de se mettre en échec, **nifu**,
**uchifuzume**, pièces sans coup possible, mat, pat (défaite en shogi), **sennichite** (nulle à la
quatrième répétition — le cas de l'échec perpétuel n'est pas départagé), annulation, nouvelle partie,
relevé en notation japonaise, export **SFEN**, partie sauvegardée localement, **IA débutante**
(alpha-bêta à deux demi-coups). Pièces 3D pentagonales gravées, retournées à la promotion, komadai.

Les coups passent par un « transport » (`ShogiTransport` dans `src/shogi/store.ts`) : local
aujourd'hui ; un adaptateur réseau pourra le remplacer pour le multijoueur, l'état étant entièrement
décrit par SFEN + liste de coups.

**Table stratégique** : déplacement libre des pièces (glisser), pose de pièces, marqueurs colorés,
flèches, annotations, gomme, position initiale / table vide, **sauvegarde et chargement de plans**
(partage optionnel avec les membres).

### Audio (`src/audio/engine.ts`)
100 % synthétisé (Web Audio) : vent, feuillage, insectes du crépuscule, oiseaux, eau, crépitement des
braseros, craquements du bois, réverbération selon la salle, pas selon le sol, portes, interface,
pièces de shogi, shishi-odoshi, et musique générative au koto (Karplus-Strong, gamme miyako-bushi)
dans la Chambre du Shogi. Démarrage au clic sur « Entrer » (politique d'autolecture), bouton muet et
volumes dans les réglages. **Aucun fichier audio n'est référencé.**

---

## Données, comptes et permissions

### Deux modes
1. **Mode démonstration local** (par défaut, sans configuration) : données dans le `localStorage` du
   navigateur, trois comptes de démonstration (Shikae Nara — Roi ; Kagerō — Tour ; Aki — Pion).
   Les vérifications de permissions sont simulées pour que l'expérience soit fidèle, mais
   **ce mode n'offre aucune sécurité réelle** : n'importe qui peut modifier son stockage local.
   Réinitialisation possible depuis *Réglages → Données*.
2. **Mode Firebase** : activé automatiquement si les variables `VITE_FIREBASE_*` sont définies.
   Authentification e-mail / mot de passe (Firebase Authentication) et données Firestore.
   Le SDK n'est chargé que dans ce mode.

### Variables d'environnement
Copier `.env.example` en `.env.local` (ou les déclarer dans Netlify) :

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Mise en place de Firebase
1. Créer un projet Firebase, activer **Authentication → E-mail / mot de passe** et **Firestore**.
2. Déployer les règles fournies : `firebase deploy --only firestore:rules` (fichiers `firebase.json`,
   `firestore.rules`, `firestore.indexes.json`).
3. Créer votre compte depuis le site (*sceau en haut à droite → Créer un compte*), puis copier votre
   identifiant (affiché dans le panneau du compte).
4. **Amorçage de la direction** (une seule fois, dans la console Firestore) :
   - document `ranks/roi` : `{ name: "Roi", jp: "Ōshō", kanji: "王", order: 8, clearance: 4,
     permissions: ["courses.enroll","missions.apply","strategy.use","archives.write","courses.manage",
     "missions.manage","applications.review","announcements.manage","members.manage","ranks.manage"],
     description: "Direction de l'école." }`
   - document `members/<votre uid>` : `{ name: "Shikae Nara", rankId: "roi", village: "Konoha",
     clan: "Nara", specialty: "", description: "", avatarSeed: 7, joinedAt: "<date ISO>" }`
5. Rechargez le site : *Réglages → Données → Initialiser Firestore* écrit les autres grades et les
   contenus de démonstration (marqués fictifs). Les fiches membres des autres joueurs se créent depuis
   la Salle du Conseil (champ « uid » = identifiant de leur compte) ou depuis une candidature acceptée.

### Modèle de données (une collection Firestore par type — `src/data/types.ts`)
`ranks`, `members`, `announcements`, `archives`, `courses`, `enrollments`, `missions`,
`missionApplications`, `reports`, `candidatures`, `plans`.

### Permissions
Chaque grade porte une **habilitation** (0 Public → 4 Secret) et une liste de **permissions**
(`archives.write`, `courses.manage`, `missions.manage`, `applications.review`,
`announcements.manage`, `members.manage`, `ranks.manage`, plus `courses.enroll`, `missions.apply`,
`strategy.use`). La hiérarchie shogi proposée (Pion, Lance, Cavalier, Général d'argent, Général d'or,
Fou, Tour, Roi) est modifiable par la direction : noms, ordre, habilitation et permissions.

Les règles Firestore appliquent tout côté serveur : un visiteur ne reçoit que les archives, annonces
et missions publiques ; un membre ne lit que ce que son habilitation permet ; personne ne peut classer
un document au-delà de sa propre habilitation ; un membre ne peut pas modifier son grade ; les notes
de recrutement ne sont lisibles que par les examinateurs ; seuls les participants d'une mission
rendent des rapports. Les requêtes de l'application sont écrites pour être compatibles avec ces règles.

---

## Architecture

```
src/
  core/        maths, bruit périodique, tracé de l'emblème
  textures/    générateurs procéduraux (bois, tatami, pierre, tuiles, encre, cartes, shogi…)
  world/       scène 3D : layout (plan du domaine), assets (matériaux), Lighting, Shell (murs,
               toits), Doors, exterior/ (ciel, forêt, abords, cerfs, atmosphère), rooms/ (9 salles),
               props/ (mobilier et lanternes), effects/ (ombre-guide, théâtre d'ombres), shogi/,
               pbr.ts (textures photographiques), rocks.ts, maple.ts, cedar.ts, bamboo.ts, pine.ts,
               azalea.ts, cards.ts,
               shaderTweaks.ts
  player/      contrôleur 1re personne, collisions, entrées
  interaction/ visée, registre des objets interactifs
  shogi/       moteur de règles + état (partie, table stratégique)
  data/        types, dépôt local, adaptateur Firebase, session, données de démonstration
  audio/       moteur audio procédural
  ui/          HUD, écran de chargement, cinématique, panneaux (parchemins), contrôles tactiles
```

Choix techniques :
- **React 19 + TypeScript + Vite**, **Three.js** via **React Three Fiber** et **Drei**,
  **@react-three/postprocessing** (N8AO, bloom, AgX, SMAA, vignette) et une passe de finition maison, **Zustand**, **Tailwind CSS 4**,
  **Motion**, **Firebase** (chargé dynamiquement).
- **Pas de moteur physique (Rapier)** : le sol est défini analytiquement et l'on ne fait que marcher.
  Un solveur 2D cercle / boîtes / cylindres, déterministe et très léger, suffit et évite un module
  WASM. Il gère le glissement le long des murs.
- Le décor statique est **fusionné par matériau** (`StaticBuilder`) et les éléments répétés sont
  **instanciés** : quelques dizaines d'appels de rendu par salle.
- Modèles générés au chargement ; textures procédurales en profil Bas, photographiques (PBR) en Moyen
  et Élevé, partagées en mémoire GPU entre matériaux (une image, plusieurs répétitions).

---

## Limites connues et travail restant (liste honnête)

- **Modèles** : tout est modélisé procéduralement (aucun GLB). Le jardin (sable, pierres, érables,
  lanternes), les cèdres de la forêt, le bosquet de bambous, les pins taillés et les azalées de la
  façade, le shishi-odoshi, le tsukubai et le mobilier le plus en vue ont été refaits en détail ; les
  étagères, casiers à rouleaux, paravents, rouleaux suspendus, braseros et estrades gardent leurs
  formes d'origine (boîtes et cylindres texturés).
- **Compression GPU (KTX2 / Basis)** : non mise en place. Les textures sont en JPEG, décompressées en
  mémoire vidéo (≈ 0,6 Go en Élevé, ≈ 0,2 Go en Moyen). Les encodeurs disponibles demandaient un binaire externe ou un
  paquet communautaire à auditer ; c'est l'étape suivante pour réduire la mémoire de 4 à 8×.
- **4K** : aucune texture 4K. À la taille réelle des jeux, le 2K donne déjà plus de 1 000 px par mètre
  sur les surfaces vues de près ; le 4K quadruplerait la mémoire sans gain visible sans compression.
- **Coût** : en Élevé, environ 6 M de triangles par image dans le jardin (moitié ombre du soleil,
  moitié image, la forêt visible au-dessus des toits en représentant l'essentiel). Depuis la terrasse
  face à la forêt et aux bambous : ≈ 6,8 M de triangles et 535 appels en Élevé, 2,8 M / 383 en Moyen,
  1,2 M / 107 en Bas ; devant la façade (pins, azalées) : 2,3 M / 736 en Moyen (mesures du navigateur
  intégré, ombre comprise).
- **Vue à la troisième personne** : non implémentée (aucun modèle de personnage) ; l'expérience est à
  la première personne.
- **Galeries et mezzanines** (hall, bibliothèque) : décoratives, non praticables (accès signalé comme
  réservé).
- **Shogi multijoueur en réseau** : architecture prête (transport, SFEN), adaptateur réseau non écrit.
  L'IA est volontairement débutante. Le cas de l'échec perpétuel lors d'un sennichite n'est pas
  départagé.
- **Mode Firebase** : l'adaptateur et les règles sont écrits et vérifiés par le compilateur, mais
  **n'ont pas pu être testés contre un vrai projet Firebase** (aucune configuration disponible lors du
  développement). Prévoir un test de bout en bout avec l'émulateur Firestore avant la mise en ligne.
- **Pièces jointes des archives** : sous forme de liens http(s) ; pas de téléversement de fichiers
  (Firebase Storage non branché).
- **Dépôt de candidatures par les visiteurs** (mode Firebase) : ouvert à tous par conception ; pour un
  usage public, ajouter Firebase App Check ou un captcha contre le spam.
- **Contenus** : archives, cours, missions, annonces et personnages autres que Shikae Nara sont des
  **exemples fictifs** marqués « Démo · fictif ». L'histoire détaillée de Shikae n'a pas été inventée :
  les pages concernées l'indiquent.
- **Mobile** : contrôles tactiles et qualité « Bas » par défaut ; la génération des textures au
  chargement peut prendre quelques secondes sur un appareil modeste.
- **Taille** : le bundle principal fait ~1,8 Mo (≈ 590 Ko compressé) — Three.js, R3F et le
  post-traitement ; textures PBR téléchargées : ≈ 8,5 Mo en Moyen (1K), ≈ 28 Mo en Élevé (2K).
