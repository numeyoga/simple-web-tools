---
version: '0.2.0'
cree_le: 2026-11-15
mis_a_jour_le: 2026-11-16
---

# Comment organiser votre travail avec étiquettes, liens et modèles

Ce guide montre comment classer vos tâches et notes par étiquettes transversales, relier entre eux tâches, notes et tableaux blancs par liens internes, et réutiliser des modèles locaux de checklists, de notes et de schémas. Les plafonds de saisie et règles de conservation sont décrits dans [Stockage local, format d’archive et messages d’erreur](../reference/stockage-limites-et-erreurs.md).

## Sommaire

- [Classer tâches et notes par étiquettes transversales](#classer-tâches-et-notes-par-étiquettes-transversales)
- [Relier tâches, notes et tableaux blancs entre eux](#relier-tâches-notes-et-tableaux-blancs-entre-eux)
- [Réutiliser et créer des modèles locaux](#réutiliser-et-créer-des-modèles-locaux)

## Classer tâches et notes par étiquettes transversales

Les étiquettes s’appliquent aux tâches et aux notes, indépendamment du projet auquel elles appartiennent.

1. Ouvrez le formulaire d’une **tâche** ou l’éditeur d’une **note** (en espace intégré ou dans sa fenêtre de saisie).
2. Dans **Étiquettes**, saisissez un mot-clé (avec ou sans `#` ; vous pouvez séparer plusieurs étiquettes par des virgules), choisissez éventuellement une suggestion déjà utilisée ailleurs, puis appuyez sur `Entrée`, `,` ou cliquez sur **Ajouter l’étiquette**.
3. Enregistrez la tâche (l’éditeur intégré de notes enregistre automatiquement). Pour retirer une étiquette, cliquez sur le bouton **×** de sa puce.

Pour filtrer par étiquette :

- Dans **Tâches** (**Liste** ou **Kanban**), dans **Notes** ou dans **Archives**, utilisez le sélecteur **Étiquette** (`Toutes les étiquettes` ou `#<nom>`) afin d’isoler tous les éléments porteurs de ce mot-clé ;
- Dans la palette `Ctrl+K`, tapez le nom d’une étiquette pour retrouver immédiatement les tâches et notes actives associées.

## Relier tâches, notes et tableaux blancs entre eux

Vous pouvez créer des références croisées entre n’importe quelle tâche, note ou tableau blanc actif, sous réserve des règles de statut et d’archivage :

1. Ouvrez la section **Éléments liés** dans le formulaire d’une tâche, sous l’en-tête d’une note ou au-dessus du canevas d’un tableau blanc.
2. Dans la liste **Choisir un élément à lier…**, sélectionnez la tâche, la note ou le tableau blanc cible, puis cliquez sur **Lier**.
3. Cliquez à tout moment sur une puce sous **Éléments liés** pour ouvrir directement l’élément correspondant (y compris s’il appartient à un autre projet).

Règles appliquées aux liens internes :

- **Statuts terminaux protégés** : lorsqu’une tâche porte un statut marqué **Terminal**, elle ne peut plus recevoir de nouveaux liens ni en créer vers d’autres éléments (le sélecteur **Éléments liés** de cette tâche est désactivé avec un message explicatif et elle est exclue des cibles depuis les autres éléments). Ses liens existants restent consultables et supprimables ;
- **Éléments archivés exclus** : les tâches, notes et tableaux blancs archivés (directement ou via leur projet) n’apparaissent plus dans les sélecteurs de cibles de liens ;
- **Rétroliens bidirectionnels et nettoyage** : les éléments pointés affichent les références entrantes dans la zone en lecture seule **Lié depuis :**. En cas de suppression définitive d’un élément depuis la corbeille locale, Locavern nettoie automatiquement les références devenues invalides.

## Réutiliser et créer des modèles locaux

Locavern fournit des modèles intégrés utilisables hors ligne et vous permet d’enregistrer vos propres modèles dans `IndexedDB` :

- **Modèles de checklist** (formulaire de tâche, section **Liste de contrôle** → **Modèles de checklist**) : sélectionnez un modèle (par exemple `Préparation de livraison` ou `Revue qualité et sécurité`) et cliquez sur **Appliquer** pour ajouter ses étapes à la checklist de la tâche sans écraser les étapes existantes.
- **Modèles de trame** (éditeur de note → **Modèles de trame**) : sélectionnez une trame (par exemple `Compte-rendu de réunion` ou `Note de décision (ADR)`) et cliquez sur **Appliquer**. Si la note contient déjà du texte ou des images, confirmez le remplacement demandé.
- **Modèles de canevas** (tableau blanc → **Modèles de canevas**) : sélectionnez un schéma (par exemple `Rétrospective (3 colonnes)` ou `Flux en 3 étapes`) et cliquez sur **Appliquer**. Si le tableau contient déjà des éléments, confirmez le remplacement demandé.

Pour enregistrer votre propre modèle :

1. Préparez la checklist de la tâche, la trame de la note ou les formes du tableau blanc (les images locales sont exclues des modèles enregistrés pour éviter toute référence cassée).
2. Cliquez sur **Enregistrer comme modèle** dans la barre de modèles correspondante.
3. Saisissez un nom de modèle, puis cliquez sur **Valider** (ou appuyez sur `Entrée`).

Votre modèle apparaît aussitôt sous **Mes modèles locaux**. Pour supprimer un modèle personnalisé que vous n’utilisez plus, sélectionnez-le dans la liste et cliquez sur l’icône de corbeille à droite de **Appliquer** (les modèles intégrés ne sont pas supprimables).
