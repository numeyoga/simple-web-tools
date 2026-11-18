---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-15
---

# Choix d’architecture

Cette page explique les motivations de l’architecture de Locavern, à partir de la [restitution initiale](../../choix-technique.md) et des arbitrages actés dans le [registre des décisions](../reference/decisions-et-avancement.md). L’[état du dépôt](../reference/etat-du-depot.md) précise ce qui est matériellement présent.

## Sommaire

- [Autonomie et confidentialité](#autonomie-et-confidentialité)
- [Déploiement incrémental et maîtrise de la complexité](#déploiement-incrémental-et-maîtrise-de-la-complexité)
- [Standards web, JavaScript natif et noyau fonctionnel pur](#standards-web-javascript-natif-et-noyau-fonctionnel-pur)
- [Système de design et composants spécialisés](#système-de-design-et-composants-spécialisés)
- [Persistance, corbeille, chiffrement et portabilité](#persistance-corbeille-chiffrement-et-portabilité)

## Autonomie et confidentialité

La conception place les données sur l’appareil et exclut comptes et synchronisation automatique. Ce choix évite la dépendance à un service métier distant et laisse les transferts à l’initiative de l’utilisateur. Il implique aussi que la récupération des données dépend du stockage local et des exports réalisés.

La distribution statique permet d’héberger l’application sur GitHub Pages sans serveur applicatif : le build Vite émet des chemins relatifs (`base: './'`) compatibles avec un sous-chemin de projet GitHub Pages comme avec un domaine dédié, et le workflow `.github/workflows/deploy.yml` conditionne chaque publication sur `main` à la réussite préalable du workflow réutilisable de vérification `.github/workflows/ci.yml`. Pour concilier l’usage hors ligne par Service Worker et une politique de sécurité (CSP) stricte, la CSP autorise uniquement l’origine locale `'self'` pour les scripts, les workers (`worker-src 'self'`) et la mise en cache des ressources statiques (`connect-src 'self'`), tout en bloquant toute requête ou ressource vers un domaine tiers.

De plus, lors d’une mise à jour applicative en ligne, le Service Worker (`public/sw.js` + `src/adapters/sw-update.js`) s’abstient d’appeler `skipWaiting()` automatiquement afin d’éviter qu’un nouvel ensemble de scripts ne prenne le contrôle au milieu d’une session d’édition ouverte ; le basculement reste déclenché par l’utilisateur.

## Déploiement incrémental et maîtrise de la complexité

Plutôt que de construire simultanément tous les écrans ou de structurer le socle autour d’une bibliothèque de dessin encore jeune (`@quickdrawjs/core` 0.3.0), l’évolution s’est faite par strates successives :

1. **Lot 1 (MVP, `0.1.0`)** : socle JavaScript moderne (`.js` ESM + JSDoc), store d’état immuable, stockage local IndexedDB (`idb`), gestion des projets et des tâches (vues liste et Kanban), notes enrichies (Tiptap Core) et import/export ZIP complet.
2. **Lot 2 (Tableau blanc, `0.2.0`)** : ajout de la collection `whiteboards` (`schemaVersion: 2`, migration transparente `v1` -> `v2`) et du canevas SVG interactif natif (`src/adapters/whiteboard-canvas.js`).
3. **Évolutions fonctionnelles sur `0.2.0`** : ajout de la vue `Aujourd’hui`, du `Calendrier` (`Mois`/`Semaine`) et de l’export `.ics`, de la récurrence des tâches, des étiquettes, liens internes et modèles locaux, de l’export `.md` et de la duplication de notes, de la corbeille locale (`DB_VERSION = 4`), du chiffrement AES-GCM et de la fusion / sélection de projets à l’import ZIP, ainsi que des fonctions avancées du tableau blanc (sélection par zone, aimantation des flèches, grille `20 px`, duplication, ajustement à la vue).

Stabiliser d’abord le modèle cœur immuable et la séparation entre `src/core/` et `src/adapters/` a permis d’ajouter chaque nouvelle capacité métier (dates calendaires, récurrence, sérialisation `.ics` et Markdown, géométrie de tableau blanc, cryptographie, recherche multi-mots, fusion d’identifiants) sans introduire de dépendance UI dans la logique métier.

## Standards web, JavaScript natif et noyau fonctionnel pur

Le choix du HTML5 sémantique, du CSS natif et du **JavaScript récent (`.js` ES2024+ en ES Modules)** pousse au maximum l’alignement avec les standards web. Le code applicatif est directement compréhensible et exécutable par le navigateur sans étape de transpilation de langage. Pour conserver la sécurité d’un typage statique strict sur le modèle métier, les commandes du store et les migrations de données, les contrats sont déclarés dans des fichiers `.d.ts` et vérifiés via les annotations **JSDoc** par `tsc --allowJs --checkJs --noEmit`. Vite n’intervient que pour résoudre les paquets npm (`@tiptap/core`, `idb`, `fflate`) et produire le bundle de distribution.

Sans framework applicatif (React, Vue), le risque principal d’une interface multi-vues (synchroniser une tâche entre `Aujourd’hui`, la liste, le Kanban, le `Calendrier` et le panneau de détail, ou maintenir cohérents liens et rétroliens entre tâches, notes et tableaux blancs) est la dispersion d’un état mutable dans le DOM. Pour l’éviter, l’architecture associe :

- un **noyau fonctionnel pur** (`src/core/`) regroupant le modèle, le store d’état immuable (`dispatch` produisant `{ state, effects }`), les calculs de dates et récurrence (`dates.js`), les sérialisations pures (`ical.js`, `markdown.js`), la recherche (`search.js`), les modèles (`templates.js`), la géométrie de tableau blanc (`whiteboard.js`), la fusion d’archives (`backup.js`), les schémas (`schema.js`) et la cryptographie (`crypto-archive.js`) ;
- des **adaptateurs** (`src/adapters/` et `src/adapters/dom/`) isolant les effets de bord : rendu DOM (`<dialog>`, Popover API, Pointer Events), persistance IndexedDB via `idb`, écriture de fichier via `showSaveFilePicker` avec repli `<a download>`, gestion de cycle de vie Service Worker, encapsulation de Tiptap Core et moteur SVG natif du tableau blanc.

Pour la **récurrence des tâches**, l’occurrence suivante est calculée de manière pure et synchrone dans le réducteur du store dès le passage au statut `done` (sans tâche de fond ni horloge asynchrone), ce qui garantit un comportement déterministe hors ligne et testable sans navigateur.

## Système de design et composants spécialisés

Au lieu de concevoir une méthodologie CSS de zéro, l’interface s’appuie sur les conventions du **Covenant Design System** pour applications web Vanilla : tokens sémantiques en propriétés personnalisées CSS `--cv-*` (thèmes clair et sombre), polices et icônes embarquées localement, et respect des critères d’accessibilité WCAG 2.2 AA.

Pour le texte enrichi, **Tiptap Core** est retenu en mode headless (sans wrapper React/Vue) derrière un adaptateur dédié, complété par un sérialiseur pur (`src/core/markdown.js`) afin d’exporter vers Markdown sans embarquer de convertisseur tiers supplémentaire.

Pour l’agenda, générer directement les fichiers RFC 5545 dans `src/core/ical.js` (repli à 75 octets UTF-8, échappement des délimiteurs, événements journée entière) évite toute bibliothèque externe tout en garantissant l’absence de dépendance fuseau horaire instable sur les dates locales `AAAA-MM-JJ`.

Pour le **Tableau blanc**, l’**Option A (Canevas SVG natif + Pointer Events + raccourcis clavier)** a été retenue face à des bibliothèques externes (`Fabric.js`, `@quickdrawjs/core`) pour quatre raisons :

1. **Zéro dépendance runtime supplémentaire** : maintien d’un bundle léger et d’une maîtrise totale de la CSP, y compris lors de l’ajout de l’aimantation des flèches et du magnétisme sur grille via `src/core/whiteboard.js` ;
2. **Accessibilité native WCAG 2.2 AA** : chaque élément SVG (`<g tabindex="0" role="group">`) participe nativement à l’ordre de tabulation, au lecteur d’écran et aux raccourcis clavier (`Flèches`, `Maj+Espace`, `Entrée`/`F2`, ajout au centre sans glisser-déposer) ;
3. **Intégration directe à Covenant** : les 5 jetons de couleur des formes suivent automatiquement le basculement thème clair/sombre sans ré-initialiser le canevas ;
4. **Pérennité des données** : le format pivot `Whiteboard` (`viewport`, `elements`, `assetIds`, liaisons de flèches) reste indépendant de toute bibliothèque tierce.

## Persistance, corbeille, chiffrement et portabilité

`IndexedDB` conserve l’état de travail dans le navigateur, accédé via la micro-bibliothèque `idb` pour fiabiliser la gestion des promesses, des transactions et des migrations incrémentales de schéma (`DB_VERSION = 4` ajoutant notamment les magasins `trash` et `templates`). L’appel à `navigator.storage.persist()` réduit le risque d’effacement automatique par le navigateur, et l’API Web Locks (`navigator.locks`) protège contre les écritures concurrentes entre onglets.

Une distinction stricte est établie entre les données structurées et les actifs binaires (images locales stockées en `Blob` dans `assets`). Lors de la suppression d’un élément, le déplacement en corbeille évite de détruire immédiatement ses données ; ce n’est qu’à la purge définitive (manuelle ou après expiration du délai configuré) qu’un passage de nettoyage retire les références `links` pointant vers l’élément purgé puis supprime les `Blob` devenus orphelins.

Pour le **chiffrement optionnel des archives**, le recours exclusif à l’API native **Web Crypto** (`crypto.subtle`, `PBKDF2-SHA-256` et `AES-256-GCM` avec AAD explicite sur une enveloppe ZIP contenant `encryption.json` et `payload.enc`) apporte une confidentialité forte au repos sans alourdir le bundle ni compromettre la lisibilité des archives non chiffrées existantes (`schemaVersion: 1` et `2`).

Pour l’import non destructif (**fusion** ou **sélection de projets**), `prepareBackupMerge` dans `src/core/backup.js` réalloue les identifiants en collision de manière cohérente à travers projets, tâches, notes, tableaux blancs et images avant d’écrire dans `IndexedDB`, évitant tout écrasement silencieux des données existantes. L’écriture sur disque privilégie l’API `window.showSaveFilePicker` (afin de laisser l’utilisateur choisir l’emplacement et de détecter une annulation avant de mettre à jour `meta.lastBackupAt`) avec repli transparent vers `<a download>` dans les contextes où l’API n’est pas exposée.
