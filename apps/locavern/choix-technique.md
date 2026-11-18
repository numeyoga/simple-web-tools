---
created_at: '2026-11-12'
updated_at: '2026-11-13'
application_version: '0.1.0'
---

# Locavern — Décisions produit et techniques

> **Source historique — état rapporté le 12 novembre 2026.** Ce texte restitue une conversation et ne décrit pas l’état vérifié du dépôt actuel. Au contrôle du 13 novembre 2026, aucun code applicatif, manifeste, test ni workflow annoncé ci-dessous n’est présent. Les résultats et commits rapportés restent non vérifiés. Le corps historique est conservé ; les mentions d’environnement inaccessible ne décrivent pas la session actuelle.
>
> La documentation courante est accessible depuis [l’index](docs/index.md) : [état réel du dépôt](docs/reference/etat-du-depot.md), [décisions et avancement](docs/reference/decisions-et-avancement.md), [motivations](docs/explanation/choix-architecture.md). La version `0.1.0` du frontmatter est une version annoncée historiquement, non attestée par un manifeste local.

Ce document rassemble les décisions prises pendant la conception de Locavern. Il distingue les choix retenus, les éléments déjà implémentés et les propositions restant à confirmer.

## Sommaire

- [Objectif et fonctionnalités](#objectif-et-fonctionnalités)
- [Contraintes fondamentales](#contraintes-fondamentales)
- [Stack retenue](#stack-retenue)
- [Architecture du code](#architecture-du-code)
- [Tableau blanc](#tableau-blanc)
- [Texte enrichi](#texte-enrichi)
- [Stockage et sauvegardes](#stockage-et-sauvegardes)
- [Confidentialité](#confidentialité)
- [CSS](#css)
- [Qualité et tests](#qualité-et-tests)
- [Documentation](#documentation)
- [État du prototype](#état-du-prototype)
- [Choix restant à confirmer](#choix-restant-à-confirmer)
- [Historique Git et environnement](#historique-git-et-environnement)

## Objectif et fonctionnalités

Locavern est une application web de productivité personnelle, inspirée fonctionnellement de Nanoboard.

Fonctionnalités envisagées :

- Projets et tâches.
- Vue liste.
- Tableaux Kanban.
- Calendrier des échéances.
- Notes autonomes.
- Tableau blanc.
- Descriptions enrichies avec liens, listes de contrôle et images locales.
- Import/export manuel.
- Mode sombre.
- Installation et utilisation hors ligne.

Ces fonctionnalités ne sont pas toutes implémentées.

## Contraintes fondamentales

Décisions confirmées :

- Application local first.
- Aucun backend distant.
- Aucun serveur applicatif requis au runtime.
- Distribution statique compatible avec GitHub Pages.
- Cible principale : Chrome récent sur ordinateur.
- Privilégier les standards web.
- Aucun framework applicatif au runtime : ni React, ni Vue, ni équivalent.
- Les outils de développement peuvent utiliser un serveur local.
- Aucun compte utilisateur.
- Aucune synchronisation automatique.
- Sauvegarde et transfert de données exclusivement par import/export déclenché par l’utilisateur.
- Aucun appel réseau métier, télémétrie ou service analytique.
- Aucun chargement de ressources depuis un tiers.

Le chargement depuis GitHub Pages nécessite des requêtes de fichiers statiques. La promesse porte sur l’absence de transmission de données métier ; un hébergement distant ne permet pas de garantir une absence absolue de connexion.

Les composants externes sont acceptés pour des fonctions complexes s’ils couvrent les besoins et respectent les contraintes de runtime et de confidentialité.

## Stack retenue

| Élément                   | Choix                      | État                             |
| ------------------------- | -------------------------- | -------------------------------- |
| Langage                   | TypeScript strict          | Installé                         |
| Interface                 | HTML sémantique, DOM natif | Implémenté                       |
| Styles                    | CSS natif                  | Implémenté                       |
| Développement et build    | Vite                       | Installé                         |
| Tableau blanc             | Quickdraw Core 0.3.0       | Intégré                          |
| Texte enrichi             | Tiptap Core                | Retenu, non installé             |
| Stockage                  | IndexedDB natif            | Implémenté pour le tableau blanc |
| Tests unitaires           | Vitest                     | Installé                         |
| Tests navigateur          | Playwright                 | Installé                         |
| Accessibilité automatisée | axe-core via Playwright    | Installé                         |
| Analyse statique          | ESLint et TypeScript       | Configurés                       |
| Formatage                 | Prettier                   | Configuré                        |
| Intégration continue      | GitHub Actions             | Workflow ajouté                  |

Node.js 24 est la version de développement indiquée dans `.nvmrc`.

Les dépendances directes sont figées dans `package.json`. Le fichier `package-lock.json` conserve la résolution des dépendances transitives.

Quickdraw Core est actuellement la seule dépendance applicative.

## Architecture du code

Décisions confirmées :

- Privilégier le paradigme fonctionnel.
- Utiliser des fonctions pures pour les règles métier et les transformations.
- Isoler les effets dans des adaptateurs :
  - DOM ;
  - IndexedDB ;
  - fichiers ;
  - composants externes.
- Garder les données métier indépendantes des instances des bibliothèques.
- Éviter l’état global mutable partagé.
- Les classes internes d’un composant externe ne doivent pas dicter l’architecture de Locavern.

Le prototype sépare déjà :

- `src/document.ts` : validation et format d’échange ;
- `src/whiteboard.ts` : adaptation et contrôle de Quickdraw ;
- `src/storage.ts` : accès IndexedDB ;
- `src/main.ts` : orchestration de l’interface.

Propositions non encore formalisées :

- Code et identifiants en anglais.
- Fichiers en `kebab-case`.
- Variables et fonctions en `camelCase`.
- Types en `PascalCase`.
- Types métier `readonly`.
- Organisation durable par fonctionnalité.
- Convention commune de commandes et d’erreurs.
- Convention de commits et règles supplémentaires ESLint.

## Tableau blanc

Choix retenu : `@quickdrawjs/core` 0.3.0.

Motifs :

- Fonctionne sans React.
- Licence MIT.
- Aucune dépendance runtime déclarée.
- Éditeur et barre d’outils fournis.
- Dessin, formes, texte, notes, images, sélection, zoom et historique.
- Snapshots JSON et export PNG.

Mesures intégrées :

- Version figée.
- Badge externe supprimé.
- Images distantes refusées par l’adaptateur.
- Contrôle appliqué aussi aux entrées utilisées par le collage.
- Validation du snapshot avant remplacement.
- Politique CSP complémentaire.
- Notices de licence distribuées.

Limites connues :

- Projet jeune.
- Accessibilité complète non validée.
- Barre d’outils en anglais.
- Absence annoncée de calques, cadres et texte riche.
- Export SVG et compatibilité Excalidraw non établis.
- Connecteurs suivant les formes à vérifier.
- Validation des propriétés graphiques encore partielle.

Excalidraw et tldraw n’ont pas été retenus, notamment parce que leur intégration standard nécessite React.

Fabric.js reste une solution de repli. maxGraph reste une piste pour des diagrammes structurés. Kritzel n’est pas retenu pour le prototype.

Aucun audit n’a établi une intention malveillante de Quickdraw ou Kritzel. Cela ne constitue pas une garantie d’innocuité.

## Texte enrichi

Choix confirmé : Tiptap Core.

Locavern n’est pas destiné à la saisie documentaire très détaillée.

Périmètre initial :

- Paragraphes.
- Emphase.
- Liens.
- Listes de contrôle.
- Images locales.

Hors périmètre initial :

- Tableaux complexes.
- Mise en page documentaire avancée.
- Blocs de code.
- Collaboration distante.
- Services Cloud ou IA.
- Extensions spécialisées sans besoin démontré.

Principes d’intégration :

- Utiliser Core sans wrapper React ou Vue.
- Sélectionner seulement les extensions libres nécessaires.
- Isoler l’éditeur derrière un adaptateur.
- Stocker un document JSON validé.
- Contrôler les URL, imports et collages.
- Ne pas charger d’image depuis une URL distante.

La version et la liste exacte des extensions restent à choisir. Tiptap n’est pas encore installé.

## Stockage et sauvegardes

Décisions confirmées :

- IndexedDB conserve l’état de travail dans le navigateur.
- Aucun enregistrement automatique dans un fichier choisi sur le disque.
- Import/export manuel.
- JSON versionné.
- Version de schéma distincte de la version applicative.
- Images incluses dans les sauvegardes transférables.
- Une URL `blob:` n’est pas une sauvegarde autonome.
- Une erreur de stockage doit être affichée.
- Le stockage navigateur ne remplace pas une sauvegarde exportée.

Implémentation actuelle :

- Un document de tableau blanc dans IndexedDB.
- Import JSON après validation et confirmation.
- Export JSON téléchargeable.
- Verrou Web Locks limitant l’édition à un onglet.
- Limite d’import : 10 Mio et 10 000 enregistrements.
- Refus des versions de sauvegarde non prises en charge.

Limites :

- Aucun chiffrement applicatif.
- Les exports sont lisibles en clair.
- Une fermeture immédiate peut interrompre une écriture en cours.
- Le stockage peut être effacé par l’utilisateur ou devenir indisponible.

Restent à définir :

- Collections projets, tâches, notes et assets.
- Migrations du prototype.
- Format global des sauvegardes.
- Limites des pièces jointes.
- Utilisation éventuelle de `idb` ou Dexie.
- Ajout éventuel de File System Access API.
- Recours éventuel à ZIP pour des sauvegardes volumineuses.

## Confidentialité

Décisions confirmées :

- Aucun backend métier.
- Aucune télémétrie.
- Aucun rapport d’erreur distant.
- Aucune police, image ou bibliothèque chargée depuis un CDN.
- Aucun aperçu de lien distant.
- Aucune donnée utilisateur dans les URL.
- Aucun contenu HTML actif importé librement.
- Aucun transport de synchronisation automatique.

Le build actuel utilise une CSP interdisant notamment :

- les connexions réseau ;
- les cadres embarqués ;
- les objets ;
- les workers ;
- les images distantes ;
- les envois de formulaire.

Les images raster incorporées et les URL Blob sont autorisées.

La politique des styles autorise les styles inline nécessaires au composant actuel. Le développement autorise les connexions locales de Vite ; le build de production conserve les restrictions réseau.

La CSP complète les validations applicatives. Elle ne constitue pas, seule, une preuve d’absence de fuite.

## CSS

Décisions confirmées :

- CSS natif.
- Aucun framework CSS retenu.
- Formatage avec Prettier.
- Styles applicatifs et styles Quickdraw distincts.

Recommandations encore à confirmer :

- CUBE CSS pour organiser les styles.
- BEM léger pour nommer les blocs et leurs éléments.
- Tokens sémantiques via propriétés personnalisées.
- Couches `@layer` pour maîtriser la cascade.
- Styles tiers dans une couche `vendor`.
- Grid et Flexbox pour les dispositions.
- Propriétés logiques et dimensions relatives.
- Sélecteurs peu spécifiques.
- Pas d’ID pour les styles.
- Éviter `!important`.
- Respect de `prefers-reduced-motion`.
- Stylelint pour compléter Prettier.

CUBE CSS a été recommandé, mais son adoption n’a pas encore été explicitement confirmée.

La palette, les espacements, les points de rupture et la convention exacte des classes restent à définir.

## Qualité et tests

Outils en place :

- TypeScript strict.
- ESLint.
- Prettier.
- Vitest.
- Playwright.
- axe-core.
- GitHub Actions.

Dernière validation rapportée du prototype :

- Build réussi.
- 11 tests unitaires réussis.
- 4 tests navigateur réussis.
- Lint réussi.
- Formatage vérifié.
- Audit npm de production sans vulnérabilité connue signalée.

Parcours couverts :

- Dessin et sauvegarde.
- Import/export JSON.
- Restauration après rechargement.
- Refus d’images distantes à l’import et au collage.
- Blocage d’un second onglet en édition.
- Observation des requêtes dans le scénario de dessin/export.

Le contrôle axe-core concerne l’en-tête de Locavern, pas l’ensemble du moteur graphique.

Restent à définir :

- Critères d’accessibilité complets.
- Politique de couverture de tests.
- Règles ESLint supplémentaires.
- Lint CSS.
- Stratégie de tests des migrations et des futurs éditeurs.

## Documentation

Décisions confirmées :

- Documentation utilisateur et technique en français.
- Organisation selon Diátaxis.
- Documentation concise et factuelle.
- Distinction entre comportement implémenté, recommandation et recherche.

Conventions documentaires appliquées :

- Dates de création et de mise à jour dans le frontmatter.
- Version applicative ciblée.
- Sommaire pour les pages de contenu.
- Sources pour les recherches techniques.
- Liens relatifs entre documents.

Skill demandé mais non installé :

- https://github.com/GoogleChrome/modern-web-guidance

L’installation reste bloquée par l’indisponibilité de l’environnement d’exécution.

## État du prototype

Déjà disponible dans le code :

- Socle TypeScript/Vite.
- Tableau blanc Quickdraw.
- Persistance IndexedDB.
- Import/export JSON.
- Contrôles des images distantes.
- Protection contre l’édition concurrente entre onglets.
- Tests et workflow de vérification.

Pas encore disponible :

- Projets et tâches.
- Liste et Kanban.
- Calendrier.
- Notes autonomes.
- Tiptap.
- Thème sombre commun à toute l’application.
- Installation PWA.
- Réouverture hors ligne après fermeture.
- Workflow de publication GitHub Pages.

Commandes prévues depuis la racine du dépôt :

```bash
npm ci --ignore-scripts
npx playwright install chromium
npm run dev
npm run lint
npm test
npm run build
npm run test:e2e
npm run format:check
```

Les tests navigateur nécessitent un build préalable. Vite sert uniquement au développement, au contrôle du build et aux tests.

## Choix restant à confirmer

| Sujet                | Proposition actuelle                                |
| -------------------- | --------------------------------------------------- |
| Kanban               | SortableJS, avec commandes clavier indépendantes    |
| Calendrier           | Vue mensuelle et agenda natifs                      |
| Extensions Tiptap    | Ensemble libre et minimal                           |
| Organisation du code | Modules par fonctionnalité                          |
| Nommage              | Anglais, kebab-case / camelCase / PascalCase        |
| CSS                  | CUBE + BEM léger + tokens + couches                 |
| Lint CSS             | Stylelint                                           |
| Stockage étendu      | IndexedDB natif, autres bibliothèques si justifiées |
| Fichiers locaux      | File System Access facultative                      |
| PWA                  | Manifeste et service worker natif                   |
| Publication          | GitHub Pages, automatisation à définir              |

Un service worker peut permettre la réouverture hors ligne, mais son installation et ses mises à jour peuvent émettre des requêtes statiques. Il ne garantit pas une absence totale de connexion distante.

## Historique Git et environnement

Commits locaux rapportés :

| Commit    | Contenu                                      |
| --------- | -------------------------------------------- |
| `29ef536` | Cadrage et évaluations techniques            |
| `02e1861` | Socle applicatif et intégration Quickdraw    |
| `cc39573` | Solutions proposées pour les fonctionnalités |
| `a62c268` | Choix de Tiptap Core                         |

Au dernier contrôle du 12 novembre 2026 :

- Environnement d’exécution inaccessible.
- État plateforme `pending`, connectivité `offline`.
- Aucun accès actuel aux fichiers locaux.
- Présence des commits sur GitHub non confirmée.
- Aucun ZIP du projet généré.

Ce document est une restitution de la conversation. Il n’a pas été enregistré dans le dépôt faute d’accès à l’environnement.
