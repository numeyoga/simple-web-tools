---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-16
---

# Interface, vues et raccourcis clavier

Description factuelle de l’interface utilisateur, des champs, des valeurs par défaut et des raccourcis clavier de Locavern (`0.2.0`).

## Sommaire

- [Structure générale (Shell)](#structure-générale-shell)
- [Vue Aujourd’hui](#vue-aujourdhui)
- [Vue Tâches en mode Liste](#vue-tâches-en-mode-liste)
- [Vue Tâches en mode Kanban](#vue-tâches-en-mode-kanban)
- [Fenêtre Statuts du Kanban](#fenêtre-statuts-du-kanban)
- [Formulaire de tâche (tiroir latéral ou modale)](#formulaire-de-tâche-tiroir-latéral-ou-modale)
- [Vue Projets](#vue-projets)
- [Vue Calendrier](#vue-calendrier)
- [Vue Notes et éditeur enrichi](#vue-notes-et-éditeur-enrichi)
- [Vue Tableaux blancs et canevas SVG](#vue-tableaux-blancs-et-canevas-svg)
- [Vue Archives](#vue-archives)
- [Corbeille locale et Sauvegardes](#corbeille-locale-et-sauvegardes)
- [Palette de commandes et raccourcis clavier](#palette-de-commandes-et-raccourcis-clavier)

## Structure générale (Shell)

- **Lien d’évitement** : `Aller au contenu` (cible `#shell-main`).
- **Barre latérale (`Navigation principale`)** :
  - `Aujourd’hui` (`#today`) ;
  - `Tâches` (`#tasks`, vue par défaut au premier démarrage) ;
  - `Projets` (`#projects`) ;
  - `Calendrier` (`#calendar`) ;
  - `Notes` (`#notes`) ;
  - `Tableaux blancs` (`#whiteboards`) ;
  - `Archives` (`#archives`, avec badge compteur `#nav-archives-count` masqué lorsque aucune archive n’est présente) ;
  - Groupe `Données` : `Sauvegardes` (`#nav-backup-btn`, ouvre `#modal-backup`) et `Corbeille` (`#nav-trash-btn`, ouvre `#modal-trash`, avec badge compteur `#nav-trash-count` masqué lorsque la corbeille est vide) ;
  - Groupe `Préférences` : `Affichage` (`#nav-preferences-btn`, ouvre `#modal-preferences`).
  - Sur écran étroit (< 1024 px), le bouton menu (`Ouvrir le menu`) dans la barre supérieure ouvre et ferme la barre latérale.
- **Barre supérieure** :
  - Titre de la vue active (`Aujourd’hui`, `Tâches`, `Projets`, `Calendrier`, `Notes`, `Tableaux blancs` ou `Archives`) ;
  - Bouton `Rechercher` (`Ctrl+K`) ouvrant la palette de commandes (`#cmd-menu`) ;
  - Interrupteur `Sombre` basculant entre thème clair et thème sombre (la préférence est conservée localement sous la clé `locavern-color-scheme` ; sinon l’application suit la préférence système `prefers-color-scheme`) ;
  - Bouton `Sauvegarder` (`#topbar-backup-btn`) ouvrant la fenêtre `Sauvegardes et stockage`.
- **Bandeau de mise à jour Service Worker (`#sw-update-banner`)** : affiché lorsqu’une nouvelle version est installée en attente (`Nouvelle version prête hors ligne. Rechargez l’application pour utiliser la version mise à jour.`) avec boutons `Recharger` et `Plus tard`.
- **Fenêtre `Préférences d’affichage` (`#modal-preferences`)** :
  - Contrôle segmenté `Taille du texte` proposant `Automatique` (défaut : ×1,125 dès `2000 px`, ×1,25 dès `2400 px`), `Standard` (×1), `Confortable` (×1,125) et `Grande` (×1,25) ;
  - Un choix explicite est conservé localement sous la clé `locavern-text-size` et synchronisé entre onglets (le choix `Automatique` supprime la clé) ;
  - Contrôles segmentés `Visuel de saisie par écran` permettant de choisir entre `Tiroir latéral` et `Modale` indépendamment pour chacun des quatre écrans :
    - `Tâches` : `Tiroir latéral` par défaut ;
    - `Projets` : `Modale` par défaut ;
    - `Notes` : `Tiroir latéral` par défaut ;
    - `Tableaux blancs` : `Modale` par défaut ;
  - Champ numérique `Durée des notifications (secondes)` (`#pref-toast-duration`) : entier entre `1` et `60` secondes (`6` s par défaut) pour la fermeture automatique des notifications de succès et d’information ;
  - Champ numérique `Rétention de la corbeille (jours)` (`#pref-trash-retention`) : entier entre `1` et `365` jours (`30` j par défaut) avant purge automatique définitive au démarrage ;
  - Bouton `Configurer les statuts du Kanban` (`#btn-pref-open-statuses`) ouvrant `#modal-statuses` ;
  - Les préférences applicatives (`activeView`, `taskDisplayMode`, `selectedProjectId`, `selectedNoteId`, `selectedWhiteboardId`, `inputPresentations`, `toastDurationSeconds`, `trashRetentionDays`, `taskStatuses`) sont enregistrées localement dans `IndexedDB` (`meta.preferences`) et conservées lors d’un remplacement de données (sauf `taskStatuses` si l’archive importée fournit sa propre liste).
- **Notifications** : les notifications de succès et d’information se ferment automatiquement après le délai configuré (`6` s par défaut, en pause au survol ou au focus puis reprise à la sortie) ; les alertes d’avertissement et d’erreur restent affichées jusqu’à fermeture manuelle.

## Vue Aujourd’hui

- **En-tête** : titre `Aujourd’hui`, date du jour formatée en français, boutons `Nouvelle tâche`, `Nouvelle note` et `Nouveau tableau blanc` (désactivés en lecture seule ; `Nouvelle tâche` ouvre la création de projet si aucun projet actif n’existe).
- **Indicateurs du jour** (`4` tuiles KPI) : `En retard`, `Pour aujourd’hui`, `Sous 7 jours`, `Priorités hautes` (les tâches archivées ou au statut **Terminal** sont exclues des compteurs d’urgence et d’ouverture).
- **Sections** :
  - `Tâches en retard` : tâches non archivées et non terminales dont `dueDate < aujourd’hui`, avec badge `<n> j de retard` et action `Marquer terminée` (vers le statut terminal par défaut, hors lecture seule) ;
  - `Échéances proches` : tâches non archivées et non terminales dues aujourd’hui (`Aujourd’hui`) ou dans les `7` prochains jours ;
  - `Priorités hautes` : tâches non archivées et non terminales de priorité `Haute` avec statut et date/heure éventuelle ;
  - `Éléments récents` : jusqu’à `8` éléments actifs (tâches, notes, tableaux blancs) triés par `updatedAt` décroissant.

## Vue Tâches en mode Liste

En-tête partagé des vues tâches :

| Contrôle                | Options / comportement                                                                                                         | Valeur par défaut                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Sélecteur de projet     | `Tous les projets`, ou l’un des projets existants (avec suffixe `(archivé)` si archivé)                                        | `Tous les projets` (puis premier projet créé) |
| Mode d’affichage        | `Liste`, `Kanban`                                                                                                              | `Liste`                                       |
| Bouton `Statuts`        | Ouvre la fenêtre `Statuts du Kanban` (`#modal-statuses`) ; désactivé en lecture seule                                          | —                                             |
| Bouton `Nouvelle tâche` | Ouvre la saisie de création (tiroir latéral ou modale selon les préférences) ; désactivé sans projet actif ou en lecture seule | —                                             |

Barre d’ajout rapide, filtres et tableau (`Liste`) :

| Élément             | Valeurs disponibles                                                                       | Comportement                                                                                                                                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ajout rapide        | `#list-quick-add-input` (`Ajout rapide d’une tâche…`), projet cible, `Ajouter rapidement` | Crée une tâche dans le statut filtré (ou le statut initial par défaut) et la priorité filtrée (ou `Moyenne`)                                                                                                                                                                       |
| `Rechercher`        | Texte libre (`Titre, description, checklist`)                                             | Filtre multi-mots insensible à la casse et aux accents sur le titre, la description, les étapes de checklist et les étiquettes                                                                                                                                                     |
| `Statut`            | `Tous les statuts`, statuts configurés, `Sans statut` (`__none__`), `Statut inconnu`      | Filtre exact sur un statut configuré, sur les tâches sans statut (`null`) ou sur les tâches dont l’identifiant de statut ne figure plus dans le Kanban                                                                                                                             |
| `Priorité`          | `Toutes les priorités`, `Haute`, `Moyenne`, `Basse`                                       | Filtre exact sur la priorité                                                                                                                                                                                                                                                       |
| `Étiquette`         | `Toutes les étiquettes` ou `#<nom>`                                                       | Filtre sur les tâches portant l’étiquette sélectionnée                                                                                                                                                                                                                             |
| `Tri`               | `Ordre Kanban`, `Échéance`, `Priorité`                                                    | `Échéance` place les tâches datées avant celles sans date (tri par date puis `dueTime`) ; `Priorité` trie de `Haute` à `Basse`                                                                                                                                                     |
| Colonnes du tableau | `Tâche`, `Projet`, `Statut`, `Priorité`, `Échéance`, `Actions`                            | `Statut` affiche le badge du statut et son badge rôle éventuel (`Initial` / `Terminal`) ; `Échéance` affiche date, heure éventuelle, pastille `18h–7h` et badges `En retard`, `Aujourd’hui`, `Cette semaine` ; `Actions` contient statut rapide, `Ouvrir`, `Archiver`, `Supprimer` |
| Statut non résolu   | Badge d’avertissement `Sans statut` ou `Statut inconnu (<nom>)` + ligne mise en avant     | Identifie visuellement les tâches absentes du Kanban afin que l’utilisateur puisse leur attribuer un statut actif                                                                                                                                                                  |

## Vue Tâches en mode Kanban

- **Colonnes paramétrables** : correspond à `preferences.taskStatuses` (par défaut : `À faire` (`todo`, `Initial`), `En cours` (`in_progress`), `Terminé` (`done`, `Terminal`)). Chaque en-tête affiche le badge de rôle éventuel (`Initial` ou `Terminal`), un compteur, un bouton `+` (ouvrant la création pré-remplie dans la colonne) et une barre d’ajout rapide (`Ajout rapide…` / `Ajouter`).
- **Tâches hors colonnes (`#kanban-unmapped-alert`)** : les tâches `Sans statut` (`status: null`) ou portant un identifiant absent de `preferences.taskStatuses` ne figurent pas dans les colonnes ; lorsqu’il en existe dans le périmètre filtré, un bandeau signale `<n> tâche(s) hors colonnes (sans statut ou à statut inconnu) :` avec ouverture directe et sélecteur `Placer dans une colonne…`.
- **Filtres** : `Rechercher sur le tableau` (`Titre, description, checklist`), `Priorité`, `Échéance` (`Toutes les échéances`, `En retard`, `Aujourd’hui`, `Sous 7 jours`, `Sans échéance`) et `Étiquette` (`Toutes les étiquettes`, `#<nom>`).
- **Contenu d’une carte** : titre cliquable, bouton menu `Actions` (`⋮`), badge de priorité, badge d’échéance (`En retard`, `Aujourd’hui`, `Cette semaine`, supprimé sur statut terminal) et date/heure, badge de récurrence, puces `#<étiquette>`, compteur de liste de contrôle `fait/total` (si non vide), étiquette du nom de projet (uniquement quand `Tous les projets` est sélectionné).
- **Menu d’actions d’une carte** : `Ouvrir les détails`, `Déplacer vers <autre colonne>`, `Monter dans la colonne` (si non première de son projet), `Descendre dans la colonne` (si non dernière de son projet), `Archiver`, `Supprimer` (envoi en corbeille avec confirmation). En lecture seule, seul `Ouvrir les détails` est présent.
- **Récurrence au déplacement** : déplacer une tâche récurrente vers un statut **Terminal** crée une nouvelle tâche sur le statut **Initial** configuré (ou le premier statut) avec `Prochaine occurrence créée`.

## Fenêtre Statuts du Kanban

Accessible depuis le bouton `Statuts` de l’en-tête `Tâches`, depuis `Préférences d’affichage` (`Configurer les statuts du Kanban`) ou via la palette de commandes (`Configurer les statuts du Kanban`).

| Élément                   | Contrainte / comportement                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Liste des statuts         | Jusqu’à `12` statuts ; chaque ligne permet de modifier le libellé (`60` caractères max.), choisir le rôle (`Intermédiaire`, `Initial`, `Terminal`), monter, descendre ou supprimer la colonne |
| `Ajouter un statut`       | Crée un nouveau statut avec identifiant slugifié unique, libellé obligatoire (`60` caractères max.) et rôle (`Intermédiaire`, `Initial` ou `Terminal`)                                        |
| `Valeurs par défaut`      | Restaure les trois statuts par défaut (`À faire` initial, `En cours` intermédiaire, `Terminé` terminal) dans la liste d’édition                                                               |
| Règles Initial / Terminal | `isInitial` et `isTerminal` sont mutuellement exclusifs ; un statut terminal bloque la création de nouveaux liens (sortants et entrants) pour les tâches qui le portent                       |
| Suppression d’une colonne | Ne supprime aucune tâche : les tâches rattachées au statut retiré passent en `Statut inconnu`                                                                                                 |

## Formulaire de tâche (tiroir latéral ou modale)

S’affiche en `Tiroir latéral` par défaut ou en `Modale` selon le réglage de l’écran `Tâches` dans `Préférences d’affichage`.

| Champ               | Type                                                                 | Obligatoire | Limite / défaut                                                                   |
| ------------------- | -------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `Titre`             | Texte                                                                | Oui         | `200` caractères maximum                                                          |
| `Projet`            | Liste déroulante                                                     | Oui         | Projet sélectionné ou premier projet actif                                        |
| `Statut`            | Statuts configurés + `Sans statut` (et badge `Initial`/`Terminal`)   | Non         | Statut initial par défaut (ou statut de la colonne si ajouté via `+` du Kanban)   |
| `Priorité`          | `Basse`, `Moyenne`, `Haute`                                          | Oui         | `Moyenne`                                                                         |
| `Échéance et heure` | Date (`AAAA-MM-JJ`) + heure facultative (`HH:MM`)                    | Non         | Vide (`null`) ou date/heure de la cellule/créneau en création depuis `Calendrier` |
| `Récurrence`        | `Aucune`, `Quotidienne`, `Hebdomadaire`, `Mensuelle`                 | Non         | `Aucune`                                                                          |
| `Étiquettes`        | Saisie + suggestions + puces `#<nom>`                                | Non         | `20` étiquettes max., `40` caractères/étiquette                                   |
| `Éléments liés`     | Sélecteur (`Choisir un élément à lier…`) + rétroliens `Lié depuis :` | Non         | `50` liens internes max. ; ajout désactivé si statut **Terminal**                 |
| `Liste de contrôle` | Étapes à cocher + barre `Modèles de checklist`                       | Non         | `200` caractères par étape ; modèles intégrés + modèles personnels                |
| `Description`       | Éditeur texte enrichi                                                | Non         | Document vide                                                                     |

Actions du pied de fenêtre : `Supprimer` et `Archiver` (en édition hors lecture seule), `Annuler`, `Créer la tâche` / `Enregistrer`.

## Vue Projets

La vue **Projets** affiche exclusivement les projets actifs (les projets archivés sont consultables et filtrables dans la vue **Archives**). La saisie `Nouveau projet` / `Modifier le projet` s’affiche en `Modale` par défaut ou en `Tiroir latéral` selon le réglage de l’écran `Projets` dans `Préférences d’affichage`.

| Élément                 | Contrainte / comportement                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Nom du projet`         | Obligatoire, `120` caractères maximum                                                                                                                       |
| `Description`           | Facultative, `1 000` caractères maximum                                                                                                                     |
| Badges d’état           | `Actif` (projets archivés déplacés dans la vue `Archives`)                                                                                                  |
| Compteurs affichés      | Nombre de tâches, de notes et de tableaux blancs actifs associés                                                                                            |
| Actions par carte       | `Ouvrir les tâches`, `Ouvrir les notes`, `Ouvrir les tableaux blancs`, `Modifier`, `Archiver`, `Supprimer`                                                  |
| Archivage d’un projet   | Masque le projet et ses éléments des vues courantes ; un état vide propose `Ouvrir les archives` et `Créer un projet` si tous les projets sont archivés     |
| Suppression d’un projet | Déplace le projet et ses tâches dans la `Corbeille` locale ; détache ses notes et tableaux blancs (`projectId` devient `null`, visibles dans `Sans projet`) |

## Vue Calendrier

| Élément                  | Valeurs / comportement                                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| En-tête                  | Sélecteur de projet (`Tous les projets` ou projet actif), échelle (`Mois` / `Semaine`), navigation (`Précédent`, `Aujourd’hui`, `Suivant`), `Exporter (.ics)`, `Nouvelle tâche`                                        |
| Légende visuelle         | Distingue **Samedi & dimanche (week-end)** (fond ambré chaud + bordure supérieure accentuée + badge `Week-end`) et **Créneau 18h–7h (soir et nuit)** (fond ardoise frais + rail latéral + icône lune + badge `18h–7h`) |
| Grille `Mois`            | Semaines du lundi au dimanche (`Lun` à `Dim`) ; différenciation visuelle des samedis/dimanches (`data-weekend="true"`), badge `Auj.`, bouton `+` par jour                                                              |
| Grille `Semaine`         | Bandeau jours (`Lun`–`Dim`) + ligne `Sans heure` + `24` créneaux horaires (`00:00` à `23:00`), différenciation `Week-end` et `18h–7h` (`18:00–06:59`, séparateurs à `07:00` et `18:00`), bouton `+` par jour/heure     |
| Carte de tâche           | Clic pour ouvrir le détail, glisser-déposer vers une autre date ou créneau horaire (`Sans heure` ou `HH:00`), boutons rapides `−1 j` / `+1 j`, raccourcis clavier `Alt`/`Maj` + flèches                                |
| Panneau `Sans échéance`  | Liste les tâches actives sans `dueDate` du projet sélectionné, avec glisser-déposer vers la grille ou un créneau horaire et bouton `Planifier aujourd’hui`                                                             |
| Export `Exporter (.ics)` | Génère `locavern-<projet\|echeances>-AAAA-MM-JJ.ics` (`VEVENT` RFC 5545 : `VALUE=DATE` sans heure, `DTSTART`/`DTEND` horodatés sur 1 h avec `dueTime`, tâches archivées exclues)                                       |

## Vue Notes et éditeur enrichi

- **Filtres** : sélecteur de projet (`Toutes les notes`, `Sans projet`, ou un projet actif), sélecteur `Étiquette` (`Toutes les étiquettes`, `#<nom>`), champ `Rechercher titre ou contenu` (filtre multi-mots sur titre, contenu et étiquettes). Les notes archivées (directement ou via leur projet) sont masquées ; tri automatique par date de mise à jour décroissante.
- **Fenêtre de saisie de note (`Nouvelle note` / `Modifier la note`)** : s’affiche en `Tiroir latéral` par défaut ou en `Modale` selon le réglage de l’écran `Notes`. Ouverte par `Nouvelle note`, `Créer une note`, `Ouvrir la saisie` ou `Ctrl+K` → `Créer une note`. Champs : `Titre de la note` (`200` caractères max.), `Projet associé`, `Contenu` (éditeur enrichi). Actions : `Supprimer`, `Archiver`, `Annuler`, `Créer la note` / `Enregistrer`.
- **Espace de travail intégré** : `Titre de la note`, `Projet associé`, éditeur `Étiquettes`, éditeur `Éléments liés` + rétroliens `Lié depuis :`, éditeur Tiptap, barre `Modèles de trame` (`Appliquer`, `Enregistrer comme modèle`, suppression des modèles personnels) et pied de carte (`Ouvrir la saisie`, `Dupliquer` créant `<titre> (copie)`, `Exporter (.md)`, `Archiver` `#btn-archive-note`, `Supprimer`, `Enregistrer`).
- **Barre d’outils de l’éditeur** (partagée avec la description des tâches et le formulaire de saisie) :

| Bouton                             | Action                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `Gras`, `Italique`, `Barré`        | Active/désactive les marques typographiques correspondantes                          |
| `Code en ligne`                    | Active/désactive le style code inline                                                |
| `Titre 1`, `Titre 2`, `Titre 3`    | Bascule entre paragraphe et titre de niveau `h1`, `h2` ou `h3`                       |
| `Liste à puces`, `Liste numérotée` | Liste non ordonnée ou ordonnée                                                       |
| `Liste de contrôle`                | Liste de cases à cocher imbricables                                                  |
| `Lien`                             | Ouvre la barre `Lien (https://)` avec boutons `Appliquer` et `Annuler`               |
| `Insérer une image locale`         | Ouvre le sélecteur de fichier (`image/png`, `image/jpeg`, `image/webp`, `image/gif`) |

- **Indicateur de sauvegarde** : `Modifications en cours` pendant le délai de saisie (`200 ms`), puis `Enregistrée localement`.

## Vue Tableaux blancs et canevas SVG

- **Filtres** : sélecteur de projet (`Tous les tableaux`, `Sans projet`, ou un projet actif), champ `Rechercher titre ou texte du tableau` (filtre sur le titre et les textes des éléments). Les tableaux archivés (directement ou via leur projet) sont masqués ; tri automatique par date de mise à jour décroissante.
- **Fenêtre de saisie (`Nouveau tableau blanc` / `Modifier le tableau blanc`)** : s’affiche en `Modale` par défaut ou en `Tiroir latéral` selon le réglage `Tableaux blancs`. Champs : `Titre du tableau blanc` (`200` caractères max.), `Projet associé`. Actions : `Supprimer`, `Archiver`, `Annuler`, `Créer le tableau blanc` / `Enregistrer`.
- **Espace de travail intégré** : `Titre du tableau blanc`, `Projet associé`, éditeur `Éléments liés` + rétroliens `Lié depuis :`, barre `Modèles de canevas` (`Appliquer`, `Enregistrer comme modèle`, suppression des modèles personnels) et canevas SVG.
- **Barre d’outils du canevas (`Outils du tableau blanc`)** :

| Contrôle                                        | Action                                                                                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Sélectionner`                                  | Sélectionne (`Maj+clic` / `Maj+Espace` multi-sélection), déplace ou effectue un panoramique sur le fond (`Maj+glisser` active une sélection par zone) |
| `Sélection par zone`                            | Trace un rectangle de sélection multi-éléments                                                                                                        |
| `Post-it`, `Rectangle`, `Ellipse`               | Crée une forme au clic ou par glisser-déposer (`500` caractères de texte max.)                                                                        |
| `Flèche`                                        | Crée une flèche orientée avec aimantation aux ancres des formes (`center`, `top`, `right`, `bottom`, `left`)                                          |
| `Texte`, `Tracé libre`                          | Crée un bloc texte ou un tracé à main levée (`2 000` points max. par tracé)                                                                           |
| `Ajouter au centre`                             | Insère l’élément de l’outil actif au centre de la vue (`Post-it` si `Sélectionner`/`Sélection par zone`)                                              |
| `Image locale`                                  | Insère une image locale (`PNG`, `JPEG`, `WebP`, `GIF` ; collage et dépôt également actifs)                                                            |
| Sélecteur de couleur (`5` pastilles)            | `Neutre`, `Accent`, `Succès`, `Avertissement`, `Danger` (tokens sémantiques Covenant)                                                                 |
| `Fond transparent`                              | Active ou désactive le fond transparent (`fill: none`) sur `Post-it`, `Rectangle`, `Ellipse`                                                          |
| `Modifier le texte`                             | Ouvre la barre d’édition de texte de l’élément unique sélectionné                                                                                     |
| `Dupliquer (Ctrl+D)`                            | Duplique la sélection courante avec décalage et remet à zéro les liaisons non incluses                                                                |
| `Avancer d’un niveau`, `Reculer d’un niveau`    | Déplace l’élément unique sélectionné d’un cran vers l’avant ou l’arrière (`zIndex`)                                                                   |
| `Supprimer la sélection`                        | Supprime l’ensemble des éléments sélectionnés                                                                                                         |
| `Annuler (Ctrl+Z)`, `Rétablir (Ctrl+Y)`         | Historique local d’édition (`50` états)                                                                                                               |
| `Afficher la grille d’alignement`               | Affiche ou masque la grille SVG (`20 px`, active par défaut, exclue des exports `.svg`/`.png`)                                                        |
| `Magnétisme sur la grille`                      | Active ou désactive l’aimantation sur la grille (`20 px`) lors de la création et du déplacement                                                       |
| `Zoom -`, `100 %`, `Zoom +`, `Ajuster à la vue` | Ajuste le zoom (`25 %` à `300 %`), réinitialise à `100 %` ou cadre le contenu visible                                                                 |
| `Afficher en taille maximum`                    | Ouvre le canevas et sa barre d’outils en modale occupant toute la zone visible de `#shell-main` (`#dialog-whiteboard-max`)                            |

- **Pied de carte** : indicateur `Enregistré localement` / `Modifications en cours` (délai `200 ms`), boutons `Ouvrir la saisie`, `Exporter SVG`, `Exporter PNG`, `Archiver` (`#btn-archive-whiteboard`), `Supprimer` (envoi en corbeille avec confirmation) et `Enregistrer`.

## Vue Archives

Accessible depuis la barre latérale (`Archives` / `#archives`) ou via `Ctrl+K` → `Aller aux archives`. Regroupe tout élément archivé directement ou rendu archivé par son projet parent (`Projet`, `Tâche`, `Note`, `Tableau blanc`).

| Élément                 | Contrainte / comportement                                                                                                                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filtres et tri          | `Recherche` (`#archives-search-input`), `Type` (`Tous les types`, `Projets`, `Tâches`, `Notes`, `Tableaux blancs`), `Projet` (`Tous les projets`, `Sans projet`, projet concerné), `Étiquette`, `Tri` (`Archivé récemment`, `Modifié récemment`, `Titre (A–Z)`), bouton `Réinitialiser` |
| Liste des archives      | Affiche le badge de type, le badge `Via projet` le cas échéant, le titre, le projet d’origine et la date d’archivage                                                                                                                                                                    |
| Panneau de détail       | Affiche l’origine d’archivage, les métadonnées (`Projet`, `Archivé le`, `Mis à jour le`, contenu associé / statut + rôle / priorité / échéance / étiquettes), l’aperçu et les liens existants (`#archive-detail-panel`)                                                                 |
| `Désarchiver`           | Réactive l’élément sélectionné ; pour une tâche, une note ou un tableau blanc rattaché à un projet archivé, réactive automatiquement aussi ce projet parent                                                                                                                             |
| `Mettre à la corbeille` | Envoie l’élément archivé vers la `Corbeille` locale après confirmation                                                                                                                                                                                                                  |

## Corbeille locale et Sauvegardes

- **Fenêtre `Corbeille locale` (`#modal-trash`)** :
  - Bandeau de rétention (`Rétention configurée : <n> jour(s) avant purge définitive.`), boutons `Configurer le délai` (focus sur `#pref-trash-retention`) et `Vider la corbeille` (avec confirmation) ;
  - Chaque entrée affiche le badge de type (`Projet`, `Tâche`, `Note`, `Tableau blanc`), le titre, le projet d’origine ou le nombre de tâches incluses, la date de suppression, le délai restant (`Purge dans <n> jour(s)` / `Purge imminente`) et les boutons `Restaurer` et `Purger`.
- **Fenêtre `Sauvegardes et stockage` (`#modal-backup`)** :
  - **État du stockage local** : compteurs (`Projets`, `Tâches`, `Notes`, `Tableaux blancs`, `Images locales`), `Espace utilisé`, `Quota estimé`, `Dernière sauvegarde ZIP` (`#stat-last-backup-age`), badge `Stockage persistant` / `Stockage standard` et bouton `Demander la persistance au navigateur` ;
  - **Exporter une archive** : case `Protéger l’archive par un mot de passe (AES-GCM)`, champs `Mot de passe de chiffrement` et `Confirmer le mot de passe` (avec bascule d’affichage), bouton `Exporter l’archive ZIP` ;
  - **Importer une archive** : champ `Fichier de sauvegarde (.zip)`, déverrouillage optionnel par `Mot de passe de l’archive`, sélecteur `Mode d’importation` (`Fusionner tout sans écraser les données locales`, `Importer une sélection de projets sans écraser`, `Remplacer toutes les données locales`) avec cases `Projets à importer` et `Inclure les éléments sans projet` en mode sélectif ;
  - **Réinitialisation locale** : bouton `Effacer toutes les données locales` avec confirmation.

## Palette de commandes et raccourcis clavier

Commandes statiques de la palette (`Ctrl+K` / `Cmd+K`) :

| Libellé                              | Action                                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `Aller à Aujourd’hui`                | Affiche la vue `Aujourd’hui`                                                                                         |
| `Aller aux tâches`                   | Affiche la vue `Tâches`                                                                                              |
| `Aller aux projets`                  | Affiche la vue `Projets`                                                                                             |
| `Aller au calendrier`                | Affiche la vue `Calendrier`                                                                                          |
| `Aller aux notes`                    | Affiche la vue `Notes`                                                                                               |
| `Aller aux tableaux blancs`          | Affiche la vue `Tableaux blancs`                                                                                     |
| `Aller aux archives`                 | Affiche la vue `Archives`                                                                                            |
| `Créer une tâche`                    | Ouvre la saisie `Nouvelle tâche` (ou `Nouveau projet` si aucun projet actif n’existe) ; ignoré en lecture seule      |
| `Créer un projet`                    | Ouvre la saisie `Nouveau projet` ; ignoré en lecture seule                                                           |
| `Créer une note`                     | Ouvre la saisie `Nouvelle note` et affiche la vue `Notes` après création ; ignoré en lecture seule                   |
| `Créer un tableau blanc`             | Ouvre la saisie `Nouveau tableau blanc` et affiche la vue `Tableaux blancs` après création ; ignoré en lecture seule |
| `Configurer les statuts du Kanban`   | Ouvre la fenêtre `Statuts du Kanban` (`#modal-statuses`) ; ignoré en lecture seule                                   |
| `Ouvrir les sauvegardes`             | Ouvre la fenêtre `Sauvegardes et stockage` (`#modal-backup`)                                                         |
| `Ouvrir la corbeille`                | Ouvre la fenêtre `Corbeille locale` (`#modal-trash`)                                                                 |
| `Ouvrir les préférences d’affichage` | Ouvre la fenêtre `Préférences d’affichage` (`#modal-preferences`)                                                    |
| `Basculer le thème clair/sombre`     | Inverse le thème actif et enregistre la préférence                                                                   |

La palette indexe les projets, tâches, notes et tableaux blancs actifs (les éléments archivés directement ou via leur projet sont exclus ; recherche multi-mots insensible aux accents sur titres, descriptions, checklists, étiquettes et textes du tableau blanc ; jusqu’à `60` résultats affichés).

Raccourcis clavier globaux et contextuels :

| Contexte                               | Raccourci                                                     | Effet                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Global                                 | `Ctrl+K` / `Cmd+K`                                            | Ouvre la palette de commandes                                                                                                |
| Modales, tiroirs, palette, menu mobile | `Échap`                                                       | Ferme la fenêtre ou le menu ouvert                                                                                           |
| Palette de commandes                   | `Flèche haut` / `Flèche bas`, `Entrée`                        | Parcourt et exécute l’entrée sélectionnée                                                                                    |
| Carte Kanban focalisée                 | `Alt + Flèche gauche` / `Alt + Flèche droite`                 | Déplace la carte vers la colonne précédente / suivante                                                                       |
| Carte Kanban focalisée                 | `Alt + Flèche haut` / `Alt + Flèche bas`                      | Monte / descend la carte parmi les tâches de son projet dans la colonne                                                      |
| Menu d’actions Kanban ouvert           | `Flèche haut` / `Flèche bas`, `Début`, `Fin`, `Entrée`, `Tab` | Navigue dans les actions, active l’option ou ferme le menu                                                                   |
| Tâche focalisée dans `Calendrier`      | `Alt` ou `Maj + Flèche gauche/droite`                         | Avance ou reporte l’échéance de `1` jour                                                                                     |
| Tâche focalisée dans `Calendrier`      | `Alt` ou `Maj + Flèche haut/bas`                              | Avance ou reporte l’échéance de `7` jours                                                                                    |
| Élément SVG du tableau blanc focalisé  | `Flèches directionnelles` (avec `Maj` pour pas fin `1`)       | Déplace la sélection de `10` unités (`20` si magnétisme actif ; `1` avec `Maj`)                                              |
| Élément SVG du tableau blanc focalisé  | `Alt + Flèches directionnelles`                               | Redimensionne l’élément de `10` unités (`1` avec `Maj`)                                                                      |
| Élément SVG du tableau blanc focalisé  | `Maj + Espace`                                                | Ajoute ou retire l’élément focalisé de la sélection multiple                                                                 |
| Élément SVG du tableau blanc focalisé  | `Page précédente` / `Page suivante`                           | Avance ou recule l’élément d’un niveau dans l’ordre de superposition                                                         |
| Élément SVG du tableau blanc focalisé  | `Entrée` ou `F2`                                              | Ouvre l’éditeur de texte accessible (`sticky`, `rect`, `ellipse`, `text`)                                                    |
| Élément SVG du tableau blanc focalisé  | `Suppr` (`Delete`) ou `Retour arrière`                        | Supprime l’ensemble des éléments sélectionnés                                                                                |
| Tableau blanc actif                    | `Ctrl+A` / `Cmd+A`, `Ctrl+D` / `Cmd+D`                        | Sélectionne tout / duplique la sélection courante                                                                            |
| Tableau blanc actif                    | `Ctrl+Z`, `Ctrl+Y` / `Ctrl+Maj+Z`, `Ctrl + molette`, `Échap`  | Annule, rétablit, zoome, ferme l’édition en cours ou revient à l’outil `Sélectionner` (ou ferme la modale en taille maximum) |
