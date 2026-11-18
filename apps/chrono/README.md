# Chrono

Application de suivi du temps en JavaScript vanilla : pas de framework, pas de
build, pas de dépendance à installer. Le dossier `public/` est servi tel quel.

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

Scripts classiques (pas de modules ES), chargés dans cet ordre par
`public/index.html`. Chaque fichier expose ses fonctions sur `window`.

| Fichier | Rôle |
| --- | --- |
| `js/lib.js` | Aides DOM (`el`, `icon`, `mount`) et formatage (durées, heures, jours). |
| `js/ui.js` | Primitives d'interface : Button, Input, Select, Badge, Kbd, Modal, Toast. |
| `js/db.js` | Store applicatif, persistance IndexedDB avec repli localStorage, espaces de sauvegarde (`window.WORKSPACES`), export et import JSON. |
| `js/PointageWidget.js` | Widget de la barre latérale : présence et chrono actif. |
| `js/Timeline.js` | Vue Timeline : bandeau de date, stats, graphe horaire, sessions, modale d'édition de session. |
| `js/Todos.js` | Vue Todos. |
| `js/Projets.js` | Vue Projets. |
| `js/Rapport.js` | Vue Rapport hebdomadaire et export CSV. |
| `js/QuickAdd.js` | Modale « ajouter un chrono » (démarrage immédiat ou saisie manuelle). |
| `js/Workspaces.js` | Modale de gestion des espaces, export et import JSON. |
| `js/App.js` | Point d'entrée : barre latérale, navigation entre vues, raccourcis clavier. |

Principe : un store unique (`createStore()` dans `db.js`) détient l'état
(`projets`, `todos`, `sessions`, `pointage`) et expose des `actions`. Chaque
action modifie l'état puis notifie les écouteurs (`store.onState`). Un
minuteur d'une seconde notifie en plus `store.onTick`, utilisé pour les durées
des chronos en cours. Chaque vue s'abonne et **re-rend entièrement** son
contenu à chaque notification ; il n'y a ni diff ni état local persistant.
Les écritures en base sont regroupées et différées de quelques dizaines de
millisecondes.

Les icônes [Phosphor](https://phosphoricons.com/) (version 2.1.1, licence MIT)
sont servies depuis `public/assets/vendor/phosphor/` (graisses regular, fill et
bold). Le thème visuel est `public/assets/covenant.css`.

## Lancer en local

```sh
python3 -m http.server --directory public
```

Puis ouvrir <http://localhost:8000>.

## Tests

```sh
node --test tests/*.test.mjs
```

Aucune dépendance à installer. `tests/helpers/load.mjs` charge les scripts de
`public/js` dans un contexte `node:vm` avec un faux `window` (sans IndexedDB,
le store utilise donc son repli localStorage).

## Déploiement

La CI GitLab (`.gitlab-ci.yml`) comporte deux jobs :

1. `test` lance `node --test tests/*.test.mjs` (image `node:22-alpine`) sur toutes les
   branches et les merge requests ;
2. `pages` publie le dossier `public/` sur GitLab Pages, uniquement sur la
   branche par défaut et seulement si `test` a réussi.

## Raccourcis clavier

Actifs hors champ de saisie et hors modale ouverte, sans Ctrl, Alt ni Meta.

| Touche | Action |
| --- | --- |
| `Espace` | Si aucun chrono n'est actif : ouvre « nouveau chrono ». Sinon met tout en pause, ou reprend tout si tout est en pause. |
| `N` | Nouveau chrono. |
| `S` | Arrête tous les chronos actifs. |
| `Échap` | Ferme la modale ouverte. |
