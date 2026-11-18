# Documentation de Locavern

État documentaire mis à jour le 16 novembre 2026 pour la version **`0.2.0`** (Lot 1, Lot 2 — Tableau blanc, livraison GitHub Pages et évolutions fonctionnelles incluant agenda horaire/week-end, statuts initiaux/terminaux et archivage transversal), organisé selon [Diátaxis](https://diataxis.fr/).

## Documentation utilisateur

### Tutoriel

- [Créer votre premier espace de travail](tutorials/premier-espace-de-travail.md) : prise en main guidée de bout en bout (premier projet, tâche, Kanban, note, tableau blanc et export ZIP).

### Guides pratiques (How-to)

- [Comment organiser vos projets et vos tâches](how-to/organiser-projets-et-taches.md) : gérer, archiver et retrouver vos projets et tâches dans **Archives**, utiliser l’ajout rapide, configurer les rôles de statut (**Initial** / **Terminal**), trier la vue Liste, piloter le Kanban et la palette `Ctrl+K`.
- [Comment planifier votre journée et votre calendrier](how-to/planifier-journee-et-calendrier.md) : piloter la vue `Aujourd’hui`, distinguer week-ends et créneau `18h–7h` dans le `Calendrier`, planifier à l’heure, configurer des tâches récurrentes et exporter en `.ics`.
- [Comment organiser votre travail avec étiquettes, liens et modèles](how-to/organiser-avec-etiquettes-liens-et-modeles.md) : classer par étiquettes transversales, relier tâches, notes et tableaux blancs (avec protection des statuts terminaux) et réutiliser ou créer des modèles locaux.
- [Comment rédiger des notes avec mise en forme et images locales](how-to/rediger-notes-et-images.md) : éditeur enrichi (`Titre 1` à `3`), duplication, archivage, export Markdown (`.md`), liens autorisés, images locales et enregistrement automatique.
- [Comment utiliser le tableau blanc](how-to/utiliser-le-tableau-blanc.md) : créer des tableaux blancs, sélectionner par zone et dupliquer (`Ctrl+D`), aimanter flèches et grille, insérer des images locales, archiver et exporter en SVG/PNG.
- [Comment sauvegarder, restaurer ou effacer vos données](how-to/sauvegarder-et-restaurer.md) : stockage persistant, export ZIP en clair ou chiffré, fusion et import sélectif, corbeille locale et réinitialisation.
- [Comment installer Locavern et l’utiliser hors ligne](how-to/utiliser-locavern-hors-ligne.md) : installation PWA dans Chrome/Chromium, usage sans réseau et mise à jour hors ligne.
- [Comment reprendre l’édition en présence de plusieurs onglets](how-to/reprendre-edition-multi-onglets.md) : comportement du mode lecture seule et reprise du verrou d’écriture.

### Référence utilisateur

- [Interface, vues et raccourcis clavier](reference/interface-et-raccourcis.md) : description des vues (y compris **Archives**), champs, limites de saisie, commandes et raccourcis.
- [Stockage local, format d’archive et messages d’erreur](reference/stockage-limites-et-erreurs.md) : base `IndexedDB` (`DB_VERSION = 4`), archives ZIP claires et chiffrées, formats `.md` / `.ics`, plafonds et catalogue des erreurs.

### Explication

- [Fonctionnement local, confidentialité et périmètre](explanation/fonctionnement-local-et-confidentialite.md) : modèle local-first, chiffrement optionnel, corbeille locale, verrouillage multi-onglets, blocage des images distantes et limites structurelles.

## Pour les contributeurs

### Référence technique

- [État du dépôt](reference/etat-du-depot.md) : inventaire des fichiers présents, état applicatif et validations exécutables.
- [Décisions et avancement](reference/decisions-et-avancement.md) : contraintes retenues, périmètre livré et choix techniques vérifiés.

### Explication technique

- [Choix d’architecture](explanation/choix-architecture.md) : motivations, compromis et séparation noyau pur / adaptateurs.

Les commandes de démarrage et de vérification sont synthétisées dans [README.md](../README.md).

## Source historique

[choix-technique.md](../choix-technique.md) conserve la restitution initiale du 12 novembre 2026 ayant servi de base au cadrage.
