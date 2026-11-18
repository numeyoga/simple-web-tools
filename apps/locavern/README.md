---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-16
---

# Locavern

Locavern est une application web local-first de productivité personnelle (tableau de bord quotidien, projets, tâches récurrentes en vues liste, Kanban et calendrier avec export `.ics`, notes enrichies avec export `.md`, tableau blanc SVG interactif, étiquettes, liens internes, modèles locaux, vue d’archives transversale, corbeille locale et archives ZIP claires ou chiffrées), exécutée entièrement dans le navigateur sans backend ni requête vers des domaines tiers.

## Sommaire

- [Périmètre fonctionnel](#périmètre-fonctionnel)
- [Démarrage et scripts](#démarrage-et-scripts)
- [Documentation](#documentation)
- [Licence](#licence)

## Périmètre fonctionnel

- **Planification et tâches** : vue **Aujourd’hui** (indicateurs, retards, complétion directe et éléments récents), **Projets** actifs, **Tâches** en vue Liste (ajout rapide, badges d’urgence et rôles de statut) et Kanban configurable (colonnes **Initial** / intermédiaire / **Terminal**, ajout rapide par colonne, glisser-déposer, menu Popover, clavier `Alt` + flèches, régularisation hors colonnes), récurrence (`Quotidienne`, `Hebdomadaire`, `Mensuelle`) et vue **Calendrier** (`Mois`/`Semaine` avec différenciation week-end `Sam`/`Dim`, créneau `18h–7h`, grille horaire `00:00`–`23:00` + `Sans heure`, report par glisser-déposer ou clavier, export `.ics`).
- **Transversalité, archives et recherche** : étiquettes multi-entités sur tâches et notes, liens internes bidirectionnels (`Éléments liés` / `Lié depuis :`) entre tâches, notes et tableaux blancs (avec blocage des nouveaux liens sur statut **Terminal**), archivage complet des projets, tâches, notes et tableaux blancs avec vue dédiée **Archives** (filtrage par texte, type, projet, étiquette, réactivation ou envoi en corbeille), modèles locaux intégrés et personnalisés et palette dynamique `Ctrl+K`.
- **Notes enrichies** : éditeur Tiptap Core headless (`Titre 1` à `3`, gras, italique, barré, code, listes à cocher, liens `https://` et `mailto:`), duplication, archivage, export Markdown (`.md`) et images locales stockées en `Blob` dans `IndexedDB` (blocage des images distantes).
- **Tableau blanc SVG** : canevas SVG natif avec sélection par zone, multi-sélection (`Maj+clic`, `Maj+Espace`, `Ctrl+A`), duplication (`Ctrl+D`), aimantation des flèches aux ancres des formes, grille `20 px` avec magnétisme, Post-it, rectangles, ellipses, flèches, texte, tracés libres et images locales, 5 couleurs sémantiques Covenant, historique Annuler/Rétablir, zoom / ajustement à la vue, manipulation complète au clavier (WCAG 2.2 AA), archivage et export autonome `.svg` et `.png`.
- **Corbeille, stockage et portabilité** : persistance `IndexedDB` (`idb`, `DB_VERSION = 4`), corbeille locale à rétention configurable (`1` à `365` jours) avec purge des images orphelines, protection multi-onglets par Web Locks (`navigator.locks`), export/import d’archives ZIP en clair ou chiffrées (`AES-256-GCM` + `PBKDF2-SHA-256`), fusion sans écrasement ou import sélectif par projets, enregistrement via `showSaveFilePicker`, mode hors ligne PWA avec bandeau de mise à jour Service Worker et CSP stricte sans CDN.

## Démarrage et scripts

Prérequis : Node.js 24 (cf. `.nvmrc`) et npm.

```bash
npm ci
npm run dev
```

Scripts vérifiés :

- `npm run dev` : serveur de développement Vite.
- `npm run build` : empaquetage de production dans `dist/` avec CSP et `precache-manifest.json`.
- `npm run preview` : prévisualisation du build sur `http://127.0.0.1:4173`.
- `npm run typecheck` : vérification stricte des types JSDoc et `.d.ts` (`tsc -p jsconfig.json`).
- `npm run lint` : analyse statique ESLint.
- `npm run format` / `npm run format:check` : formatage Prettier.
- `npm test` : tests unitaires Vitest (`tests/unit/`).
- `npm run test:e2e` : tests navigateur Playwright et audits WCAG 2.2 AA (`@axe-core/playwright`, `tests/e2e/`).

## Documentation

- [Sommaire complet de la documentation](docs/index.md).
- **Documentation utilisateur** :
  - [Tutoriel : créer votre premier espace de travail](docs/tutorials/premier-espace-de-travail.md).
  - Guides pratiques : [projets et tâches](docs/how-to/organiser-projets-et-taches.md), [journée et calendrier](docs/how-to/planifier-journee-et-calendrier.md), [étiquettes, liens et modèles](docs/how-to/organiser-avec-etiquettes-liens-et-modeles.md), [notes et images](docs/how-to/rediger-notes-et-images.md), [tableau blanc](docs/how-to/utiliser-le-tableau-blanc.md), [sauvegardes ZIP et corbeille](docs/how-to/sauvegarder-et-restaurer.md), [installation hors ligne](docs/how-to/utiliser-locavern-hors-ligne.md), [mode lecture seule multi-onglets](docs/how-to/reprendre-edition-multi-onglets.md).
  - Référence utilisateur : [interface, vues et raccourcis](docs/reference/interface-et-raccourcis.md), [stockage, format ZIP et erreurs](docs/reference/stockage-limites-et-erreurs.md).
  - Explication : [fonctionnement local, confidentialité et périmètre](docs/explanation/fonctionnement-local-et-confidentialite.md).
- **Documentation technique** : [état du dépôt](docs/reference/etat-du-depot.md), [décisions et avancement](docs/reference/decisions-et-avancement.md), [choix d’architecture](docs/explanation/choix-architecture.md).

## Licence

Le dépôt est distribué sous [licence MIT](LICENSE).
