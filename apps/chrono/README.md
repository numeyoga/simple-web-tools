# Chrono

Application de suivi du temps en JavaScript vanilla (modules ES, Vite) : pas de framework à
l'exécution. Les seules dépendances d'exécution sont les paquets du monorepo
`@simple-web-tools/storage` (noms de stockage, migrations IndexedDB, espaces, export JSON) et
`@simple-web-tools/dates` (dates locales), plus `idb` (1 ko) par l'intermédiaire du premier
([raison](../../packages/storage/README.md)).

## Fonctionnalités

- **Chronos parallèles** : plusieurs sessions peuvent tourner en même temps,
  avec pause et reprise individuelles ou globales.
- **Pointage de présence** : arrivée, pause, départ, affichés dans le widget de
  la barre latérale.
- **Saisie manuelle** : création d'une session déjà terminée (rattrapage) et
  édition d'une session existante (projet, description, début, fin).
- **Todos** : liste de tâches avec filtre par projet et groupes par échéance.
  Une todo peut lancer un chrono.
- **Projets** : cartes avec totaux, couleur, client, archivage.
- **Rapport hebdomadaire** : totaux par jour et par projet, export CSV
  (séparateur `;`, virgule décimale, BOM UTF-8, lisible dans Excel en français).
- **Espaces de sauvegarde** : plusieurs jeux de données indépendants, création,
  renommage, suppression, bascule.
- **Export et import JSON** d'un espace (l'import remplace les données de
  l'espace courant après confirmation).

## Données

Tout reste dans le navigateur, rien n'est envoyé à un serveur.

- Chaque espace possède sa propre base IndexedDB (`chrono__<id>`), en schéma version 2
  (voir ci-dessous).
- Chrono n'écrit plus dans `localStorage` à la place d'IndexedDB. Si IndexedDB est indisponible
  ou ne s'ouvre pas (navigation privée, stockage bloqué, ancien onglet Chrono qui garde la base
  ouverte), un écran d'erreur remplace l'application et rien n'est lu ni écrit ailleurs. Les
  sauvegardes de repli des anciennes versions (`chrono-fallback-<id>-v2`, ou
  `chrono.fallback.<id>.v1`) sont importées **une seule fois** dans IndexedDB quand la base de
  l'espace est vide ; l'import est noté dans le store `meta` (`fallbackImported`) et les clés
  `localStorage` ne sont jamais supprimées.
- **Un seul onglet écrit** (décision 0004) : il détient le verrou Web Lock `chrono-write-lock`
  (un verrou pour toute l'application, pas un par espace : l'import, la création et la
  suppression d'un espace écrivent dans d'autres bases que l'espace actif). Les autres onglets
  sont en **lecture seule** : une bannière l'indique, les commandes qui modifient des données
  sont désactivées (ou refusent avec un message), les raccourcis clavier ne font rien, et les
  durées continuent de défiler. Un onglet en lecture seule relit la base quand l'onglet qui écrit
  annonce un changement (`chrono-sync-<id>`) et devient l'onglet d'écriture quand l'autre se ferme.
- **Données de démonstration** : jamais chargées automatiquement. Dans un espace vide, la
  Timeline propose un bouton « Charger des données de démonstration » ; la création d'un espace
  peut aussi les inclure, sur demande.
- La liste des espaces et l'espace actif sont dans `localStorage` (`chrono-workspaces` et
  `chrono-workspace-active`, gérés par le registre de `@simple-web-tools/storage`).
- Changer d'espace ou importer un JSON recharge la page.

Vider les données du site dans le navigateur efface donc les données de Chrono :
pensez à l'export JSON pour sauvegarder.

### Schéma version 2 et migration depuis la version 1

La version 1 (celle du site GitLab) stockait des champs en français. La version 2 les a
renommés en anglais ; le modèle est décrit dans `src/types.d.ts`. Un champ absent de ce tableau
est conservé tel quel, sur la même clé.

| Version 1                                 | Version 2                                   |
| ----------------------------------------- | ------------------------------------------- |
| Base IndexedDB, version 1                 | Même base `chrono__<id>`, version 2         |
| Store `projets`                           | `projects`                                  |
| Store `todos`, `sessions`, `meta`         | Inchangés (`todos`, `sessions`, `meta`)     |
| Store `pointage`                          | `attendance`                                |
| Projet `nom`                              | `name`                                      |
| Projet `couleur`                          | `color`                                     |
| Projet `archive`                          | `archived`                                  |
| Projet `id`, `client`                     | Inchangés                                   |
| Todo `titre`                              | `title`                                     |
| Todo `fait`                               | `done`                                      |
| Todo `projetId`                           | `projectId`                                 |
| Todo `echeance`                           | `dueDate` (voir la note ci-dessous)         |
| Todo `creeLe`                             | `createdAt`                                 |
| Todo `id`, `description`                  | Inchangés                                   |
| Session `projetId`                        | `projectId`                                 |
| Session `debut`                           | `start`                                     |
| Session `dernierDebut`                    | `lastStart`                                 |
| Session `fin`                             | `end`                                       |
| Session `duree`                           | `duration`                                  |
| Session `statut`                          | `status`                                    |
| Session `statut: 'terminee'`              | `status: 'done'`                            |
| Session `statut: 'en_cours'`              | `status: 'running'`                         |
| Session `statut: 'en_pause'`              | `status: 'paused'`                          |
| Session `id`, `description`               | Inchangés                                   |
| Pointage `sessionsSuspenduesIds`          | `suspendedSessionIds`                       |
| Pointage `sessionSuspendueId` (ancien)    | Replié dans `suspendedSessionIds`, supprimé |
| Pointage `type: 'arrivee'`                | `type: 'arrival'`                           |
| Pointage `type: 'pause_debut'`            | `type: 'break_start'`                       |
| Pointage `type: 'pause_fin'`              | `type: 'break_end'`                         |
| Pointage `type: 'depart'`                 | `type: 'departure'`                         |
| Pointage `id`, `at`                       | Inchangés                                   |
| Liste des espaces `chrono.workspaces`     | `chrono-workspaces` (registre du paquet)    |
| Espace `creeLe`                           | `createdAt`                                 |
| Espace `seedOnInit`                       | Ignoré (démo jamais automatique)            |
| Espace actif `chrono.workspace.active`    | `chrono-workspace-active`                   |
| Repli `chrono.fallback.<id>.v1`           | Importé une fois dans IndexedDB, conservé   |
| Export JSON `version: 1` (sans enveloppe) | Enveloppe `chrono-workspace` version 2      |
| Export `exporteLe`, `workspace`           | `exportedAt` ; `workspace` n'est plus écrit |

Notes :

- **Échéance relative** : les premières versions stockaient des étiquettes (`today`, `fri`…) dans
  `echeance`. La migration ne fait que renommer le champ ; l'étiquette devient une date
  `AAAA-MM-JJ` au chargement (elle a besoin de l'heure courante, que `src/core/migrations.js`
  ne lit pas), puis la date est réécrite.
- **IndexedDB** : `openDatabase` enchaîne deux étapes. L'étape 0 recrée exactement la disposition
  de la version 1 (`createStoresIfMissing`) : une base neuve et une base existante convergent.
  L'étape 1 lit les anciens stores dans la transaction de mise à niveau, convertit chaque
  enregistrement avec `v1ToV2`, crée `projects` et `attendance`, supprime `projets` et
  `pointage` et réécrit `todos` et `sessions` sur place. Une erreur annule toute la mise à niveau :
  la base reste en version 1.
- **Espaces** : au premier démarrage sans `chrono-workspaces`, la liste `chrono.workspaces` et
  l'espace actif sont repris avec les mêmes identifiants (les noms de base restent donc
  `chrono__<id>`). Les anciennes clés ne sont jamais supprimées.
- **Identifiants refusés par le registre** : la version 1 fabriquait l'id par
  `slugify(label).slice(0, 40)` puis ajoutait `-2`, `-3`… pour un doublon. Un id pouvait donc
  finir par un tiret (coupure à 40 caractères), contenir `--` (`…-` puis `-2`) ou dépasser 40
  caractères, ce que le registre refuse. Chaque espace de ce genre reçoit un id valide et unique
  (`planLegacyWorkspaces`), l'association ancien id / nouvel id est notée dans
  `chrono-legacy-workspaces`, et le contenu de sa base `chrono__<ancien id>` (ouverte avec l'API
  brute, sans validation du nom) est copié une fois, converti par `v1ToV2`, dans
  `chrono__<nouvel id>` par l'onglet d'écriture. L'ancienne base n'est jamais modifiée ni
  supprimée, et une base de destination qui contient déjà des données n'est pas écrasée.
- **Repli localStorage** : voir la section Données. Une sauvegarde `chrono.fallback.<id>.v1` est
  convertie par `v1ToV2` au moment de l'import (sous son ancien id pour un espace dont l'id a été
  corrigé) ; elle n'est pas modifiée.
- **Export et import** : les nouveaux exports sont une enveloppe
  `{ app: 'chrono', format: 'chrono-workspace', version: 2, exportedAt, data }`. L'import accepte
  aussi, pour toujours, les fichiers de la version 1 du site GitLab (un objet nu, sans `app`) :
  ils sont enveloppés en version 1 puis convertis par `v1ToV2`. Un fichier d'une autre application
  ou d'une version plus récente est refusé (`wrong-app`, `newer-version`).

## Architecture

Application [Vite](https://vite.dev/) en modules ES, sans framework à l'exécution
([décision 0003](../../docs/decisions/0003-no-runtime-framework.md)). Le code suit l'architecture
de référence ([décision 0004](../../docs/decisions/0004-reference-architecture.md)) :

```text
index.html            point d'entrée Vite (charge src/main.js)
public/theme-init.js  script classique : thème et taille du texte avant le premier rendu
public/assets/        fichiers statiques : favicon
src/
  main.js             démarre l'application dans #root
  types.d.ts          modèle de données, schéma version 2 (et types de la version 1)
  styles/             covenant.css (thème) et app.css
  core/               logique métier PURE
  adapters/           tout ce qui touche au navigateur
    store.js          createStore()
    idb.js            IndexedDB : migrations et accès, sur @simple-web-tools/storage
    fallback.js       import unique de l'ancien repli localStorage vers IndexedDB
    legacy-databases.js copie des bases dont l'id de la version 1 est refusé par le registre
    names.js          noms de stockage propres à Chrono (préfixés, décision 0005)
    workspace-list.js registre des espaces, reprise de l'ancienne liste
    workspaces.js     API des espaces (WORKSPACES), import JSON, téléchargement
    backup.js         export et import : enveloppe du paquet, fichiers de la version 1
    ids.js            générateur d'identifiants
    dom/              vues et primitives d'interface
tests/
  unit/               Vitest
  e2e/                Playwright
```

### `src/core` : logique pure

Aucun DOM, aucun `window`, aucun stockage, aucune lecture de l'horloge ni de `Math.random()`
(décision 0004). L'heure (`now`) et les identifiants des nouveaux enregistrements sont passés en
arguments. Les règles ont la forme `(data, payload, now[, newId])` et renvoient de **nouvelles**
données (`{ projects, todos, sessions, attendance }`) sans modifier l'entrée ; les enregistrements
inchangés gardent leur référence, ce qui permet l'écriture différentielle. Quand une règle ne change
rien, elle renvoie l'objet reçu tel quel.

| Fichier                   | Contenu                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `dates.js`                | `startOfDay`, `formatLocalDate` (date locale, jamais `toISOString()`), `formatDuration`.                           |
| `presence.js`             | `liveDuration`, `presenceRanges`, `presenceDuration`.                                                              |
| `sessions.js`             | `startSession`, pause, reprise, arrêt (un chrono ou tous), `truncateToPresence`, `updateSession`, saisie manuelle. |
| `attendance.js`           | `attendanceState` et `recordAttendance` (arrivée, pause, départ et leur effet sur les chronos).                    |
| `todos.js`, `projects.js` | Ajout, édition, suppression, archivage.                                                                            |
| `due-dates.js`            | Échéances `AAAA-MM-JJ`, catégories (`bucket`), migration des anciennes étiquettes relatives.                       |
| `seed.js`                 | Données de démonstration et données vides.                                                                         |
| `migrations.js`           | Conversion version 1 vers version 2 (`v1ToV2` et conversions d'enregistrements), pure.                             |
| `import-export.js`        | Validation de l'import, reconnaissance et mise en enveloppe des fichiers de la version 1.                          |
| `report.js`               | Agrégation du rapport hebdomadaire et texte CSV.                                                                   |

### `src/adapters` : navigateur

`createStore()` (`store.js`) détient l'état (`projects`, `todos`, `sessions`, `attendance`) et expose
des `actions`. Chaque action appelle une règle de `core` avec l'heure courante et un identifiant
neuf, adopte les données renvoyées puis notifie les écouteurs (`store.onState`). Un minuteur d'une
seconde notifie en plus `store.onTick`, utilisé pour les durées des chronos en cours, y compris
dans un onglet en lecture seule. Les écritures en base sont regroupées et différées de quelques
dizaines de millisecondes. Le store prend le verrou d'écriture au démarrage (`state.readOnly` est
vrai sans lui), annonce ses écritures sur le `BroadcastChannel` de l'espace (`chrono-sync-<id>`) ;
un onglet en lecture seule refuse les actions (`store.onRefused`), relit la base à chaque annonce
et prend le verrou quand l'autre onglet se ferme. Les données de démonstration ne sont chargées
que par `actions.loadDemoData()`, dans un espace vide.

Les vues (`adapters/dom/`) s'abonnent au store et **re-rendent entièrement** leur contenu à chaque
notification ; il n'y a ni diff ni état local persistant. `lib.js` et `ui.js` fournissent les
aides DOM et les primitives (Button, Input, Select, Badge, Kbd, Modal, Toast) ; `App.js` assemble la
barre latérale, la navigation et les raccourcis clavier.

Aucune variable globale n'est partagée entre modules : tout passe par `import` / `export`.

L'interface vient du paquet `@simple-web-tools/covenant` (dépendance d'exécution, comme
`storage` et `dates` : tokens, CSS des composants, comportements, polices IBM Plex et icônes
Phosphor, tout est embarqué par Vite, aucune requête externe). `src/styles/app.css` ne contient
que la mise en page et les rôles sémantiques ; les vues construisent le balisage des composants
(`src/adapters/dom/ui.js`). `public/theme-init.js` lit `chrono-theme` (`light` ou `dark`, sinon
`prefers-color-scheme`) et `chrono-text-size` (`standard`, `comfortable`, `large`).

## Lancer en local

Depuis la racine du dépôt (un seul `package-lock.json` pour tous les workspaces) :

```sh
npm install
npm run dev -w chrono        # serveur de développement Vite
npm run build -w chrono      # production, dans apps/chrono/dist
npm run preview -w chrono    # sert dist sur http://127.0.0.1:4174
```

## Tests

```sh
npm test -w chrono                   # Vitest (tests/unit)
npm run typecheck -w chrono          # tsc strict sur src (vues comprises) et tests/unit
npm run lint -w chrono && npm run format:check -w chrono
npm run test:e2e -w chrono           # construit l'application, puis Playwright (tests/e2e) contre `vite preview`
npm run verify                       # depuis la racine : typecheck, lint, format, tests, build
```

- **Unitaires (Vitest)** : `src/core` est testé sans DOM ni stockage, l'heure étant passée en
  argument (pas de faux minuteurs). Les adapters de stockage sont testés avec
  `@simple-web-tools/test-utils/fake-indexeddb` et de petits faux (`tests/unit/support/`) pour
  `localStorage`, `BroadcastChannel` et les événements de fenêtre. Les migrations sont testées
  sur des bases écrites avec l'API IndexedDB brute, comme la version 1 les créait
  (`tests/unit/support/idb.js`), et l'import sur un export réel de la version 1
  (`tests/unit/fixtures/chrono-v1-export.json`). Les tests sensibles aux dates
  se lancent aussi avec `TZ=UTC`, `TZ=Europe/Paris`, `TZ=America/New_York` et
  `TZ=Pacific/Auckland`.
- **Bout en bout (Playwright)** : parcours en boîte noire à travers l'interface (démarrage,
  chrono, saisie manuelle, todos, projets, rapport et CSV, espaces, export et import JSON,
  persistance, reprise des données de la version 1, deux onglets dans le même contexte :
  lecture seule, relecture, reprise du verrou ; IndexedDB indisponible ou bloqué ; import du
  repli). Toute requête qui n'est pas pour `127.0.0.1` est bloquée, et un test vérifie
  qu'aucune n'est émise. Pas encore d'assertions axe : l'interface actuelle ne les passe pas, elles
  arriveront avec le portage sur Covenant.
- Le typecheck couvre tout `src` (vues comprises), `src/types.d.ts` et `tests/unit`.

## Déploiement

Chrono fait partie du monorepo Simple Web Tools. La CI GitHub Actions du dépôt lance
`npm run verify` et les tests Playwright sur chaque pull request ; la branche `main` est
publiée sur GitHub Pages (`npm run site`, qui copie `dist/` dans `_site/chrono/`).

## Raccourcis clavier

Actifs hors champ de saisie et hors modale ouverte, sans Ctrl, Alt ni Meta.

| Touche   | Action                                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Espace` | Si aucun chrono n'est actif : ouvre « nouveau chrono ». Sinon met tout en pause, ou reprend tout si tout est en pause. |
| `N`      | Nouveau chrono.                                                                                                        |
| `S`      | Arrête tous les chronos actifs.                                                                                        |
| `Échap`  | Ferme la modale ouverte.                                                                                               |
