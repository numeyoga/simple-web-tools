---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-15
---

# Créer votre premier espace de travail

Dans ce tutoriel, nous allons créer votre premier projet dans Locavern, y ajouter une tâche avec une liste de contrôle, la faire avancer sur le tableau Kanban, rédiger une note associée, esquisser un tableau blanc et exporter une sauvegarde ZIP. Toutes les données restent enregistrées localement dans votre navigateur.

## Sommaire

- [1. Créer un premier projet](#1-créer-un-premier-projet)
- [2. Ajouter une tâche détaillée](#2-ajouter-une-tâche-détaillée)
- [3. Faire avancer la tâche en vue Kanban](#3-faire-avancer-la-tâche-en-vue-kanban)
- [4. Rédiger une note associée](#4-rédiger-une-note-associée)
- [5. Esquisser un tableau blanc associé](#5-esquisser-un-tableau-blanc-associé)
- [6. Exporter votre première sauvegarde ZIP](#6-exporter-votre-première-sauvegarde-zip)
- [Pour aller plus loin](#pour-aller-plus-loin)

## 1. Créer un premier projet

Ouvrez Locavern dans votre navigateur. Lors de la première utilisation, la vue **Tâches** s’affiche avec le message « Créez un premier projet pour commencer ».

1. Cliquez sur **Créer un projet**. La fenêtre **Nouveau projet** s’ouvre.
2. Dans le champ **Nom du projet**, saisissez `Rénovation bureau`.
3. Dans le champ **Description**, saisissez `Aménagement et suivi du matériel`.
4. Cliquez sur **Créer le projet**.

Une notification « Projet créé » apparaît en bas de l’écran. Le sélecteur de projet en haut à gauche affiche `Rénovation bureau` et la vue indique « Aucune tâche trouvée ».

## 2. Ajouter une tâche détaillée

1. Cliquez sur **Nouvelle tâche**. Le tiroir latéral **Nouvelle tâche** s’ouvre à droite.
2. Dans **Titre**, saisissez `Commander le bureau`.
3. Dans **Priorité**, sélectionnez `Haute`.
4. Dans **Échéance**, choisissez la date `2026-12-01`.
5. Sous **Liste de contrôle**, saisissez `Comparer trois modèles` dans le champ **Ajouter une étape**, puis cliquez sur **Ajouter**. L’étape apparaît au-dessus avec une case à cocher.
6. Dans la zone **Description**, cliquez dans le champ texte et tapez `Privilégier un plateau de 160 cm.`
7. Cliquez sur **Créer la tâche**.

Une notification « Tâche créée » s’affiche et le tiroir se ferme. Le tableau des tâches contient maintenant une ligne pour `Commander le bureau` avec le statut `À faire`, la priorité `Haute` et l’échéance `2026-12-01`.

## 3. Faire avancer la tâche en vue Kanban

1. Dans l’en-tête de la vue **Tâches**, cliquez sur **Kanban** dans le sélecteur de mode d’affichage.
2. Trois colonnes apparaissent : **À faire** (compteur `1`), **En cours** (`0`) et **Terminé** (`0`).
3. Sur la carte `Commander le bureau`, cliquez sur le bouton menu (**⋮**) en haut à droite de la carte.
4. Cliquez sur **Déplacer vers En cours**.

La carte passe dans la colonne **En cours**, dont le compteur passe à `1`, tandis que **À faire** revient à `0`.

## 4. Rédiger une note associée

1. Dans la barre de navigation latérale à gauche, cliquez sur **Notes**. L’écran affiche « Aucune note disponible ».
2. Cliquez sur **Créer une note**. Le tiroir latéral **Nouvelle note** s’ouvre avec `Rénovation bureau` présélectionné dans **Projet associé**.
3. Dans **Titre de la note**, saisissez `Dimensions du bureau`.
4. Dans la zone **Contenu**, cliquez dans le champ texte sous la barre d’outils et saisissez `Largeur disponible : 180 cm.`
5. Cliquez sur **Créer la note**.

Une notification « Note créée » apparaît et le tiroir se ferme. La note `Dimensions du bureau` est sélectionnée dans la liste à gauche et ouverte dans l’éditeur intégré, avec le statut `Enregistrée localement`.

## 5. Esquisser un tableau blanc associé

1. Dans la barre de navigation latérale, cliquez sur **Tableaux blancs**. L’écran affiche « Aucun tableau blanc disponible ».
2. Cliquez sur **Créer un tableau blanc**. La fenêtre **Nouveau tableau blanc** s’ouvre avec `Rénovation bureau` présélectionné dans **Projet associé**.
3. Dans **Titre du tableau blanc**, saisissez `Plan d’implantation`.
4. Cliquez sur **Créer le tableau blanc**. Le canevas du tableau `Plan d’implantation` s’affiche.
5. Dans la barre d’outils du canevas, sélectionnez **Post-it**, puis cliquez sur **Ajouter au centre**.
6. Appuyez sur `Entrée` ou `F2` sur le Post-it sélectionné, remplacez le texte par `Bureau 160 cm près de la fenêtre`, puis cliquez sur **Valider**.

Le statut en bas à gauche affiche `Enregistré localement`.

## 6. Exporter votre première sauvegarde ZIP

1. Dans la barre supérieure, cliquez sur **Sauvegarder**. La fenêtre **Sauvegardes et stockage** s’ouvre.
2. Sous **État du stockage local**, vérifiez les compteurs : `1` projet, `1` tâche, `1` note et `1` tableau blanc.
3. Sous **Exporter une archive**, cliquez sur **Exporter l’archive ZIP**.

Une notification « Archive exportée » confirme l’opération et votre navigateur enregistre un fichier nommé `locavern-sauvegarde-AAAA-MM-JJ.zip`.

## Pour aller plus loin

- Pour gérer le tri, les filtres, le glisser-déposer et l’archivage des projets : [Comment organiser vos projets et vos tâches](../how-to/organiser-projets-et-taches.md).
- Pour piloter vos échéances quotidiennes, le calendrier et les tâches récurrentes : [Comment planifier votre journée et votre calendrier](../how-to/planifier-journee-et-calendrier.md).
- Pour classer par étiquettes transversales, relier des éléments et réutiliser des modèles : [Comment organiser votre travail avec étiquettes, liens et modèles](../how-to/organiser-avec-etiquettes-liens-et-modeles.md).
- Pour mettre en forme vos notes, les exporter en Markdown et y insérer des images locales : [Comment rédiger des notes avec mise en forme et images locales](../how-to/rediger-notes-et-images.md).
- Pour maîtriser les outils, l’aimantation et l’export SVG/PNG du tableau blanc : [Comment utiliser le tableau blanc](../how-to/utiliser-le-tableau-blanc.md).
- Pour comprendre où sont conservées vos données : [Fonctionnement local, confidentialité et périmètre](../explanation/fonctionnement-local-et-confidentialite.md).
