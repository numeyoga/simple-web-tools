# Plan d’implémentation — Lot 2 : Tableau blanc (Option A — Canevas SVG natif)

Ce plan détaille l’ajout de la fonctionnalité **Tableau blanc** dans **Locavern** (passage à la version applicative `0.2.0` et `schemaVersion: 2`), destiné à être implémenté étape par étape par **Hydrogen**.

---

## 1. Décisions d’architecture actées

1. **Moteur graphique (Option A)** :
   - **Canevas SVG interactif natif + Pointer Events + raccourcis clavier**, encapsulé dans un adaptateur dédié `src/adapters/whiteboard-canvas.js`, **sans aucune dépendance runtime supplémentaire**.
   - Styling 100 % intégré au **Covenant Design System** (`var(--cv-*)`, thèmes clair et sombre automatiques, polices locales IBM Plex).
2. **Périmètre des outils** :
   - Outils d’édition : **Sélection / Déplacement (`select`)**, **Post-it (`sticky`)**, **Rectangle (`rect`)**, **Ellipse (`ellipse`)**, **Flèche (`arrow`)**, **Texte (`text`)**, **Tracé libre (`path`)**, **Image locale (`image`)**.
   - Historique local d’édition : **Annuler (`Ctrl+Z`) / Rétablir (`Ctrl+Y` ou `Ctrl+Shift+Z`)**.
   - Navigation canevas : **Zoom (`-`, `100 %`, `+`, molette avec `Ctrl`)** et **Panoramique (glisser sur le fond ou outil/boutons)**.
   - Export direct du tableau blanc actif : **Export `.svg`** et **Export `.png`** (via `<canvas>` local, en convertissant les `blob:` d’images locales en `data:` URL ou `drawImage` uniquement au moment du rendu PNG/SVG exporté, sans jamais émettre de requête externe).
3. **Organisation métier identique aux Notes** :
   - Plusieurs tableaux blancs autonomes possibles.
   - Chaque tableau blanc possède un titre, un rattachement optionnel à un projet (`projectId: string | null`), un `viewport` (`panX`, `panY`, `zoom`), une liste d’éléments (`elements`), et une liste d’identifiants d’images locales (`assetIds` extraits automatiquement des éléments de type `'image'`).
   - La suppression d’un projet ne supprime pas ses tableaux blancs : elle détache leur `projectId` à `null` (exactement comme pour `notes`).

---

## 2. Arborescence des fichiers créés ou modifiés

```text
locavern/
├── index.html                                    # [MODIFIÉ] Lien nav #whiteboards + commandes Ctrl+K
├── package.json                                  # [MODIFIÉ] Version "0.2.0" + description mise à jour
├── src/
│   ├── types.d.ts                                # [MODIFIÉ] Types Whiteboard*, schemaVersion: 1 | 2, commandes & effets
│   ├── main.js                                   # [MODIFIÉ] Routage vue 'whiteboards', commandes, version '0.2.0'
│   ├── core/
│   │   ├── model.js                              # [MODIFIÉ] createWhiteboard, sanitizeWhiteboardElements, collectWhiteboardAssetIds
│   │   ├── schema.js                             # [MODIFIÉ] CURRENT_SCHEMA_VERSION = 2, migration v1 -> v2, parseWhiteboard
│   │   ├── store.js                              # [MODIFIÉ] État whiteboards, reducer, selectWhiteboards, selectReferencedAssetIds
│   │   └── backup.js                             # [MODIFIÉ] Inclusion de whiteboards dans BackupData et BackupManifest.counts
│   ├── adapters/
│   │   ├── storage-idb.js                        # [MODIFIÉ] DB_VERSION = 2, objectStore 'whiteboards', effets IndexedDB
│   │   ├── whiteboard-canvas.js                  # [NOUVEAU] Adaptateur SVG interactif, barre d’outils, clavier, export SVG/PNG
│   │   └── dom/
│   │       ├── app-shell.js                      # [MODIFIÉ] Titre de vue whiteboards: 'Tableaux blancs'
│   │       ├── backup-modal.js                   # [MODIFIÉ] Compteur 'Tableaux blancs' dans les statistiques et messages d’export/import
│   │       └── whiteboard-view.js                # [NOUVEAU] Vue complète Tableaux blancs (liste latérale, filtres, métadonnées, canevas)
│   └── styles/
│       └── app.css                               # [MODIFIÉ] Styles .lc-whiteboard-* avec tokens Covenant --cv-*
├── tests/
│   ├── unit/
│   │   ├── model.test.js                         # [MODIFIÉ] Tests unitaires createWhiteboard et sanitisation des éléments
│   │   ├── schema.test.js                        # [MODIFIÉ] Tests unitaires migration v1 -> v2 et validation v2
│   │   ├── store.test.js                         # [MODIFIÉ] Tests unitaires CRUD whiteboard, détachement projet, assetIds
│   │   └── backup.test.js                        # [MODIFIÉ] Tests unitaires archive incluant whiteboards
│   └── e2e/
│       └── whiteboard.spec.js                    # [NOUVEAU] Tests Playwright + axe-core (création, outils, clavier, image, reload, thème)
└── docs/                                         # [MODIFIÉ] Mise à jour Diátaxis (guide tableau blanc, référence, avancement)
```

---

## 3. Découpage en 5 étapes séquentielles

### Étape 1 — Contrats de types (`.d.ts`) et cœur fonctionnel pur (`src/core/`)

**Objectif** : Étendre le modèle pur, le store immuable, le schéma de sauvegarde (`schemaVersion: 2` avec migration transparente depuis `v1`) et les tests unitaires Vitest.

1. **Dans [`src/types.d.ts`](file:///var/home/nemo/codex/locavern/src/types.d.ts)** :
   - Étendre `ActiveView` : `'tasks' | 'projects' | 'notes' | 'whiteboards'`.
   - Ajouter les types du schéma pivot :
     ```ts
     export type WhiteboardElementType =
       'sticky' | 'rect' | 'ellipse' | 'arrow' | 'text' | 'path' | 'image';

     export type WhiteboardColorToken = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

     export interface WhiteboardElement {
       readonly id: string;
       readonly type: WhiteboardElementType;
       readonly x: number;
       readonly y: number;
       readonly width: number;
       readonly height: number;
       readonly text?: string;
       readonly color: WhiteboardColorToken;
       readonly points?: readonly (readonly [number, number])[];
       readonly assetId?: string;
       readonly zIndex: number;
     }

     export interface WhiteboardViewport {
       readonly panX: number;
       readonly panY: number;
       readonly zoom: number;
     }

     export interface Whiteboard {
       readonly id: string;
       readonly projectId: string | null;
       readonly title: string;
       readonly viewport: WhiteboardViewport;
       readonly elements: readonly WhiteboardElement[];
       readonly assetIds: readonly string[];
       readonly createdAt: string;
       readonly updatedAt: string;
     }
     ```
   - Ajouter `readonly selectedWhiteboardId: string | null;` dans `AppPreferences`.
   - Ajouter `readonly whiteboards: readonly Whiteboard[];` dans `AppState`, `HydratePayload` (optionnel ou avec valeur par défaut `[]`), `BackupData` et `replace_all` / `persist_replace_all`.
   - Mettre `readonly schemaVersion: 2;` sur `AppState`, `BackupData` et `BackupManifest` (et `readonly whiteboards: number;` dans `BackupManifest['counts']`).
   - Ajouter dans `AppCommand` :
     - `{ readonly type: 'select_whiteboard'; readonly whiteboardId: string | null }`
     - `{ readonly type: 'create_whiteboard'; readonly id: string; readonly projectId: string | null; readonly title: string; readonly viewport?: WhiteboardViewport; readonly elements?: readonly WhiteboardElement[]; readonly assetIds?: readonly string[]; readonly now: string }`
     - `{ readonly type: 'update_whiteboard'; readonly id: string; readonly patch: { readonly projectId?: string | null; readonly title?: string; readonly viewport?: WhiteboardViewport; readonly elements?: readonly WhiteboardElement[]; readonly assetIds?: readonly string[] }; readonly now: string }`
     - `{ readonly type: 'delete_whiteboard'; readonly id: string }`
   - Ajouter dans `StoreEffect` :
     - `{ readonly type: 'persist_whiteboard'; readonly whiteboard: Whiteboard }`
     - `{ readonly type: 'remove_whiteboard'; readonly id: string }`
     - Étendre `remove_project` avec `readonly updatedWhiteboards: readonly Whiteboard[];`.

2. **Dans [`src/core/model.js`](file:///var/home/nemo/codex/locavern/src/core/model.js)** :
   - Exporter `WHITEBOARD_ELEMENT_TYPES`, `WHITEBOARD_COLORS` (`['neutral', 'accent', 'success', 'warning', 'danger']`), et `DEFAULT_WHITEBOARD_VIEWPORT` (`Object.freeze({ panX: 0, panY: 0, zoom: 1 })`).
   - Implémenter `sanitizeWhiteboardViewport(raw)` : garantit `panX`, `panY` finis (`[-10000, 10000]`) et `zoom` borné dans `[0.25, 3]`.
   - Implémenter `sanitizeWhiteboardElements(rawElements)` :
     - Valide chaque élément : `id` non vide, `type` dans `WHITEBOARD_ELEMENT_TYPES`, `x`/`y` finis, `width`/`height` bornés (`[16, 4000]`, ou `>= 0` pour `arrow`/`path`), `color` dans `WHITEBOARD_COLORS` (défaut `'neutral'`), `text` tronqué à `500` caractères, `points` nettoyés (paires `[number, number]` finies, max `2000` points par tracé).
     - Pour `type === 'image'`, exige un `assetId` local non vide (rejette tout élément image sans `assetId` ou contenant une URL distante).
   - Implémenter `collectWhiteboardAssetIds(elements)` : extrait tous les `assetId` uniques des éléments `type === 'image'`.
   - Implémenter `createWhiteboard({ id, projectId, title, viewport, elements, assetIds, now })`.

3. **Dans [`src/core/schema.js`](file:///var/home/nemo/codex/locavern/src/core/schema.js)** :
   - Passer `export const CURRENT_SCHEMA_VERSION = 2;`.
   - Implémenter `parseWhiteboard(raw)` en réutilisant `sanitizeWhiteboardViewport`, `sanitizeWhiteboardElements` et `collectWhiteboardAssetIds`.
   - Dans `migrateBackupData(raw)` :
     - Si `raw.schemaVersion === 1`, cloner l’objet avec `schemaVersion: 2` et `whiteboards: Array.isArray(raw.whiteboards) ? raw.whiteboards : []`, puis appeler `validateBackupData`.
   - Dans `validateBackupData(raw)` :
     - Vérifier `Array.isArray(raw.whiteboards)`, inclure `raw.whiteboards.length` dans `totalCount <= MAX_IMPORT_RECORDS`, et vérifier l’unicité des `id` ainsi que l’existence de `w.projectId` dans `projectIds` lorsque non `null`.

4. **Dans [`src/core/store.js`](file:///var/home/nemo/codex/locavern/src/core/store.js)** et **[`src/core/backup.js`](file:///var/home/nemo/codex/locavern/src/core/backup.js)** :
   - Gérer `whiteboards` dans `createInitialState`, `hydrate`, `select_whiteboard`, `create_whiteboard`, `update_whiteboard`, `delete_whiteboard`, `delete_project` (détachement `projectId: null`), `replace_all`.
   - Exporter `selectWhiteboards(state, filters = {})` (filtrage par `projectId` et `query`, tri par `updatedAt` décroissant).
   - Mettre à jour `selectReferencedAssetIds(state)` pour parcourir aussi `state.whiteboards`.
   - Mettre à jour `buildBackupPayload` dans [`src/core/backup.js`](file:///var/home/nemo/codex/locavern/src/core/backup.js) pour inclure `whiteboards` dans `data` et `manifest.counts`.

5. **Validation Étape 1** :
   - `npm run typecheck` et `npm test` (tous les tests unitaires Vitest passent, y compris la migration d’un payload `v1` et la validation d’un payload `v2`).

---

### Étape 2 — Stockage IndexedDB (`DB_VERSION = 2`)

**Objectif** : Persister la collection `whiteboards` dans IndexedDB sans casser les bases locales existantes en version 1.

1. **Dans [`src/adapters/storage-idb.js`](file:///var/home/nemo/codex/locavern/src/adapters/storage-idb.js)** :
   - Passer `const DB_VERSION = 2;`.
   - Dans `upgrade(db)` :
     ```js
     if (!db.objectStoreNames.contains('whiteboards')) {
       db.createObjectStore('whiteboards', { keyPath: 'id' });
     }
     ```
   - Dans `loadHydrationPayload(db)` :
     - Ouvrir la transaction sur `['meta', 'projects', 'tasks', 'notes', 'whiteboards', 'assets']`.
     - Retourner `whiteboards` dans le `HydratePayload`.
   - Dans `replaceAllWithBlobs(db, payload, blobs)` :
     - Vider et remplir aussi `tx.objectStore('whiteboards')`, et enregistrer `schemaVersion: 2` dans `meta`.
   - Dans `applyStoreEffects(db, effects)` :
     - Gérer `persist_whiteboard` (`await db.put('whiteboards', effect.whiteboard)`).
     - Gérer `remove_whiteboard` (`await db.delete('whiteboards', effect.id)`).
     - Dans `remove_project` : inclure `'whiteboards'` dans la transaction et mettre à jour `effect.updatedWhiteboards`.

2. **Validation Étape 2** :
   - `npm run typecheck` et `npm test`.

---

### Étape 3 — Adaptateur Canevas SVG (`src/adapters/whiteboard-canvas.js`)

**Objectif** : Implémenter le moteur de tableau blanc interactif en SVG natif, conforme à Covenant et accessible au clavier et à la souris.

1. **Contrat de `mountWhiteboardCanvas(opts)` dans `src/adapters/whiteboard-canvas.js`** :
   - Paramètres :
     - `container: HTMLElement`
     - `initialViewport: WhiteboardViewport`
     - `initialElements: readonly WhiteboardElement[]`
     - `editable: boolean`
     - `ariaLabel: string`
     - `resolveAssetUrl: (assetId: string) => Promise<string | null>`
     - `onUploadImage: (file: File) => Promise<{ assetId: string; alt: string } | null>`
     - `onBlockedRemoteImage?: () => void`
     - `onChange: (next: { viewport: WhiteboardViewport; elements: WhiteboardElement[] }) => void`
   - Retour :
     - `getSnapshot(): { viewport: WhiteboardViewport; elements: WhiteboardElement[] }`
     - `exportSvgBlob(): Promise<Blob>`
     - `exportPngBlob(): Promise<Blob>`
     - `destroy(): void`

2. **Barre d’outils Covenant (`.lc-wb-toolbar`, `role="toolbar"`, `aria-label="Outils du tableau blanc"`)** :
   - Boutons d’outils avec `aria-pressed="true|false"` :
     - `Sélectionner` (`data-wb-tool="select"`, icône `ph-cursor`)
     - `Post-it` (`data-wb-tool="sticky"`, icône `ph-note`)
     - `Rectangle` (`data-wb-tool="rect"`, icône `ph-rectangle`)
     - `Ellipse` (`data-wb-tool="ellipse"`, icône `ph-circle`)
     - `Flèche` (`data-wb-tool="arrow"`, icône `ph-arrow-up-right`)
     - `Texte` (`data-wb-tool="text"`, icône `ph-text-t`)
     - `Tracé libre` (`data-wb-tool="path"`, icône `ph-pencil-simple`)
     - `Image locale` (`data-wb-action="insert-image"`, icône `ph-image`, ouvre un `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif">`)
   - Sélecteur de couleur (`neutral`, `accent`, `success`, `warning`, `danger`) mappé sur les tokens sémantiques Covenant.
   - Actions sur la sélection :
     - `Modifier le texte` (`data-wb-action="edit-text"`)
     - `Supprimer l’élément` (`data-wb-action="delete-selected"`)
   - Historique :
     - `Annuler` (`data-wb-action="undo"`, `Ctrl+Z`)
     - `Rétablir` (`data-wb-action="redo"`, `Ctrl+Y` / `Ctrl+Shift+Z`)
   - Contrôles de zoom :
     - `Zoom -` (`data-wb-action="zoom-out"`), `100 %` (`data-wb-action="zoom-reset"`), `Zoom +` (`data-wb-action="zoom-in"`).

3. **Interactions Souris / Stylet ET Accessibilité Clavier (WCAG 2.2 AA)** :
   - **Création sans glisser-déposer obligatoire** :
     - Cliquer sur le canevas avec un outil de forme (`sticky`, `rect`, `ellipse`, `arrow`, `text`) crée l’élément aux coordonnées cliquées (ou glisser pour dimensionner).
     - Double-cliquer ou activer un bouton « Ajouter au centre » / appuyer sur `Entrée` depuis l’outil permet d’insérer un élément au centre du viewport uniquement au clavier.
   - **Navigation et manipulation clavier sur le SVG** :
     - Chaque élément SVG `<g class="lc-wb-el" tabindex="0" role="group" aria-label="...">` peut recevoir le focus clavier.
     - `Flèches directionnelles` : déplacent l’élément sélectionné de `10` unités (`1` unité avec `Shift`).
     - `Alt + Flèches` : redimensionnent l’élément sélectionné (`width` / `height` ± `10`).
     - `Entrée` ou `F2` sur un élément sélectionné (`sticky`, `rect`, `ellipse`, `text`) : ouvre un champ d’édition accessible permettant de saisir/modifier son texte.
     - `Delete` / `Backspace` : supprime l’élément sélectionné.
   - **Protection des images** :
     - Écouteur `paste` sur le conteneur : si le presse-papiers contient un fichier image local, l’enregistre via `onUploadImage` et crée un élément `'image'` ; s’il contient une URL d’image distante (`<img src="https://...">`), bloque l’insertion et appelle `onBlockedRemoteImage()`.

---

### Étape 4 — Vue Tableaux blancs (`src/adapters/dom/whiteboard-view.js`) et intégration Shell

**Objectif** : Intégrer la vue complète des tableaux blancs dans l’AppShell Covenant, la palette de commandes (`Ctrl+K`) et la modale de sauvegarde.

1. **Créer `src/adapters/dom/whiteboard-view.js`** (sur le modèle de [`src/adapters/dom/notes-view.js`](file:///var/home/nemo/codex/locavern/src/adapters/dom/notes-view.js)) :
   - En-tête de vue :
     - Filtre par projet (`#whiteboards-project-filter`, `aria-label="Filtrer les tableaux blancs par projet"`).
     - Recherche (`#whiteboards-search-input`, `aria-label="Rechercher un tableau blanc"`).
     - Bouton primaire `#btn-new-whiteboard` (`Nouveau tableau blanc`).
   - État vide `.cv-empty` lorsqu’aucun tableau blanc n’existe (« Aucun tableau blanc disponible », bouton « Créer un tableau blanc »).
   - Disposition `.lc-notes-layout` :
     - Colonne gauche : liste des tableaux blancs (`role="navigation"`, `aria-label="Liste des tableaux blancs"`), indiquant le titre, le projet associé et la date de mise à jour.
     - Colonne droite (`<section class="cv-card" aria-label="Éditeur de tableau blanc">`) :
       - Champ `#whiteboard-title-input` (`Titre du tableau blanc`) et sélecteur `#whiteboard-project-select` (`Projet associé`).
       - Hôte du canevas SVG (`mountWhiteboardCanvas`).
       - Pied de carte avec statut d’enregistrement (`#whiteboard-save-status`), boutons `#btn-export-wb-svg` (`Exporter SVG`), `#btn-export-wb-png` (`Exporter PNG`), `#btn-delete-whiteboard` (`Supprimer` avec modale de confirmation Covenant) et `#btn-save-whiteboard` (`Enregistrer`).

2. **Mettre à jour [`index.html`](file:///var/home/nemo/codex/locavern/index.html), [`src/adapters/dom/app-shell.js`](file:///var/home/nemo/codex/locavern/src/adapters/dom/app-shell.js), [`src/adapters/dom/backup-modal.js`](file:///var/home/nemo/codex/locavern/src/adapters/dom/backup-modal.js) et [`src/main.js`](file:///var/home/nemo/codex/locavern/src/main.js)** :
   - Dans [`index.html`](file:///var/home/nemo/codex/locavern/index.html) :
     - Ajouter l’entrée de barre latérale `<li><a class="cv-nav-item" href="#whiteboards" data-nav-view="whiteboards"><i class="ph ph-chalkboard-simple cv-icon" aria-hidden="true"></i><span>Tableaux blancs</span></a></li>`.
     - Ajouter dans `#cmd-list` (`Ctrl+K`) :
       - `data-value="view:whiteboards"` : `Aller aux tableaux blancs`
       - `data-value="action:new-whiteboard"` : `Créer un tableau blanc`
   - Dans [`src/adapters/dom/app-shell.js`](file:///var/home/nemo/codex/locavern/src/adapters/dom/app-shell.js) :
     - Ajouter `whiteboards: 'Tableaux blancs'` dans `VIEW_TITLES`.
   - Dans [`src/adapters/dom/backup-modal.js`](file:///var/home/nemo/codex/locavern/src/adapters/dom/backup-modal.js) :
     - Ajouter `['Tableaux blancs', String(state.whiteboards.length)]` dans les statistiques du stockage local et mettre à jour les textes de confirmation d’import/export.
   - Dans [`src/main.js`](file:///var/home/nemo/codex/locavern/src/main.js) :
     - Passer `APP_VERSION = '0.2.0'`.
     - Gérer `whiteboardViewHandle` (avec `flushAndDestroy()`) exactement comme `notesViewHandle`.
     - Router `activeView === 'whiteboards'`, `view:whiteboards` et `action:new-whiteboard`.
     - Éviter le re-rendu complet de la vue lors de `command.type === 'update_whiteboard'` quand `activeView === 'whiteboards'` pour préserver le focus et l’interaction en cours sur le canevas.

3. **Ajouter les styles dans [`src/styles/app.css`](file:///var/home/nemo/codex/locavern/src/styles/app.css)** :
   - `.lc-wb-container`, `.lc-wb-toolbar`, `.lc-wb-stage`, `.lc-wb-svg`, `.lc-wb-el`, `.lc-wb-el[data-selected="true"]`, `.lc-wb-text-editor` utilisant uniquement les variables `--cv-*` de Covenant.

---

### Étape 5 — Tests Playwright + axe-core et Documentation Diátaxis

**Objectif** : Vérifier de bout en bout le tableau blanc (fonctionnel, persistance, accessibilité WCAG 2.2 AA, zéro requête réseau) et aligner toute la documentation Diátaxis.

1. **Créer `tests/e2e/whiteboard.spec.js`** :
   - Création d’un tableau blanc, renommage, ajout d’un post-it (avec saisie de texte), d’un rectangle et d’une image locale (`tests/e2e/fixtures/tiny.png`).
   - Sélection et déplacement d’un élément au clavier (`ArrowRight` / `ArrowDown`), vérification de la mise à jour des coordonnées.
   - Rechargement de la page (`page.reload()`) : vérification que le tableau blanc, ses formes, son texte et son image locale sont restaurés depuis IndexedDB.
   - Collage d’un HTML contenant `<img src="https://evil.example/remote.png">` sur le tableau blanc : vérification qu’aucune requête externe n’est émise et que l’alerte « Image distante bloquée » est affichée.
   - Contrôle `@axe-core/playwright` (`wcag2a`, `wcag2aa`, `wcag22aa`) sur la vue Tableaux blancs en thème clair et en thème sombre.

2. **Mettre à jour la documentation selon le skill `diataxis-documentation`** :
   - Créer le guide pratique `docs/how-to/utiliser-le-tableau-blanc.md` (créer un tableau blanc, utiliser les outils à la souris et au clavier, insérer une image locale, exporter en SVG/PNG).
   - Mettre à jour [`docs/index.md`](file:///var/home/nemo/codex/locavern/docs/index.md), [`README.md`](file:///var/home/nemo/codex/locavern/README.md), [`docs/tutorials/premier-espace-de-travail.md`](file:///var/home/nemo/codex/locavern/docs/tutorials/premier-espace-de-travail.md), [`docs/reference/interface-et-raccourcis.md`](file:///var/home/nemo/codex/locavern/docs/reference/interface-et-raccourcis.md), [`docs/reference/stockage-limites-et-erreurs.md`](file:///var/home/nemo/codex/locavern/docs/reference/stockage-limites-et-erreurs.md), [`docs/reference/etat-du-depot.md`](file:///var/home/nemo/codex/locavern/docs/reference/etat-du-depot.md), [`docs/reference/decisions-et-avancement.md`](file:///var/home/nemo/codex/locavern/docs/reference/decisions-et-avancement.md) (passer le Tableau blanc au statut **« Vérifié »** et documenter `schemaVersion: 2`) et [`docs/explanation/choix-architecture.md`](file:///var/home/nemo/codex/locavern/docs/explanation/choix-architecture.md).

3. **Validation finale de bout en bout** :
   - `npm run typecheck`
   - `npm run lint`
   - `npm run format:check`
   - `npm test`
   - `npm run build`
   - `npm run test:e2e`
