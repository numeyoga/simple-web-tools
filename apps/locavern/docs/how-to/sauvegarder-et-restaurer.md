---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-16
---

# Comment sauvegarder, restaurer ou effacer vos données

Locavern conserve vos données localement dans le navigateur. Ce guide explique comment vérifier la persistance et l’ancienneté de votre dernière sauvegarde, exporter une archive ZIP claire ou chiffrée, fusionner ou importer sélectivement une archive, récupérer ou purger des éléments dans la corbeille locale, ou réinitialiser l’espace local.

Pour les détails techniques du format ZIP, de la portée exacte des archives et des messages d’erreur, consultez [Stockage local, format d’archive et messages d’erreur](../reference/stockage-limites-et-erreurs.md).

## Sommaire

- [Vérifier l’état du stockage et demander la persistance](#vérifier-létat-du-stockage-et-demander-la-persistance)
- [Choisir un dossier pour les exports](#choisir-un-dossier-pour-les-exports)
- [Exporter une archive ZIP (en clair ou chiffrée)](#exporter-une-archive-zip-en-clair-ou-chiffrée)
- [Importer, fusionner ou restaurer une archive ZIP](#importer-fusionner-ou-restaurer-une-archive-zip)
- [Récupérer ou purger depuis la corbeille locale](#récupérer-ou-purger-depuis-la-corbeille-locale)
- [Effacer toutes les données locales](#effacer-toutes-les-données-locales)

## Vérifier l’état du stockage et demander la persistance

Cliquez sur **Sauvegarder** dans la barre supérieure (ou **Sauvegardes** dans le menu latéral) pour ouvrir la fenêtre **Sauvegardes et stockage**.

La section **État du stockage local** indique le nombre de projets, tâches, notes, tableaux blancs et images locales enregistrés, l’espace utilisé, le quota estimé par votre navigateur et l’indicateur **Dernière sauvegarde ZIP** (`Aucune sauvegarde ZIP`, `À l’instant`, `Il y a <n> min/h/jour(s)`).

- Si le badge indique **Stockage persistant**, le navigateur protège la base contre l’effacement automatique en cas de manque d’espace disque.
- Si le badge indique **Stockage standard**, cliquez sur **Demander la persistance au navigateur** (bouton visible hors mode lecture seule). Si le navigateur refuse l’élévation, exportez régulièrement des archives ZIP pour sécuriser vos données.

## Choisir un dossier pour les exports

1. Ouvrez **Sauvegardes et stockage**.
2. Dans **Dossier des exports**, cliquez sur **Choisir un dossier** et autorisez l’accès en écriture dans le sélecteur du navigateur.
3. Vos prochains exports ZIP, Markdown, iCalendar, SVG et PNG seront enregistrés directement dans ce dossier. Un fichier du même nom sera remplacé.

Locavern mémorise le dossier sur cet appareil lorsque le navigateur le permet. Sinon, un message indique que le choix vaut uniquement pour la session. Après réouverture, le navigateur peut redemander l’autorisation lors du prochain export. En cas de refus d’accès, l’export signale une erreur ; vous pouvez réautoriser l’accès ou retirer le dossier.

Utilisez **Changer de dossier** pour sélectionner un autre emplacement, ou **Retirer le dossier** pour revenir au sélecteur de fichier ou au téléchargement classique. Retirer le dossier ne supprime aucun fichier sur le disque. Les navigateurs sans prise en charge de cette fonction conservent le téléchargement classique.

## Exporter une archive ZIP (en clair ou chiffrée)

1. Ouvrez **Sauvegardes et stockage** (`Sauvegarder`).
2. Par défaut, l’archive est générée en clair. Pour protéger son contenu par mot de passe, cochez **Protéger l’archive par un mot de passe (AES-GCM)**, puis saisissez et confirmez le mot de passe dans **Mot de passe de chiffrement** et **Confirmer le mot de passe** (bouton œil pour vérifier la saisie).
3. Cliquez sur **Exporter l’archive ZIP**.
4. Si un dossier d’export est choisi, le fichier `locavern-sauvegarde-AAAA-MM-JJ.zip` y est enregistré directement. Sinon, choisissez son emplacement dans le sélecteur de fichier natif (ou laissez le téléchargement standard du navigateur s’effectuer). Si vous annulez le sélecteur natif, aucun fichier n’est écrit et la date **Dernière sauvegarde ZIP** n’est pas modifiée.

L’archive inclut vos projets, tâches (y compris récurrence, checklists et descriptions), notes, tableaux blancs, statuts Kanban personnalisés et images locales au format binaire d’origine. Note : les étiquettes (`tags`), liens internes (`links`), éléments présents dans la corbeille et modèles personnalisés restent uniquement dans `IndexedDB` sur cet appareil (voir [Stockage local, format d’archive et messages d’erreur](../reference/stockage-limites-et-erreurs.md#portée-des-archives-et-limites-techniques)).

> **Important :** si vous activez le chiffrement par mot de passe, conservez ce mot de passe en lieu sûr. En l’absence de serveur ou de compte, aucune récupération n’est possible en cas d’oubli.

Note : l’export reste disponible même si l’onglet est en mode lecture seule.

## Importer, fusionner ou restaurer une archive ZIP

1. Ouvrez **Sauvegardes et stockage**.
2. Sous **Importer une archive**, cliquez sur **Fichier de sauvegarde (.zip)** et sélectionnez votre archive `.zip`.
3. Si l’archive est protégée par mot de passe, saisissez le **Mot de passe de l’archive** puis cliquez sur **Déverrouiller l’archive**. Locavern valide ensuite le format, le schéma et la présence de chaque image référencée sans modifier vos données locales en cas d’anomalie.
4. Une fois l’aperçu affiché, choisissez l’un des trois **Mode d’importation** :
   - **Fusionner tout sans écraser les données locales** (sélectionné par défaut si vous avez déjà des données locales) : ajoute l’intégralité de l’archive sans toucher à vos éléments existants (en réattribuant automatiquement les identifiants en cas de collision et en complétant les statuts Kanban manquants), puis cliquez sur **Lancer l’import** ;
   - **Importer une sélection de projets sans écraser** : cochez uniquement les projets voulus sous **Projets à importer** (et, s’il y en a dans l’archive, **Inclure les éléments sans projet**), puis cliquez sur **Lancer l’import** ;
   - **Remplacer toutes les données locales** (sélectionné par défaut si la base locale est vide) : cliquez sur **Importer et remplacer**, puis confirmez dans la fenêtre **Remplacer les données locales ?** pour remplacer intégralement les données locales par le contenu de l’archive.

La vue se met immédiatement à jour et une notification (**Archive fusionnée** ou **Sauvegarde restaurée**) confirme l’opération.

## Récupérer ou purger depuis la corbeille locale

Lorsque vous supprimez un projet, une tâche, une note ou un tableau blanc depuis l’interface, l’élément est déplacé dans la **Corbeille** locale plutôt que détruit immédiatement.

- **Consulter et restaurer un élément** : cliquez sur **Corbeille** dans la barre latérale (ou lancez **Ouvrir la corbeille** via `Ctrl+K`), puis cliquez sur **Restaurer** en face de l’élément souhaité. Si vous restaurez un projet, toutes ses tâches archivées dans la corbeille avec lui sont également restaurées ; en revanche, une tâche supprimée isolément ne peut être restaurée que si son projet parent existe toujours.
- **Purger définitivement avant expiration** : cliquez sur **Purger** sur une ligne (ou **Vider la corbeille** en haut de la fenêtre) et confirmez. Les images locales qui n’étaient utilisées que par les éléments purgés sont alors libérées de `IndexedDB` et les liens internes pointant vers ces éléments supprimés sont nettoyés.
- **Ajuster le délai de conservation** : cliquez sur **Configurer le délai** dans la fenêtre **Corbeille locale** (ou ouvrez **Affichage** → **Rétention de la corbeille (jours)**) pour définir une durée entière entre `1` et `365` jours (`30` jours par défaut). Au démarrage de l’application, tout élément ayant dépassé son échéance est purgé automatiquement.

## Effacer toutes les données locales

1. Ouvrez **Sauvegardes et stockage**.
2. Sous **Réinitialisation locale**, cliquez sur **Effacer toutes les données locales**.
3. Dans la fenêtre de confirmation, cliquez sur **Effacer tout**.

Tous les projets, tâches, notes, tableaux blancs et images locales sont définitivement supprimés de `IndexedDB` sur cet appareil. Cette action est irréversible sans archive ZIP préalable.
