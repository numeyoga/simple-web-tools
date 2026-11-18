---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-16
---

# Décisions et avancement

Registre issu de la [restitution du 12 novembre 2026](../../choix-technique.md) et des arbitrages d’architecture du 13 novembre 2026, mis à jour le 16 novembre 2026 après livraison du Lot 2 (`0.2.0`), du pipeline GitHub Pages et des évolutions fonctionnelles (agenda différencié week-end / `18h–7h` / horaire, statuts initiaux/terminaux et archivage transversal), et confronté à l’[état local du dépôt](etat-du-depot.md).

## Sommaire

- [Statuts](#statuts)
- [Produit et contraintes](#produit-et-contraintes)
- [Périmètre livré](#périmètre-livré)
- [Stack et outils](#stack-et-outils)
- [Architecture et conventions](#architecture-et-conventions)
- [Texte enrichi et export Markdown](#texte-enrichi-et-export-markdown)
- [Stockage, corbeille et sauvegardes](#stockage-corbeille-et-sauvegardes)
- [Confidentialité et sécurité](#confidentialité-et-sécurité)
- [Styles et design system](#styles-et-design-system)
- [Tableau blanc](#tableau-blanc)
- [Qualité et documentation](#qualité-et-documentation)
- [Distribution](#distribution)

## Statuts

| Statut                | Signification                                                                     |
| --------------------- | --------------------------------------------------------------------------------- |
| Retenu                | Décision confirmée pour la conception ; implémentation non attestée dans le dépôt |
| Différé               | Fonctionnalité ou composant reporté après les lots livrés                         |
| Envisagé              | Fonctionnalité annoncée sans engagement de livraison ni ordre défini              |
| À confirmer           | Proposition ou détail restant à choisir                                           |
| Rapporté, non vérifié | Réalisation annoncée dans la source historique, absente du dépôt inspecté         |
| Vérifié               | Élément directement observable et validé dans le dépôt                            |

## Produit et contraintes

| Sujet                  | Décision ou périmètre                                                                                                              | Statut  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Usage                  | Productivité personnelle local-first inspirée fonctionnellement de Nanoboard                                                       | Vérifié |
| Premier lot (MVP)      | Socle, stockage local, projets et tâches (vues liste et Kanban), notes enrichies, import/export ZIP                                | Vérifié |
| Deuxième lot           | Tableau blanc SVG natif accessible (`0.2.0`, `schemaVersion: 2`)                                                                   | Vérifié |
| Planification          | Vue `Aujourd’hui`, vue `Calendrier` (`Mois`/`Semaine`, week-end, `18h–7h`, grille horaire, D&D et clavier), récurrence, `.ics`     | Vérifié |
| Transversalité         | Étiquettes multi-entités, liens internes (avec protection sur statut terminal), archivage complet (`Archives`), modèles, `Ctrl+K`  | Vérifié |
| Contenu                | Descriptions enrichies, liens, listes de contrôle, schémas vectoriels, images locales                                              | Vérifié |
| Expérience             | Import/export ZIP (clair ou chiffré, fusion/sélectif/remplacement), mode sombre, PWA hors ligne, export `.md`/`.ics`/`.svg`/`.png` | Vérifié |
| Exécution              | Local first, sans backend distant ni serveur applicatif requis au runtime                                                          | Vérifié |
| Distribution           | Fichiers statiques compatibles GitHub Pages                                                                                        | Vérifié |
| Cible                  | Chrome / Chromium récent sur ordinateur                                                                                            | Vérifié |
| Technologies           | Standards web (HTML5, CSS natif, JavaScript ES2024+ natif) ; aucun framework applicatif au runtime                                 | Vérifié |
| Développement          | Serveur local autorisé pour les outils (`vite`, `vite preview`)                                                                    | Vérifié |
| Identité et transferts | Aucun compte ni synchronisation automatique ; transferts manuels par import/export                                                 | Vérifié |
| Réseau                 | Aucun appel métier, télémétrie, analytique ou ressource CDN tierce                                                                 | Vérifié |

## Périmètre livré

**Vérifié :**

- Socle en **JavaScript récent natif (`.js`, ES Modules)**, sans transpilation du code applicatif, avec vérification statique des types via **JSDoc + fichiers de déclaration `.d.ts`** (`tsc -p jsconfig.json`) et bundling des dépendances locales via Vite.
- Store d’état immuable et adaptateurs DOM exploitant les API modernes des navigateurs récents (`<dialog>`, Popover API, Pointer Events, Web Crypto, File System Access API).
- Stockage local `IndexedDB` (`DB_VERSION = 4`) via `idb` avec corbeille locale à rétention configurable (`1` à `365` jours), ramasse-miettes des images orphelines et demande de persistance (`navigator.storage.persist()`).
- Tableau de bord quotidien **Aujourd’hui** (indicateurs, retards, échéances à 7 jours, priorités hautes, complétion directe, éléments récents) et vue **Calendrier** (`Mois`/`Semaine`, distinction week-end vs créneau `18h–7h`, créneaux horaires `00:00`–`23:00` + `Sans heure`, glisser-déposer, `−1 j` / `+1 j`, raccourcis `Alt`/`Maj` + flèches, panneau `Sans échéance` et export `.ics` RFC 5545).
- Gestion des projets, tâches (ajout rapide Liste et Kanban, vues Liste et Kanban accessibles, statuts paramétrables avec rôles `Initial`/`Terminal` et blocage de nouveaux liens sur statut terminal, récurrence, recherche multi-mots) et **archivage transversal** sur projets, tâches, notes et tableaux blancs avec vue **Archives** filtrable et réactivation parente automatique.
- Transversalité : étiquettes sur tâches et notes, liens internes bidirectionnels (`Éléments liés` / `Lié depuis :`) entre tâches, notes et tableaux blancs avec nettoyage à la purge, modèles locaux intégrés et personnalisés (checklists, notes, tableaux blancs) et recherche globale dans la palette `Ctrl+K`.
- Notes autonomes et descriptions de tâches avec Tiptap Core headless (`h1` à `h3`), images locales en `Blob`, duplication, archivage et export `.md`.
- Tableaux blancs autonomes sur canevas SVG natif (`src/adapters/whiteboard-canvas.js`), avec sélection multiple par zone / `Maj+clic` / `Ctrl+A`, duplication `Ctrl+D`, aimantation des flèches, grille `20 px` avec magnétisme, ajustement à la vue, images locales, navigation clavier complète, archivage, modèles de canevas et export `.svg` / `.png`.
- Visuel de saisie (`Tiroir latéral` ou `Modale`) configurable par écran, durée configurable des notifications (`1` à `60 s`) et délai de corbeille dans `Préférences d’affichage`.
- Sauvegarde et restauration par archive ZIP (`fflate`, `schemaVersion: 2`) en clair ou chiffrée (`AES-256-GCM` + `PBKDF2-SHA-256`), fusion sans écrasement, import sélectif par projets, remplacement complet, enregistrement via `showSaveFilePicker` et suivi d’ancienneté de la dernière sauvegarde.
- Notification explicite de mise à jour Service Worker prête hors ligne (`Recharger` / `Plus tard`).

## Stack et outils

| Élément                  | Choix retenu                                                                                                         | Avancement local |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Langage                  | JavaScript moderne (ES2024+, `.js` ESM natif)                                                                        | Vérifié          |
| Vérification de types    | JSDoc + contrats `.d.ts` vérifiés par TypeScript (`checkJs: true`, `strict: true`, `noUncheckedIndexedAccess: true`) | Vérifié          |
| Interface                | HTML5 sémantique, DOM natif (`<dialog>`, Popover API)                                                                | Vérifié          |
| Styles                   | CSS natif moderne, conventions Covenant Design System (`@layer`, tokens CSS)                                         | Vérifié          |
| Polices et icônes        | `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, `@phosphor-icons/web` bundlés localement (zéro CDN)        | Vérifié          |
| Build et développement   | Vite (résolution des paquets npm, CSP prod, `precache-manifest.json`)                                                | Vérifié          |
| Stockage                 | IndexedDB (`DB_VERSION = 4`, `8` stores) via `idb` + Web Locks (`navigator.locks`)                                   | Vérifié          |
| Archives et chiffrement  | `fflate` (`manifest.json`, `data.json`, `assets/*`, schéma `v2`) + Web Crypto API (`PBKDF2-SHA-256`, `AES-256-GCM`)  | Vérifié          |
| Texte enrichi            | Tiptap Core v3 (headless) + sérialiseur CommonMark/GFM pur (`src/core/markdown.js`)                                  | Vérifié          |
| Kanban (glisser-déposer) | API natives (HTML Drag and Drop) + menu Popover et raccourcis clavier `Alt` + flèches                                | Vérifié          |
| Calendrier & agenda      | Grille pure (`src/core/dates.js`) + générateur RFC 5545 sans dépendance (`src/core/ical.js`)                         | Vérifié          |
| Tableau blanc            | Option A retenue et livrée : canevas SVG natif + Pointer Events + raccourcis clavier (zéro dépendance tiers)         | Vérifié          |
| Tests                    | Vitest, Playwright, `@axe-core/playwright`                                                                           | Vérifié          |
| Analyse statique         | ESLint (flat config) et TypeScript (`tsc -p jsconfig.json`)                                                          | Vérifié          |
| Formatage                | Prettier                                                                                                             | Vérifié          |
| CI et déploiement        | GitHub Actions (`.github/workflows/ci.yml` et `.github/workflows/deploy.yml` vers GitHub Pages)                      | Vérifié          |
| Environnement            | Node.js 24 dans `.nvmrc`                                                                                             | Vérifié          |

## Architecture et conventions

**Vérifié :**

- Code exécutable en JavaScript standard (`.js`), appuyé sur les contrats de types déclarés dans `src/types.d.ts` / `src/env.d.ts` et annotés en JSDoc.
- Exploitation privilégiée des standards web modernes (Web Crypto, Web Locks, File System Access API, `<dialog>`, Popover API, Pointer Events).
- Fonctions pures dans `src/core/` (`backup.js`, `crypto-archive.js`, `dates.js`, `ical.js`, `markdown.js`, `model.js`, `schema.js`, `search.js`, `store.js`, `templates.js`, `whiteboard.js`).
- Gestion d’état centralisée par store immuable minimaliste (commandes, réduction pure `{ state, effects }`, abonnement des vues) sans état global mutable partagé.
- Effets isolés dans `src/adapters/` et `src/adapters/dom/` : DOM, stockage IndexedDB (`idb`), archives ZIP et sélection de fichier, mise à jour Service Worker, encapsulation de Tiptap Core et adaptateur SVG natif du tableau blanc.
- Données métier et schémas de sauvegarde strictement indépendants des structures internes des bibliothèques tierces.
- Organisation modulaire par fonctionnalité, code et identifiants en anglais, fichiers en `kebab-case.js`, fonctions et variables en `camelCase`, types JSDoc/TS en `PascalCase`, structures métier immuables (`readonly`).

## Texte enrichi et export Markdown

**Vérifié :** Tiptap Core v3 sans wrapper React/Vue, isolé derrière `src/adapters/rich-text-tiptap.js` avec barre d’outils en DOM natif ; sélection minimale d’extensions libres ; document sérialisé en JSON validé ; contrôle des URL (`https://`, `mailto:` uniquement), refus et blocage des images distantes au collage et à l’insertion.

**Périmètre vérifié :** paragraphes, titres `h1`–`h3`, emphase (gras, italique, barré, code inline), liens, listes à puces et numérotées, listes de contrôle (tâches), références aux images locales (`assets`), trames de notes et export autonome au format Markdown (`.md`).

## Stockage, corbeille et sauvegardes

**Vérifié :**

- État de travail conservé dans `IndexedDB` (`DB_VERSION = 4`) via `idb` (`meta`, `projects`, `tasks`, `notes`, `whiteboards`, `assets`, `trash`, `templates`).
- Corbeille locale avec suppression réversible par défaut, rétention configurable (`1` à `365` jours, `30` par défaut), purge automatique au démarrage, nettoyage des références `links` pointant vers les éléments purgés et suppression des images orphelines dans `assets`.
- Appel à `navigator.storage.persist()` et affichage de l’état, du quota et de l’ancienneté de la dernière sauvegarde (`meta.lastBackupAt`) dans `#modal-backup`.
- Verrouillage multi-onglets via `navigator.locks` (`locavern-write-lock`) avec passage en lecture seule du second onglet et reprise automatique à la fermeture du détenteur.
- Séparation entre les données structurées et les fichiers binaires (`assets` stockés sous forme de `Blob`).
- Version de schéma de données (`schemaVersion: 2`) distincte de la version applicative (`0.2.0`), avec validation stricte et migration transparente `v1` -> `v2` à l’import dans `src/core/schema.js`.
- Import/export manuel sous forme d’archive ZIP (`manifest.json`, `data.json`, `assets/*`) avec chiffrement optionnel par mot de passe (`AES-256-GCM` + `PBKDF2-SHA-256`), trois modes d’import (`merge`, `projects`, `replace`), écriture via `showSaveFilePicker` avec repli téléchargement, limites de taille (`5 Mio` par image, `25 Mio` par archive, `10 000` enregistrements) et types MIME autorisés (`image/png`, `image/jpeg`, `image/webp`, `image/gif`).

**Limites de conception déclarées :** export ZIP en clair lorsque le chiffrement n’est pas activé ; aucune récupération possible en cas d’oubli du mot de passe d’une archive chiffrée ; stockage navigateur pouvant être effacé manuellement par l’utilisateur ; les étiquettes (`tags`), liens internes (`links`), éléments en corbeille et modèles personnalisés restent hors du schéma ZIP `v2`.

## Confidentialité et sécurité

**Vérifié :**

- Aucun backend métier, télémétrie, rapport d’erreur distant, CDN, aperçu distant de lien, donnée utilisateur dans les URL, HTML actif librement importé ou synchronisation automatique.
- Politique CSP de production stricte injectée au build (`default-src 'none'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' blob: data:`, `font-src 'self'`, `connect-src 'self'`, `worker-src 'self'`, `manifest-src 'self'`, `object-src 'none'`, `frame-src 'none'`, `base-uri 'none'`, `form-action 'none'`).
- Zéro requête réseau externe vérifié par les tests Playwright (`shell.spec.js`, `notes-tasklist.spec.js`, `offline-csp.spec.js`, `whiteboard.spec.js`, `input-presentation.spec.js`, etc.).

## Styles et design system

**Vérifié :**

- CSS natif sans framework CSS externe.
- Intégration locale des fichiers du **Covenant Design System** (`public/vendor/covenant/`, sans import Google Fonts) et styles applicatifs basés exclusivement sur les tokens `--cv-*` (`src/styles/app.css`).
- Tokens sémantiques en propriétés personnalisées CSS (thèmes clair et sombre natifs avec `color-scheme` et script anti-flash `public/theme-init.js`).
- Composants HTML5 sémantiques (`<dialog>`, `[popover]`, formulaires accessibles, états vides et d’erreur explicites), conformité WCAG 2.2 AA vérifiée en clair et sombre via `@axe-core/playwright` (`dark-mode-contrast.spec.js`, `calendar.spec.js`, `statuses-archives.spec.js`).
- Formatage avec Prettier.

## Tableau blanc

**Vérifié :**

- Schéma pivot propre à Locavern (`Whiteboard`, `WhiteboardElement`, `WhiteboardViewport`) dans `src/types.d.ts`, `src/core/model.js` et `src/core/whiteboard.js`, indépendant de toute bibliothèque externe.
- Moteur graphique retenu et implémenté : **Option A — Canevas SVG natif + Pointer Events + raccourcis clavier** dans `src/adapters/whiteboard-canvas.js`, sans aucune dépendance runtime supplémentaire.
- Périmètre vérifié : outils `select`, `marquee`, `sticky`, `rect`, `ellipse`, `arrow`, `text`, `path`, sélection multiple (`Maj+clic`, `Maj+Espace`, `Maj+glisser`, `Ctrl+A`), duplication (`Ctrl+D`), aimantation des flèches aux ancres des formes, grille `20 px` avec magnétisme, fond transparent, superposition `zIndex`, insertion d’images locales, blocage des images distantes, 5 couleurs Covenant, historique `50` états Annuler/Rétablir, zoom (`25 %` à `300 %`), panoramique, ajustement à la vue, manipulation intégrale au clavier (WCAG 2.2 AA), modèles de canevas et export autonome `.svg` / `.png`.

## Qualité et documentation

**Vérifié :**

- Vérification statique stricte des types sur les fichiers `.js` (`tsc -p jsconfig.json`).
- `89` tests unitaires Vitest (`14` fichiers) sur le cœur fonctionnel pur, les archives, l’export de dossier et la détection de mise à jour Service Worker (`tests/unit/`).
- `39` scénarios de bout en bout (`21` fichiers) Playwright avec contrôles d’accessibilité `@axe-core/playwright` (`tests/e2e/`).
- Documentation française organisée selon Diátaxis (`README.md`, `docs/`), alignée sur la version `0.2.0` et les évolutions livrées.

## Distribution

**Vérifié :**

- Distribution statique produite dans `dist/` (`base: './'`), manifeste PWA (`public/manifest.webmanifest`) et Service Worker natif (`public/sw.js`, cache `locavern-shell-v2` + `precache-manifest.json` + bannière de mise à jour `sw-update.js`) vérifiés hors ligne sous Playwright.
- Pipeline GitHub Actions dédié dans `.github/workflows/deploy.yml` (déclenchement sur `push` vers `main` et `workflow_dispatch`, appel du workflow réutilisable `.github/workflows/ci.yml`, build de `dist/`, préparation via `actions/configure-pages@v5`, upload via `actions/upload-pages-artifact@v3` et déploiement via `actions/deploy-pages@v4` sur l’environnement `github-pages`).

**Prérequis côté dépôt GitHub :** activer GitHub Pages avec la source « GitHub Actions » dans les paramètres du dépôt pour la première exécution du déploiement.
