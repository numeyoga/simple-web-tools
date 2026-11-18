---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-16
---

# Stockage local, format d’archive et messages d’erreur

Spécification factuelle du stockage navigateur, des formats d’export et d’archive, des limites techniques et des messages d’erreur affichés par Locavern (`0.2.0`).

## Sommaire

- [Stockage dans le navigateur](#stockage-dans-le-navigateur)
- [Format des archives ZIP (en clair et chiffrées)](#format-des-archives-zip-en-clair-et-chiffrées)
- [Formats d’export Markdown (.md) et iCalendar (.ics)](#formats-dexport-markdown-md-et-icalendar-ics)
- [Portée des archives et limites techniques](#portée-des-archives-et-limites-techniques)
- [Messages d’avertissement et d’erreur](#messages-davertissement-et-derreur)

## Stockage dans le navigateur

Locavern stocke l’ensemble des données localement sur l’appareil, dans la même origine navigateur :

- **Base `IndexedDB` (`locavern-db`, version `4`)**, composée de `8` magasins d’objets :
  - `meta` : clé `preferences` (préférences d’affichage, vue active, mode Liste/Kanban, sélections courantes, durée des notifications, rétention de la corbeille, colonnes Kanban avec rôles `isInitial`/`isTerminal`) et clé `lastBackupAt` (horodatage ISO de la dernière sauvegarde ZIP enregistrée) ;
  - `projects` : projets (dont `archived` / `archivedAt`) ;
  - `tasks` : tâches, échéances (`dueDate`, `dueTime` optionnel au format `HH:MM`), récurrence, étiquettes, liens internes, listes de contrôle, descriptions et archivage (`archived` / `archivedAt`) ;
  - `notes` : notes enrichies, étiquettes, liens internes et archivage (`archived` / `archivedAt`) ;
  - `whiteboards` : tableaux blancs (titre, projet associé, `viewport`, `elements`, liens internes, `assetIds` et `archived` / `archivedAt`) ;
  - `assets` : métadonnées et données binaires (`Blob`) des images locales ;
  - `trash` : corbeille locale (`TrashItem` avec instantané de l’élément supprimé, date de suppression et date d’expiration) ;
  - `templates` : modèles personnalisés locaux (`LocalTemplate` de checklist, note ou tableau blanc).
- **`localStorage`** : clés `locavern-color-scheme` (`light` ou `dark`, supprimée lorsque le choix correspond au thème système) et `locavern-text-size` (`standard`, `comfortable` ou `large`, supprimée sur `auto`).
- **Verrou multi-onglets** : verrou Web Lock nommé `locavern-write-lock` et canal `BroadcastChannel` nommé `locavern-lock-channel`.
- **Statuts de stockage** :
  - `Stockage persistant` : `navigator.storage.persisted()` retourne `true` ;
  - `Stockage standard` : `navigator.storage.persisted()` retourne `false`.
- **Service Worker (`public/sw.js`)** : cache nommé `locavern-shell-v2` ; le nouveau worker installé reste en attente jusqu’à réception du message `{ type: 'SKIP_WAITING' }` envoyé sur action explicite de l’utilisateur.

## Format des archives ZIP (en clair et chiffrées)

Nom par défaut lors de l’export : `locavern-sauvegarde-AAAA-MM-JJ.zip` (écrit via `window.showSaveFilePicker` si disponible et accepté, sinon par téléchargement `<a download>` ; une annulation du sélecteur natif `AbortError` n’écrit aucun fichier et ne met pas à jour `meta.lastBackupAt`).

### Archive ZIP standard (en clair)

| Entrée          | Rôle                                                                                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json` | Métadonnées d’archive : `format` (`locavern-archive`), `schemaVersion` (`2`), `appVersion` (`0.2.0`), `exportedAt`, compteurs `counts` (`projects`, `tasks`, `notes`, `whiteboards`, `assets`) |
| `data.json`     | Collections JSON : `schemaVersion` (`2`), `exportedAt`, `projects`, `tasks`, `notes`, `whiteboards`, `assets`, `taskStatuses` ; les archives en `schemaVersion: 1` sont migrées à l’import     |
| `assets/<id>`   | Fichiers binaires d’images locales associés aux entrées de `data.json`                                                                                                                         |

### Conteneur chiffré par mot de passe (optionnel)

Lorsqu’un mot de passe est fourni, l’archive ZIP interne (`level: 6`) est chiffrée côté client via l’API Web Crypto (`crypto.subtle`) puis empaquetée dans une enveloppe ZIP (`level: 0`) :

| Paramètre / Entrée      | Spécification                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Dérivation de clé       | `PBKDF2` avec `SHA-256`, `310 000` itérations par défaut (plage acceptée `[100 000 ; 2 000 000]`)                                             |
| Chiffrement authentifié | `AES-256-GCM` (`tagLength: 128`), AAD `locavern-encrypted-archive:v1`                                                                         |
| Paramètres aléatoires   | Sel de `16` octets et vecteur d’initialisation (`iv`) de `12` octets générés via `crypto.getRandomValues`                                     |
| `encryption.json`       | `format` (`locavern-encrypted-archive`), `version` (`1`), `kdf`, `hash`, `iterations`, `cipher`, `keyLength` (`256`), `salt` et `iv` (base64) |
| `payload.enc`           | Octets chiffrés de l’archive ZIP interne complète                                                                                             |

## Formats d’export Markdown (.md) et iCalendar (.ics)

- **Export Markdown d’une note (`src/core/markdown.js`)** :
  - Nom de fichier : `<slug-titre>.md` (`note.md` par défaut) ;
  - En-tête produit : `# <Titre>` et ligne `> Projet : <nom> · Mise à jour : AAAA-MM-JJ` (sans front matter YAML) ;
  - Corps : blocs CommonMark/GFM (`h1` à `h3`, gras, italique, barré, code en ligne, liens, listes à puces, numérotées et de contrôle `- [ ]` / `- [x]`), images locales sérialisées sous la forme `![alt](local-asset://<assetId>)`.
- **Export iCalendar des échéances (`src/core/ical.js`)** :
  - Nom de fichier : `locavern-<slug-projet|echeances>-AAAA-MM-JJ.ics` ;
  - Standard : RFC 5545 (`VCALENDAR` `VERSION:2.0`, `PRODID:-//Locavern//Calendar Export//FR`, `METHOD:PUBLISH`), repli de ligne à `75` octets UTF-8 ;
  - Périmètre : uniquement les tâches non archivées du filtre courant possédant une `dueDate` valide, émises en événements journée entière (`DTSTART;VALUE=DATE`, `DTEND;VALUE=DATE` au lendemain) sans `dueTime` ou en événements horodatés d’une heure (`DTSTART`, `DTEND` locaux, passage minuit géré) avec `dueTime`, `UID:locavern-task-<id>@locavern.local`, `STATUS` (`COMPLETED` sur statut terminal / `CONFIRMED` / `TENTATIVE` sur statut initial), `PRIORITY` (`1` haute / `5` moyenne / `9` basse) et `CATEGORIES` (nom du projet).

## Portée des archives et limites techniques

- **Portée du schéma d’archive `schemaVersion: 2`** :
  - Sont inclus et restaurés par l’import ZIP (`replace`, `merge`, `projects`) : `projects` (`archived`, `archivedAt`), `tasks` (y compris `dueTime`, `archived`, `archivedAt`, `recurrence`, `checklist`, `descriptionDoc`), `notes` (`archived`, `archivedAt`), `whiteboards` (`archived`, `archivedAt`), `assets` et `taskStatuses` (y compris les drapeaux `isInitial` / `isTerminal`). En mode `merge` et `projects`, les identifiants en collision sont réalloués de façon cohérente avec les références entre entités et les `assetIds` ;
  - Ne sont pas transportés par le schéma d’archive `v2` (`src/core/schema.js`) et restent strictement locaux à `IndexedDB` / `localStorage` : les étiquettes (`tags`), les liens internes (`links`), le contenu de la corbeille (`trash`), les modèles personnalisés (`templates`), ainsi que les réglages visuels `localStorage`.

| Élément                                             | Valeur ou contrainte vérifiée                                                                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Version de schéma d’archive                         | `2` (`schemaVersion: 2`, migration transparente depuis `schemaVersion: 1` à l’import)                                                  |
| Version de schéma `IndexedDB`                       | `4` (`DB_VERSION = 4`, `8` objectStores)                                                                                               |
| Formats d’image acceptés                            | `image/png`, `image/jpeg`, `image/webp`, `image/gif` (SVG et images distantes exclus)                                                  |
| Taille maximale par image                           | `5 Mio` (`5 242 880` octets)                                                                                                           |
| Taille maximale d’une archive ZIP (et déchiffrée)   | `25 Mio` (`26 214 400` octets)                                                                                                         |
| Nombre maximal d’enregistrements à l’import         | `10 000` (somme des projets, tâches, notes, tableaux blancs et images)                                                                 |
| Protocoles de lien autorisés dans l’éditeur         | `https://` et `mailto:` uniquement (`target="_blank"`, `rel="noopener noreferrer"`)                                                    |
| Longueur maximale — nom de projet / modèle          | `120` caractères                                                                                                                       |
| Longueur maximale — description de projet           | `1 000` caractères                                                                                                                     |
| Longueur maximale — titre de tâche, note ou tableau | `200` caractères                                                                                                                       |
| Longueur maximale — étape de liste de contrôle      | `200` caractères (`100` étapes max. pour un modèle de checklist)                                                                       |
| Étiquettes (`tags`)                                 | `20` étiquettes max. par tâche ou note, `40` caractères max. par étiquette, dédoublonnées sans casse (`#` retiré)                      |
| Liens internes (`links`)                            | `50` liens max. par entité active (`task`, `note`, `whiteboard`), auto-références ignorées, nouveaux liens bloqués sur statut terminal |
| Modèles personnalisés (`templates`)                 | Les images locales (`localImage` / `image`) sont exclues lors de l’enregistrement                                                      |
| Rétention de la corbeille locale                    | Entier dans `[1 ; 365]` jours (`30` par défaut) ; la purge nettoie les liens devenus invalides et les images orphelines                |
| Durée des notifications (succès / information)      | Entier dans `[1 ; 60]` secondes (`6` par défaut)                                                                                       |
| Colonnes Kanban personnalisées                      | `12` statuts maximum, `60` caractères maximum par libellé (`isInitial` et `isTerminal` mutuellement exclusifs)                         |
| Limites d’un élément de tableau blanc               | Dimensions `[16, 4000]` (`[0, 4000]` pour `arrow`/`path`), texte `500` car., `2 000` points/tracé                                      |
| Limites du viewport et grille de tableau blanc      | `zoom` dans `[0,25 ; 3]`, `panX` et `panY` dans `[-10 000 ; 10 000]`, pas de grille `20 px`, historique `50` états                     |
| Résultats visibles de la palette `Ctrl+K`           | `60` éléments maximum (`MAX_VISIBLE_RESULTS = 60`), éléments archivés exclus                                                           |

## Messages d’avertissement et d’erreur

### Éditeur, tableau blanc, modèles et saisie

| Titre / contexte             | Message affiché                                                                                                                                                          | Cause                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `Mode lecture seule`         | `Impossible d’ajouter une image tant qu’un autre onglet détient le verrou.`                                                                                              | Tentative d’ajout d’image alors qu’un autre onglet détient `locavern-write-lock`                           |
| `Image refusée`              | `Format d’image non pris en charge. Utilisez PNG, JPEG, WebP ou GIF.`                                                                                                    | Type MIME non autorisé (ex. SVG, TIFF, PDF)                                                                |
| `Image refusée`              | `L’image doit être non vide et ne pas dépasser 5 Mio.`                                                                                                                   | Fichier vide (`0` octet) ou supérieur à 5 Mio                                                              |
| `Image distante bloquée`     | `Seules les images locales enregistrées sur cet appareil sont autorisées.`                                                                                               | Collage d’une URL d’image distante ou de HTML contenant `<img src="https://...">` / `<img src="data:...">` |
| `Lien refusé`                | `Seuls les liens https:// et mailto: sont acceptés.`                                                                                                                     | URL invalide ou utilisant un autre protocole (`http://`, `javascript:`, etc.)                              |
| `Échec de l’export SVG`      | `Impossible de générer le fichier SVG.`                                                                                                                                  | Erreur lors de la sérialisation locale du canevas SVG                                                      |
| `Échec de l’export PNG`      | `Impossible de générer l’image PNG.`                                                                                                                                     | Erreur lors du rendu local du SVG vers `<canvas>`                                                          |
| `Échec de l’export Markdown` | `Impossible d’enregistrer le fichier localement.`                                                                                                                        | Erreur d’écriture disque hors annulation utilisateur (`AbortError`)                                        |
| `Aucune tâche datée`         | `Ajoutez une date d’échéance à au moins une tâche pour exporter un fichier .ics.`                                                                                        | Export `.ics` déclenché alors qu’aucune tâche active filtrée n’a d’échéance                                |
| `Échec de l’export .ics`     | `Impossible d’enregistrer le fichier calendrier localement.`                                                                                                             | Erreur d’écriture disque lors de l’export `.ics`                                                           |
| `Liste de contrôle vide`     | `Ajoutez au moins une étape avant d’enregistrer un modèle.`                                                                                                              | Tentative d’enregistrement d’un modèle de checklist sans étape                                             |
| `Canevas vide`               | `Ajoutez au moins une forme, un post-it ou une flèche avant d’enregistrer un modèle.`                                                                                    | Tentative d’enregistrement d’un modèle depuis un tableau blanc sans élément non-image                      |
| Validation modèle (`core`)   | `Le nom du modèle ne peut pas être vide.` / `Le modèle de checklist doit contenir au moins une étape.` / `Le modèle de tableau blanc doit contenir au moins un élément.` | Création de modèle avec nom vide ou contenu vide                                                           |
| Formulaire projet            | `Saisissez un nom de projet non vide.`                                                                                                                                   | Validation du formulaire avec nom vide ou composé uniquement d’espaces                                     |
| Formulaire tâche             | `Saisissez un titre de tâche.`                                                                                                                                           | Validation du formulaire avec titre vide ou composé uniquement d’espaces                                   |
| Formulaire note              | `Saisissez un titre de note.`                                                                                                                                            | Validation de la fenêtre de saisie de note avec titre vide ou composé uniquement d’espaces                 |
| Formulaire tableau blanc     | `Saisissez un titre de tableau blanc.`                                                                                                                                   | Validation de la fenêtre de saisie de tableau blanc avec titre vide ou composé uniquement d’espaces        |
| Préférences d’affichage      | `Durée invalide : valeur hors plage ou non entière. Saisissez un entier entre 1 et 60 secondes.`                                                                         | Saisie hors `[1 ; 60]` ou non entière dans `#pref-toast-duration`                                          |
| Préférences d’affichage      | `Délai invalide : saisissez un entier entre 1 et 365 jours.`                                                                                                             | Saisie hors `[1 ; 365]` ou non entière dans `#pref-trash-retention`                                        |

### Verrou multi-onglets, corbeille et persistance

| Titre / contexte          | Message affiché                                                                                                                                              | Cause                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Bandeau supérieur         | `Mode lecture seule actif. Un autre onglet détient le verrou d’écriture sur la base locale. Fermez l’autre onglet puis réessayez pour modifier vos données.` | Un autre onglet ou fenêtre installée détient déjà le verrou d’écriture           |
| `Verrou toujours actif`   | `Un autre onglet utilise encore Locavern en écriture.`                                                                                                       | Clic sur `Reprendre l’édition` alors que l’autre onglet est toujours ouvert      |
| `Restauration impossible` | `Restaurez d’abord le projet associé avant de restaurer cette tâche.` (ou `L’élément demandé est introuvable dans la corbeille.`)                            | Tentative de restauration d’une tâche alors que son projet parent reste supprimé |
| `Erreur de persistance`   | `Impossible d’enregistrer la modification dans IndexedDB.`                                                                                                   | Échec d’écriture dans `IndexedDB` (ex. quota dépassé)                            |

### Import, export et chiffrement des archives ZIP

| Message affiché                                                                                                         | Cause                                                                            |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `Saisissez un mot de passe pour chiffrer l’archive.`                                                                    | Option `Protéger l’archive par un mot de passe (AES-GCM)` cochée avec champ vide |
| `Les deux mots de passe ne correspondent pas.`                                                                          | Différence entre `Mot de passe de chiffrement` et `Confirmer le mot de passe`    |
| `Saisissez le mot de passe pour déverrouiller cette archive.`                                                           | Soumission d’un mot de passe vide lors du déverrouillage                         |
| `Sélectionnez au moins un projet ou les éléments sans projet.`                                                          | Import en mode `Importer une sélection de projets sans écraser` sans case cochée |
| `Échec de l’export` / `Impossible de générer l’archive ZIP depuis IndexedDB. Réessayez.`                                | Erreur lors de la lecture des `Blob`, du chiffrement ou de l’écriture du ZIP     |
| `Impossible d’importer l’archive. Le fichier est vide.`                                                                 | Fichier sélectionné de taille `0`                                                |
| `Impossible d’importer l’archive. Le fichier dépasse la limite de 25 Mio.`                                              | Fichier ZIP supérieur à `25 Mio`                                                 |
| `Impossible d’ouvrir l’archive. Le fichier ZIP est corrompu ou invalide.`                                               | Fichier non ZIP ou archive endommagée                                            |
| `Métadonnées de chiffrement illisibles dans l’archive.` / `Métadonnées de chiffrement invalides.`                       | JSON invalide ou structure incorrecte dans `encryption.json`                     |
| `Format de chiffrement non reconnu. Ce fichier n’est pas une archive chiffrée Locavern.`                                | Champ `format` différent de `locavern-encrypted-archive`                         |
| `Version de chiffrement non prise en charge (<v>).`                                                                     | Version d’enveloppe chiffrée différente de `1`                                   |
| `Paramètres cryptographiques non pris en charge dans l’archive.`                                                        | Algorithme différent de `PBKDF2` / `SHA-256` / `AES-GCM` (`256` bits)            |
| `Nombre d’itérations PBKDF2 invalide dans l’archive chiffrée.`                                                          | `iterations` hors plage `[100 000 ; 2 000 000]`                                  |
| `Sel ou vecteur d’initialisation manquant dans l’archive.` / `Sel ou vecteur d’initialisation corrompu dans l’archive.` | `salt` ou `iv` absent, mal encodé ou de longueur invalide (`16` / `12` octets)   |
| `Archive chiffrée incomplète. Le fichier payload.enc est manquant.`                                                     | Présence de `encryption.json` sans `payload.enc`                                 |
| `Données chiffrées manquantes ou corrompues dans l’archive.`                                                            | Charge utile `payload.enc` vide ou inférieure à la taille minimale du tag GCM    |
| `Cette archive est protégée par mot de passe.`                                                                          | Archive chiffrée ouverte sans mot de passe fourni (affiche le panneau dédié)     |
| `Mot de passe incorrect ou archive endommagée.`                                                                         | Échec d’authentification `AES-GCM` au déchiffrement                              |
| `L’API Web Crypto est indisponible dans ce navigateur.`                                                                 | Contexte sans `crypto.subtle` disponible                                         |
| `L’archive déchiffrée dépasse la limite autorisée de 25 Mio.`                                                           | Archive ZIP interne déchiffrée supérieure à `25 Mio`                             |
| `Archive déchiffrée invalide ou corrompue.`                                                                             | Contenu déchiffré impossible à ouvrir comme archive ZIP                          |
| `Archive incomplète. Les fichiers manifest.json et data.json sont requis.`                                              | Absence d’un des deux fichiers JSON à la racine du ZIP                           |
| `Impossible de lire les données. Le contenu JSON de l’archive est invalide.`                                            | JSON syntaxiquement invalide dans `manifest.json` ou `data.json`                 |
| `Impossible d’importer l’archive. Le fichier manifest.json est invalide.`                                               | Structure du manifeste incorrecte                                                |
| `Archive non reconnue. Ce fichier n’est pas une sauvegarde Locavern.`                                                   | Champ `format` différent de `locavern-archive`                                   |
| `Version d’archive non prise en charge (<v>).`                                                                          | `schemaVersion` absent ou supérieur à `2` dans `manifest.json`                   |
| `Cette sauvegarde utilise une version de schéma future (<v>) non supportée par cette version de Locavern.`              | `schemaVersion` supérieur à `2` dans `data.json`                                 |
| `La sauvegarde dépasse la limite de 10000 enregistrements.`                                                             | Nombre total d’éléments supérieur au plafond de sécurité                         |
| `Données de projet invalides ou dupliquées dans la sauvegarde.`                                                         | Projet mal formé ou identifiant en double                                        |
| `Données de tâche invalides ou rattachées à un projet inexistant.`                                                      | Tâche mal formée, dupliquée ou orpheline                                         |
| `Données de note invalides ou rattachées à un projet inexistant.`                                                       | Note mal formée, dupliquée ou liée à un `projectId` absent                       |
| `Données de tableau blanc invalides ou rattachées à un projet inexistant.`                                              | Tableau blanc mal formé, dupliqué ou lié à un `projectId` absent                 |
| `Métadonnées d’image invalides ou type MIME non autorisé dans la sauvegarde.`                                           | Entrée `assets` incohérente ou format non autorisé                               |
| `Image manquante dans l’archive (<nom>). Restauration annulée.`                                                         | Binaire absent sous `assets/<id>` pour une image référencée                      |
| `Taille de fichier invalide pour l’image <nom>.`                                                                        | Image vide ou supérieure à `5 Mio` dans l’archive                                |
| `L’archive dépasse la taille totale maximale autorisée (25 Mio).`                                                       | Somme des binaires décompressés supérieure à `25 Mio`                            |
