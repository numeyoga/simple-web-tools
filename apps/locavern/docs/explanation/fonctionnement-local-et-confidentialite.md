---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-15
---

# Fonctionnement local, confidentialité et périmètre

Cette page explique les principes de conception de Locavern qui influencent directement votre usage quotidien : stockage sur l’appareil, chiffrement optionnel des archives, corbeille locale, verrouillage multi-onglets, sécurité des médias et périmètre actuel de la version `0.2.0`.

## Sommaire

- [Vos données restent sur votre appareil](#vos-données-restent-sur-votre-appareil)
- [Pourquoi exporter régulièrement des archives ZIP (et quand les chiffrer)](#pourquoi-exporter-régulièrement-des-archives-zip-et-quand-les-chiffrer)
- [Pourquoi passer par une corbeille locale plutôt qu’effacer sur-le-champ](#pourquoi-passer-par-une-corbeille-locale-plutôt-queffacer-sur-le-champ)
- [Pourquoi un seul onglet écrit à la fois](#pourquoi-un-seul-onglet-écrit-à-la-fois)
- [Pourquoi les images distantes et certains liens sont bloqués](#pourquoi-les-images-distantes-et-certains-liens-sont-bloqués)
- [Périmètre actuel et limites structurelles](#périmètre-actuel-et-limites-structurelles)

## Vos données restent sur votre appareil

Locavern suit une approche **local-first** : il n’existe ni création de compte, ni serveur applicatif distant, ni synchronisation automatique en arrière-plan. Vos projets, tâches, notes, tableaux blancs, modèles personnalisés, éléments en corbeille et images sont conservés uniquement dans la base `IndexedDB` de votre navigateur.

Ce choix garantit qu’aucune donnée personnelle ne quitte votre machine, mais il implique aussi que vos données ne sont pas automatiquement partagées entre deux navigateurs ou deux appareils différents : les transferts passent exclusivement par l’export et l’import manuels d’archives ZIP (ou par des exports ponctuels `.ics` et `.md`).

## Pourquoi exporter régulièrement des archives ZIP (et quand les chiffrer)

Même lorsque le navigateur accorde le statut **Stockage persistant**, la base locale reste liée à votre profil de navigateur et à votre poste. Une suppression manuelle des données de site dans les paramètres du navigateur, une réinitialisation du profil ou une panne matérielle effacerait le contenu local.

L’archive ZIP permet de conserver une copie portable sur votre disque ou un support externe, et l’indicateur d’ancienneté aide à savoir quand remonte le dernier point de reprise :

- **Par défaut, l’archive ZIP est en clair** : les fichiers JSON et les images restent directement lisibles et inspectables sans outil particulier, ce qui évite tout blocage en cas de perte d’accès à un secret ;
- **En activant la protection par mot de passe**, l’archive interne est chiffrée localement avant d’être écrite sur disque (`AES-256-GCM` avec dérivation `PBKDF2-SHA-256`), afin de pouvoir déposer une sauvegarde sur un support partagé ou un espace de stockage tiers sans exposer son contenu. La contrepartie directe du modèle sans serveur est qu’aucune réinitialisation de mot de passe n’existe : en cas d’oubli, l’archive chiffrée est irrécupérable.

Lors de l’importation sur un poste qui contient déjà des données, la possibilité de **fusionner sans écraser** ou de ne choisir que certains projets répond aux cas d’usage de transfert partiel entre espaces de travail, sans risquer d’écraser les éléments récents de l’appareil destinataire.

## Pourquoi passer par une corbeille locale plutôt qu’effacer sur-le-champ

Une suppression accidentelle sur une application sans sauvegarde serveur continue est difficile à rattraper si elle détruit aussitôt les données et les images associées. Placer d’abord les projets, tâches, notes et tableaux blancs dans une **corbeille locale** laisse une fenêtre de récupération (configurable entre `1` et `365` jours), tout en évitant d’accumuler indéfiniment des images orphelines dans `IndexedDB` : les fichiers binaires ne sont libérés qu’au moment de la purge définitive, en même temps que le nettoyage des liens internes devenus invalides.

## Pourquoi un seul onglet écrit à la fois

Dans une application sans serveur central, laisser deux onglets modifier simultanément la même base `IndexedDB` entraîne des écrasements silencieux : le dernier onglet à écrire efface les changements récents de l’autre.

Pour prévenir toute perte de données, le premier onglet ouvert acquiert un verrou exclusif (`Web Locks`) et les onglets suivants basculent automatiquement en **mode lecture seule**. Dès que l’onglet éditeur est fermé, l’onglet suivant récupère le verrou et recharge l’état à jour.

## Pourquoi les images distantes et certains liens sont bloqués

Dans les notes comme sur le tableau blanc, Locavern bloque le collage d’images distantes (`https://…`) et n’embarque que des fichiers locaux stockés en binaire dans `IndexedDB`. Deux raisons motivent cette règle :

- **Confidentialité** : afficher une image hébergée sur un serveur tiers déclencherait une requête réseau à chaque ouverture, révélant votre adresse IP et le moment de consultation (effet de pixel espion), ce qui est incompatible avec une politique stricte sans requête externe ;
- **Disponibilité hors ligne** : une image locale stockée dans `IndexedDB` et incluse dans l’archive ZIP reste affichable sans connexion Internet, même si le site d’origine disparaît. Lorsqu’un tableau blanc contenant des images locales est exporté en `.svg` ou `.png`, ces images sont rendues localement dans le navigateur afin de produire un fichier autonome sans aucune requête externe.

De la même façon, seuls les liens `https://` et `mailto:` sont acceptés afin d’écarter les schémas potentiellement dangereux ou ambigus dans des contenus importés.

## Périmètre actuel et limites structurelles

La version `0.2.0` couvre l’ensemble de l’espace de productivité local : tableau de bord **Aujourd’hui**, **Projets** (actifs et archivés), **Tâches** (Liste, Kanban personnalisable, ajout rapide, récurrence), **Calendrier** (vues mensuelle et hebdomadaire avec report interactif et export `.ics`), **Notes** enrichies (duplication et export `.md`), **Tableaux blancs** SVG (sélection multiple, duplication, aimantation, grille et export `.svg`/`.png`), transversalité locale (**étiquettes**, **liens internes** et **modèles**), **Corbeille locale** et **Sauvegardes ZIP** (claires ou chiffrées).

Certaines limites découlent directement de l’architecture sans serveur ni format de sauvegarde `schemaVersion: 2` :

- **Pas de synchronisation temps réel ni de travail collaboratif** : chaque navigateur maintient sa propre base isolée et les transferts entre appareils restent manuels ;
- **Portée de l’archive ZIP `v2`** : les étiquettes, liens internes, éléments placés dans la corbeille et modèles personnalisés vivent dans `IndexedDB` sur l’appareil courant et ne sont pas repris lors d’un export ou import ZIP ;
- **Pas de récupération de mot de passe** : aucune clé de secours n’est stockée lorsque vous chiffrez une archive ZIP.
