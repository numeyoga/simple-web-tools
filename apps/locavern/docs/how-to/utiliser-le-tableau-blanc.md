---
version: '0.2.0'
cree_le: 2026-11-14
mis_a_jour_le: 2026-11-16
---

# Comment utiliser le tableau blanc

Ce guide explique comment créer et archiver un tableau blanc, sélectionner par zone et dupliquer des éléments, aimanter les flèches et la grille, manipuler les formes à la souris ou au clavier, insérer des images locales et exporter votre schéma au format SVG ou PNG. Pour associer des liens internes ou appliquer un modèle de canevas, consultez [Comment organiser votre travail avec étiquettes, liens et modèles](organiser-avec-etiquettes-liens-et-modeles.md). Les raccourcis complets et les limites de données sont regroupés dans [Interface, vues et raccourcis clavier](../reference/interface-et-raccourcis.md) et [Stockage local, format d’archive et messages d’erreur](../reference/stockage-limites-et-erreurs.md).

## Sommaire

- [Créer, filtrer, archiver et supprimer un tableau blanc](#créer-filtrer-archiver-et-supprimer-un-tableau-blanc)
- [Ajouter, sélectionner par zone, dupliquer et modifier des éléments](#ajouter-sélectionner-par-zone-dupliquer-et-modifier-des-éléments)
- [Aimanter les flèches, afficher la grille et gérer les couches](#aimanter-les-flèches-afficher-la-grille-et-gérer-les-couches)
- [Utiliser le tableau blanc uniquement au clavier](#utiliser-le-tableau-blanc-uniquement-au-clavier)
- [Insérer une image locale](#insérer-une-image-locale)
- [Naviguer, annuler et exporter en SVG ou PNG](#naviguer-annuler-et-exporter-en-svg-ou-png)

## Créer, filtrer, archiver et supprimer un tableau blanc

Ouvrez la vue **Tableaux blancs** depuis la barre de navigation latérale (ou via `Ctrl+K` puis **Aller aux tableaux blancs**).

- **Créer un tableau blanc** : cliquez sur **Nouveau tableau blanc** (ou **Créer un tableau blanc** si la liste est vide, ou lancez **Créer un tableau blanc** via `Ctrl+K`), saisissez le **Titre du tableau blanc** et choisissez éventuellement le **Projet associé**, puis cliquez sur **Créer le tableau blanc**. La fenêtre s’ouvre en modale par défaut ou en tiroir latéral selon le réglage choisi dans **Préférences d’affichage** (**Visuel de saisie par écran**).
- **Renommer et associer à un projet** : modifiez directement **Titre du tableau blanc** et **Projet associé** dans l’en-tête du tableau, ou cliquez sur **Ouvrir la saisie** pour modifier ces informations dans la fenêtre de saisie configurée.
- **Filtrer et rechercher** : utilisez le menu déroulant en haut à gauche (**Tous les tableaux**, **Sans projet** ou un projet actif) et le champ **Rechercher titre ou texte du tableau** (recherche sur le titre du tableau et le texte des éléments).
- **Archiver un tableau blanc** : cliquez sur **Archiver** en pied de carte (ou dans la fenêtre de saisie). Le tableau quitte la vue **Tableaux blancs** et rejoint l’écran **Archives**, d’où vous pouvez le désarchiver ou le placer à la corbeille.
- **Placer un tableau blanc dans la corbeille locale** : cliquez sur **Supprimer** en pied de carte (ou dans la fenêtre de saisie), puis confirmez avec **Supprimer le tableau blanc**. Le tableau reste récupérable depuis la **Corbeille** pendant le délai configuré (voir [Comment sauvegarder, restaurer ou effacer vos données](sauvegarder-et-restaurer.md#récupérer-ou-purger-depuis-la-corbeille-locale)).

## Ajouter, sélectionner par zone, dupliquer et modifier des éléments

La barre d’outils au-dessus du canevas propose huit outils. **L’outil choisi reste actif jusqu’à ce que vous en sélectionniez un autre** (ou appuyiez sur `Échap`), afin de pouvoir tracer plusieurs formes d’affilée :

1. **Sélectionner** : cliquez sur un élément pour le sélectionner, faites-le glisser pour le déplacer, double-cliquez pour éditer son texte, ou glissez sur le fond pour déplacer la vue. Maintenez `Maj` et glissez sur le canevas pour tracer un rectangle de sélection sans quitter l’outil **Sélectionner**.
2. **Sélection par zone** : tracez un rectangle englobant sur le canevas pour sélectionner plusieurs éléments d’un seul geste.
3. **Post-it**, **Rectangle**, **Ellipse**, **Flèche**, **Texte** : sélectionnez l’outil, puis cliquez une fois sur le canevas pour créer l’élément à la taille standard, ou cliquez-glissez pour choisir ses dimensions.
4. **Tracé libre** : cliquez-glissez sur le canevas pour dessiner à main levée autant de traits que nécessaire.

Pour travailler sur une sélection multiple ou dupliquer rapidement :

- **Ajouter ou retirer un élément de la sélection** : utilisez `Maj+clic` (ou `Maj+Espace` au clavier) sur un élément.
- **Tout sélectionner** : appuyez sur `Ctrl+A` (ou `Cmd+A` sur macOS) lorsque le focus est sur le canevas.
- **Déplacer ou supprimer un groupe** : faites glisser l’un des éléments sélectionnés ou appuyez sur `Suppr` (ou cliquez sur **Supprimer la sélection**) pour agir sur l’ensemble de la sélection.
- **Dupliquer** : sélectionnez un ou plusieurs éléments puis cliquez sur **Dupliquer (Ctrl+D)** ou appuyez sur `Ctrl+D` (`Cmd+D`) pour créer une copie décalée.

Pour changer la couleur d’un élément ou des éléments suivants, sélectionnez l’une des cinq pastilles de couleur (`Neutre`, `Accent`, `Succès`, `Avertissement`, `Danger`).

Pour modifier le texte d’un **Post-it**, d’un **Rectangle**, d’une **Ellipse** ou d’un bloc **Texte** :

- Passez sur **Sélectionner**, puis double-cliquez sur l’élément (ou sélectionnez-le et cliquez sur **Modifier le texte**) ;
- Saisissez votre texte dans la barre d’édition (jusqu’à 500 caractères ; `Maj+Entrée` insère un retour à la ligne) ;
- Validez avec **Valider** (ou `Entrée`).

## Aimanter les flèches, afficher la grille et gérer les couches

- **Aimanter une flèche à des formes** : lorsque vous tracez une **Flèche** ou faites glisser l’une de ses poignées d’extrémité près d’un **Post-it**, **Rectangle**, **Ellipse**, bloc **Texte** ou **Image locale**, des ancres d’aimantation apparaissent (`centre` et 4 bords) ; relâchez pour lier l’extrémité à la forme. Tant que la liaison reste active, la flèche suit automatiquement le déplacement ou le redimensionnement de la forme reliée.
- **Afficher la grille et activer le magnétisme** : dans la barre d’outils, activez ou masquez **Afficher la grille d’alignement** (visible par défaut, exclue des exports `.svg`/`.png`) et basculez **Magnétisme sur la grille** pour aligner créations et déplacements sur une grille de `20 px` (`Maj+Flèches` au clavier conserve un pas fin de `1` unité même lorsque le magnétisme est actif).
- **Changer l’ordre de superposition d’un niveau à la fois** : sélectionnez l’élément puis cliquez sur **Avancer d’un niveau** (`Page précédente`) ou sur **Reculer d’un niveau** (`Page suivante`).
- **Rendre le fond transparent** : activez **Fond transparent** (icône damier) avant de dessiner un **Rectangle**, une **Ellipse** ou un **Post-it**, ou après avoir sélectionné un élément existant pour retirer ou rétablir son remplissage. Seule la bordure colorée reste visible et cliquable.

## Utiliser le tableau blanc uniquement au clavier

Toutes les opérations de création, de sélection et d’édition fonctionnent sans glisser-déposer ni souris :

- **Créer un élément sans glisser** : sélectionnez un outil de forme dans la barre d’outils, puis activez **Ajouter au centre** (ou appuyez sur `Entrée` sur un outil déjà actif) pour placer l’élément de cet outil au centre de la zone visible (si **Sélectionner** ou **Sélection par zone** est actif, **Ajouter au centre** insère un **Post-it**).
- **Naviguer et sélectionner** : utilisez `Tab` pour parcourir chaque élément du canevas SVG, `Maj+Espace` pour basculer l’ajout d’un élément à la sélection courante et `Ctrl+A` / `Cmd+A` pour tout sélectionner.
- **Déplacer la sélection** : utilisez les flèches directionnelles (`10` unités par défaut ou pas de `20 px` si le magnétisme sur la grille est actif ; `Maj + Flèches` pour un pas fin de `1` unité).
- **Redimensionner l’élément focalisé** : utilisez `Alt + Flèches` (`10` unités, ou `Alt + Maj + Flèches` pour `1` unité).
- **Modifier la superposition** : appuyez sur `Page précédente` (`PageUp`) pour avancer d’un niveau ou `Page suivante` (`PageDown`) pour reculer d’un niveau.
- **Dupliquer** : appuyez sur `Ctrl+D` (`Cmd+D`).
- **Éditer le texte** : appuyez sur `Entrée` ou `F2` sur l’élément sélectionné.
- **Supprimer la sélection** : appuyez sur `Suppr` (`Delete`) ou `Retour arrière` (`Backspace`).
- **Revenir à Sélectionner** : appuyez sur `Échap` lorsque vous utilisez un outil de dessin.

## Insérer une image locale

Locavern accepte les images locales aux formats **PNG**, **JPEG**, **WebP** et **GIF** (jusqu’à **5 Mio** par image) :

- Cliquez sur **Image locale** dans la barre d’outils du tableau blanc et choisissez un fichier ;
- Ou collez directement un fichier image (`Ctrl+V`) ou glissez-déposez-le sur le canevas.

Les images distantes (`https://…`) collées depuis le presse-papiers sont bloquées et déclenchent l’avertissement **Image distante bloquée**. Les fichiers ajoutés sont copiés dans `IndexedDB` et inclus dans les archives ZIP.

## Naviguer, annuler et exporter en SVG ou PNG

- **Historique d’édition** : cliquez sur **Annuler (Ctrl+Z)** (`Ctrl+Z`) ou **Rétablir (Ctrl+Y)** (`Ctrl+Y` / `Ctrl+Maj+Z`).
- **Zoom, ajustement et panoramique** : utilisez **Zoom -**, **100 %**, **Zoom +** et **Ajuster à la vue** dans la barre d’outils, ou `Ctrl + molette` au-dessus du canevas. Avec l’outil **Sélectionner**, glissez sur une zone vide pour déplacer le canevas.
- **Afficher en taille maximum** : cliquez sur **Afficher en taille maximum** à droite de la barre d’outils pour agrandir le canevas et ses outils en modale sur toute la zone visible du contenu principal. Appuyez sur `Échap`, cliquez en dehors de la fenêtre, cliquez sur **Fermer** ou cliquez à nouveau sur le bouton pour revenir à la vue normale sans perdre votre sélection ni l’historique.
- **Sauvegarde automatique** : toute modification est enregistrée localement après `200 ms` (`Enregistré localement`). Cliquez sur **Enregistrer** pour forcer une sauvegarde immédiate.
- **Exporter une image** : cliquez sur **Exporter SVG** pour télécharger un fichier `.svg` autonome (couleurs résolues selon le thème actif, fonds transparents conservés et images locales embarquées, sans la grille ni les cadres de sélection) ou sur **Exporter PNG** pour générer un fichier `.png` localement dans votre navigateur.
