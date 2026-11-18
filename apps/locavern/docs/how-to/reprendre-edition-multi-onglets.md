---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-16
---

# Comment reprendre l’édition en présence de plusieurs onglets

Locavern n’autorise l’écriture que dans un seul onglet à la fois afin d’éviter les conflits sur votre base locale. Si vous ouvrez un deuxième onglet sur le même navigateur, un bandeau d’alerte **Mode lecture seule actif** s’affiche en haut de la page.

## Sommaire

- [Ce qui reste disponible en lecture seule](#ce-qui-reste-disponible-en-lecture-seule)
- [Basculer l’édition vers l’onglet courant](#basculer-lédition-vers-longlet-courant)

## Ce qui reste disponible en lecture seule

Dans un onglet en lecture seule :

- Vous pouvez consulter la vue **Aujourd’hui**, vos **Projets**, filtrer et trier **Tâches** (Liste et Kanban), parcourir le **Calendrier**, lire vos **Notes**, inspecter vos **Tableaux blancs**, parcourir les **Archives** et consulter le contenu de la **Corbeille**.
- Vous pouvez exporter vos données localement : sauvegarde ZIP (**Sauvegarder** → **Exporter l’archive ZIP**), agenda `.ics`, note Markdown `.md`, image `.svg` ou `.png`.
- La création, la modification, le déplacement, l’archivage/désarchivage, la suppression, la restauration depuis la corbeille, l’import ZIP et la réinitialisation sont désactivés.

## Basculer l’édition vers l’onglet courant

1. Fermez l’onglet ou la fenêtre installée qui détenait précédemment Locavern en écriture.
2. Attendez un instant sur l’onglet restant : Locavern détecte la libération du verrou, recharge l’état le plus récent depuis `IndexedDB` et affiche la notification **Édition rétablie**.
3. Si le bandeau jaune reste visible (par exemple si le premier onglet a été mis en veille sans fermer), fermez bien tous les autres onglets Locavern puis cliquez sur **Reprendre l’édition** dans le bandeau.

Si un autre onglet est encore ouvert, une notification **Verrou toujours actif** vous invite à vérifier qu’aucune autre fenêtre Locavern n’est ouverte dans le même profil de navigateur.
