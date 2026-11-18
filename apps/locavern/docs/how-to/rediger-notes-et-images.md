---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-16
---

# Comment rédiger des notes avec mise en forme et images locales

Ce guide explique comment créer, filtrer, dupliquer, archiver, exporter en Markdown, mettre en forme et illustrer vos notes dans Locavern. Pour associer des étiquettes, créer des liens internes ou utiliser des trames préremplies, consultez [Comment organiser votre travail avec étiquettes, liens et modèles](organiser-avec-etiquettes-liens-et-modeles.md). Les règles détaillées de validation des images et des liens sont listées dans [Stockage local, format d’archive et messages d’erreur](../reference/stockage-limites-et-erreurs.md).

## Sommaire

- [Créer, filtrer, dupliquer, archiver et supprimer une note](#créer-filtrer-dupliquer-archiver-et-supprimer-une-note)
- [Mettre en forme le texte et insérer des liens](#mettre-en-forme-le-texte-et-insérer-des-liens)
- [Insérer des images locales](#insérer-des-images-locales)
- [Exporter une note en Markdown (.md)](#exporter-une-note-en-markdown-md)
- [Comprendre la sauvegarde automatique](#comprendre-la-sauvegarde-automatique)

## Créer, filtrer, dupliquer, archiver et supprimer une note

Ouvrez la vue **Notes** depuis la barre de navigation latérale.

- **Créer une note** : cliquez sur **Nouvelle note** (ou **Créer une note** si la liste est vide, ou lancez **Créer une note** via `Ctrl+K`), renseignez le **Titre de la note** et éventuellement le **Projet associé** et le **Contenu**, puis cliquez sur **Créer la note**. La fenêtre s’ouvre en tiroir latéral par défaut ou en modale selon le réglage choisi dans **Préférences d’affichage** (**Visuel de saisie par écran**).
- **Modifier dans la fenêtre de saisie ou directement** : sélectionnez la note pour éditer directement dans l’espace intégré, ou cliquez sur **Ouvrir la saisie** dans l’en-tête pour la modifier dans la fenêtre de saisie configurée.
- **Associer ou détacher un projet** : dans l’en-tête de l’éditeur (ou la fenêtre de saisie), changez le menu **Projet associé** pour choisir un projet actif ou **Sans projet**.
- **Filtrer et rechercher** : utilisez le sélecteur de projet (**Toutes les notes**, **Sans projet** ou un projet actif), le sélecteur **Étiquette** (**Toutes les étiquettes** ou `#<nom>`) et le champ **Rechercher titre ou contenu** (recherche multi-mots sur le titre, le corps et les étiquettes). Les notes sont classées de la plus récemment modifiée à la plus ancienne.
- **Dupliquer une note** : cliquez sur **Dupliquer** en pied de carte pour créer une copie nommée `<titre> (copie)` conservant le contenu, les étiquettes et les images associées.
- **Archiver une note** : cliquez sur **Archiver** en pied de carte (ou dans la fenêtre de saisie). La note quitte la vue **Notes** et rejoint l’écran **Archives**, d’où vous pouvez la filtrer, la désarchiver ou la mettre à la corbeille.
- **Placer une note dans la corbeille locale** : cliquez sur **Supprimer** en pied de carte (ou dans la fenêtre de saisie), puis confirmez avec **Supprimer la note**. La note reste récupérable depuis la **Corbeille** pendant le délai configuré (voir [Comment sauvegarder, restaurer ou effacer vos données](sauvegarder-et-restaurer.md#récupérer-ou-purger-depuis-la-corbeille-locale)).

## Mettre en forme le texte et insérer des liens

La barre d’outils située au-dessus de la zone de texte propose les commandes suivantes (utilisables également dans la **Description** d’une tâche et dans la fenêtre de saisie d’une note) :

- **Gras**, **Italique**, **Barré**, **Code en ligne** ;
- **Titre 1**, **Titre 2**, **Titre 3** ;
- **Liste à puces**, **Liste numérotée** et **Liste de contrôle** (cases à cocher interactives).

Pour ajouter ou modifier un lien :

1. Sélectionnez le texte à transformer en lien, puis cliquez sur le bouton **Lien** dans la barre d’outils.
2. Dans la barre qui s’ouvre, saisissez une adresse commençant par `https://` ou `mailto:`.
3. Cliquez sur **Appliquer**.

Pour retirer un lien existant, placez le curseur sur le lien, ouvrez la barre **Lien**, videz le champ d’adresse et cliquez sur **Appliquer**. Les adresses utilisant d’autres protocoles (comme `http://` ou `javascript:`) sont refusées et déclenchent une notification d’avertissement.

## Insérer des images locales

Vous pouvez joindre des images stockées sur votre ordinateur au format **PNG**, **JPEG**, **WebP** ou **GIF** (taille maximale de **5 Mio** par image). Trois méthodes sont disponibles :

- Cliquer sur le bouton **Insérer une image locale** dans la barre d’outils et sélectionner un fichier ;
- Coller une image depuis le presse-papiers dans la zone d’écriture ;
- Glisser-déposer un fichier image depuis votre gestionnaire de fichiers dans l’éditeur.

L’image est copiée dans la base locale de votre navigateur (`IndexedDB`) et incluse lors des exports ZIP.

Si vous tentez de coller une URL d’image distante (`https://…`) ou du HTML contenant une image externe, Locavern bloque l’insertion et affiche l’alerte **Image distante bloquée**. Enregistrez d’abord l’image sur votre appareil, puis insérez le fichier local.

## Exporter une note en Markdown (.md)

Pour récupérer une copie portable d’une note au format texte Markdown :

1. Ouvrez la note à exporter dans la vue **Notes**.
2. Cliquez sur **Exporter (.md)** dans le pied de la carte.
3. Enregistrez le fichier `.md` proposé via le sélecteur natif ou le téléchargement du navigateur.

Le fichier produit débute par le titre `# <Titre>` et la mention `> Projet : … · Mise à jour : AAAA-MM-JJ`, suivis du contenu en Markdown (`h1` à `h3`, mises en forme, listes à cocher `- [ ]` / `- [x]`, liens et références d’images locales `local-asset://<id>`).

## Comprendre la sauvegarde automatique

Chaque frappe dans le titre ou le corps de la note depuis l’éditeur intégré déclenche un enregistrement automatique après une courte pause (environ 200 ms) : l’indicateur en bas à gauche passe de **Modifications en cours** à **Enregistrée localement**. Le changement de projet associé, d’étiquette ou de lien interne enregistre immédiatement.

Vous pouvez également cliquer sur **Enregistrer** à tout moment pour forcer une sauvegarde immédiate avec une notification de confirmation.

Attention : le champ **Titre de la note** ne peut pas rester vide ; si vous l’effacez entièrement dans l’éditeur intégré, le titre précédent est conservé lors de l’enregistrement.
