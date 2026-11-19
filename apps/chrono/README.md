# Chrono

Application de suivi du temps en JavaScript vanilla (modules ES, Vite) : pas de framework à
l'exécution, aucune dépendance d'exécution.

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

- Chaque espace possède sa propre base IndexedDB (`chrono__<id>`).
- Si IndexedDB est indisponible ou ne s'ouvre pas, les données sont écrites en
  repli dans `localStorage` (`chrono.fallback.<id>.v1`).
- La liste des espaces et l'espace actif sont dans `localStorage`.
- Changer d'espace ou importer un JSON recharge la page.

Vider les données du site dans le navigateur efface donc les données de Chrono :
pensez à l'export JSON pour sauvegarder.

## Architecture

Application [Vite](https://vite.dev/) en modules ES, sans framework à l'exécution
([décision 0003](../../docs/decisions/0003-no-runtime-framework.md)). Le code suit l'architecture
de référence ([décision 0004](../../docs/decisions/0004-reference-architecture.md)) :

```text
index.html            point d'entrée Vite (charge src/main.js)
public/assets/        fichiers statiques : favicon, icônes Phosphor
src/
  main.js             démarre l'application dans #root
  types.d.ts          modèle de données (types JSDoc)
  styles/             covenant.css (thème) et app.css
  core/               logique métier PURE
  adapters/           tout ce qui touche au navigateur
    store.js          createStore()
    idb.js            IndexedDB
    fallback.js       repli localStorage
    workspace-list.js liste et espace actif, noms de stockage
    workspaces.js     API des espaces (WORKSPACES), import JSON, téléchargement
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
données (`{ projets, todos, sessions, pointage }`) sans modifier l'entrée ; les enregistrements
inchangés gardent leur référence, ce qui permet l'écriture différentielle. Quand une règle ne change
rien, elle renvoie l'objet reçu tel quel.

| Fichier                  | Contenu                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `dates.js`               | `startOfDay`, `fmtDateISO` (date locale, jamais `toISOString()`), `fmtDuree`.                                   |
| `presence.js`            | `dureeVivante`, `plagesPresence`, `dureePresence`.                                                              |
| `sessions.js`            | Démarrer, pauser, reprendre, arrêter (un chrono ou tous), `tronquerSurPresence`, `majSession`, saisie manuelle. |
| `pointage.js`            | `etatPointage` et `pointer` (arrivée, pause, départ et leur effet sur les chronos).                             |
| `todos.js`, `projets.js` | Ajout, édition, suppression, archivage.                                                                         |
| `echeances.js`           | Échéances `AAAA-MM-JJ`, catégories (`bucket`), migration des anciennes étiquettes relatives.                    |
| `seed.js`                | Données de démonstration et données vides.                                                                      |
| `import-export.js`       | Charge utile de l'export JSON (`version: 1`) et validation de l'import.                                         |
| `report.js`              | Agrégation du rapport hebdomadaire et texte CSV.                                                                |
| `workspaces.js`          | `slugify`, `uniqueId`, liste par défaut des espaces.                                                            |

### `src/adapters` : navigateur

`createStore()` (`store.js`) détient l'état (`projets`, `todos`, `sessions`, `pointage`) et expose
des `actions`. Chaque action appelle une règle de `core` avec l'heure courante et un identifiant
neuf, adopte les données renvoyées puis notifie les écouteurs (`store.onState`). Un minuteur d'une
seconde notifie en plus `store.onTick`, utilisé pour les durées des chronos en cours. Les écritures
en base sont regroupées et différées de quelques dizaines de millisecondes ; le store possède aussi
le `BroadcastChannel` du workspace (plusieurs onglets peuvent écrire, chacun relit tout quand un
autre a écrit).

Les vues (`adapters/dom/`) s'abonnent au store et **re-rendent entièrement** leur contenu à chaque
notification ; il n'y a ni diff ni état local persistant. `lib.js` et `ui.js` fournissent les
aides DOM et les primitives (Button, Input, Select, Badge, Kbd, Modal, Toast) ; `App.js` assemble la
barre latérale, la navigation et les raccourcis clavier.

Aucune variable globale n'est partagée entre modules : tout passe par `import` / `export`.

Les icônes [Phosphor](https://phosphoricons.com/) (version 2.1.1, licence MIT) sont servies depuis
`public/assets/vendor/phosphor/` (graisses regular, fill et bold). Le thème visuel est
`src/styles/covenant.css`.

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
npm run typecheck -w chrono          # tsc strict sur src/core et tests/unit
npm run lint -w chrono && npm run format:check -w chrono
npm run test:e2e -w chrono           # Playwright (tests/e2e), contre `vite preview`
npm run verify                       # depuis la racine : typecheck, lint, format, tests, build
```

- **Unitaires (Vitest)** : `src/core` est testé sans DOM ni stockage, l'heure étant passée en
  argument (pas de faux minuteurs). Les adapters de stockage sont testés avec
  `@simple-web-tools/test-utils/fake-indexeddb` et de petits faux (`tests/unit/support/`) pour
  `localStorage`, `BroadcastChannel` et les événements de fenêtre. Les tests sensibles aux dates
  se lancent aussi avec `TZ=UTC`, `TZ=Europe/Paris`, `TZ=America/New_York` et
  `TZ=Pacific/Auckland`.
- **Bout en bout (Playwright)** : parcours en boîte noire à travers l'interface (démarrage,
  chrono, saisie manuelle, todos, projets, rapport et CSV, espaces, export et import JSON,
  persistance). Toute requête qui n'est pas pour `127.0.0.1` est bloquée : Google Fonts n'est donc
  jamais atteint. Pas encore d'assertions axe : l'interface actuelle ne les passe pas, elles
  arriveront avec le portage sur Covenant.
- Le typecheck ne couvre pour l'instant que `src/core`, `src/types.d.ts` et `tests/unit` ; les
  adapters le rejoindront au prochain pas.

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
