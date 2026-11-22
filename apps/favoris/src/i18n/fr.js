// Catalogue français de l'interface de Favoris. Les mêmes clés, les mêmes paramètres et les mêmes
// formes de pluriel que `en.js`, qui sert de référence (voir tests/unit/i18n-catalogs.test.js).
// Voix : sentence case, tutoiement, pas de point d'exclamation, des verbes sur les boutons. Un
// « espace de travail » est une page de favoris séparée (l'« espace » de la version précédente de
// l'application, avec sa propre base) ; un « groupe » contient des liens et a une couleur ; un
// « lien » est un favori.

export default {
  app: {
    name: 'Favoris',
    title: 'Favoris · tes liens en groupes de couleur',
  },

  common: {
    add: 'Ajouter',
    cancel: 'Annuler',
    close: 'Fermer',
    confirm: 'Confirmer',
    create: 'Créer',
    delete: 'Supprimer',
    save: 'Enregistrer',
  },

  shell: {
    skipLink: 'Aller au contenu',
    navLabel: 'Navigation principale',
    menu: 'Menu',
    apps: 'Applications',
    preferences: 'Préférences',
    workspace: 'Espace de travail',
    loading: 'Chargement…',
    loadError: 'Erreur de chargement : {message}',
    readOnly: {
      title: 'Favoris est ouvert dans un autre onglet.',
      text: 'Cet onglet est en lecture seule.',
      resume: 'Reprendre l’édition',
      stillWriting: 'Un autre onglet écrit encore',
      closeIt: 'Ferme-le puis réessaie.',
      toastTitle: 'Lecture seule',
      toastBody: 'Favoris est ouvert dans un autre onglet. Cet onglet est en lecture seule.',
      restored: 'Édition rétablie',
      restoredBody: 'Cet onglet peut de nouveau modifier tes favoris.',
    },
    storageBlocked: {
      title: 'Favoris est bloqué par un autre onglet',
      body: 'Une autre fenêtre ou un autre onglet garde ouverte une ancienne version de Favoris et empêche la mise à jour de la base de données. Ferme tous les autres onglets Favoris, puis recharge cette page.',
    },
    storageUnavailable: {
      title: 'Favoris ne peut pas utiliser le stockage du navigateur',
      body: 'Favoris enregistre tes favoris dans IndexedDB, qui est indisponible ici (navigation privée, stockage bloqué ou navigateur trop ancien). Rien n’a été lu ni écrit. Autorise le stockage pour ce site ou ouvre Favoris dans une fenêtre de navigation normale, puis recharge la page.',
    },
    writeFailed: {
      title: 'Tes modifications n’ont pas été enregistrées',
      body: 'Le navigateur a refusé d’écrire dans son stockage (il est peut-être plein). Libère de la place puis continue : l’application réessaie à la modification suivante.',
    },
    reload: 'Recharger la page',
    notifications: 'Notifications',
    dismissNotification: 'Fermer la notification',
  },

  nav: {
    groups: 'Groupes',
  },

  board: {
    addLink: 'Nouveau lien',
    newGroup: 'Nouveau groupe',
    edit: 'Éditer',
    more: 'Plus d’actions',
    moreMenu: 'Données et groupes',
    searchLabel: 'Rechercher dans les liens',
    searchPlaceholder: 'Rechercher un nom, une adresse, un groupe…',
    count: { '=0': 'Aucun lien', one: '{count} lien', other: '{count} liens' },
    found: { '=0': 'Aucun résultat', one: '{count} résultat', other: '{count} résultats' },
    emptyTitle: 'Aucun favori pour le moment',
    emptyText:
      'Ajoute un lien pour commencer, ou crée un groupe pour les classer. Tout est enregistré dans ce navigateur uniquement.',
    noResultsTitle: 'Aucun résultat',
    noResultsText:
      'Aucun lien ne correspond à « {query} ». Modifie ou efface la recherche pour voir plus de liens.',
  },

  groups: {
    ungrouped: 'Sans groupe',
    empty: 'Aucun lien dans ce groupe pour le moment.',
    noMatch: 'Aucun lien ne correspond à la recherche.',
    featuredMark: 'Mis en avant',
    feature: 'Mettre « {name} » en avant',
    addLink: 'Ajouter un lien à « {name} »',
    addLinkUngrouped: 'Ajouter un lien',
    menu: 'Actions du groupe « {name} »',
    edit: 'Modifier le groupe',
    moveUp: 'Monter',
    moveDown: 'Descendre',
    newTitle: 'Nouveau groupe',
    editTitle: 'Modifier le groupe',
    nameLabel: 'Nom du groupe',
    namePlaceholder: 'Ex. Recettes',
    nameEmpty: 'Le nom est vide. Saisis un nom pour le groupe.',
    deleteTitle: 'Supprimer ce groupe ?',
    deleteMessage: {
      '=0': 'Le groupe « {name} » va être supprimé. Il ne contient aucun lien.',
      one: 'Le groupe « {name} » va être supprimé. Son lien est conservé, sans groupe.',
      other:
        'Le groupe « {name} » va être supprimé. Ses {count} liens sont conservés, sans groupe.',
    },
    deleted: 'Groupe supprimé',
  },

  links: {
    newTitle: 'Nouveau lien',
    editTitle: 'Modifier le lien',
    nameLabel: 'Nom',
    namePlaceholder: 'Ex. Documentation interne',
    urlLabel: 'Adresse',
    urlPlaceholder: 'https://…',
    urlHint:
      'Seules les adresses web sont acceptées (http ou https). https:// est ajouté si tu l’oublies.',
    urlEmpty: 'L’adresse est vide. Saisis l’adresse du lien.',
    urlUnsupported:
      'Seules les adresses http et https sont acceptées. Saisis une adresse web comme https://exemple.org.',
    urlInvalid: 'Ce n’est pas une adresse web valide. Vérifie-la puis réessaie.',
    groupLabel: 'Groupe',
    noGroup: 'Sans groupe',
    newGroup: 'Nouveau groupe…',
    added: 'Lien ajouté',
    updated: 'Lien mis à jour',
    deleteTitle: 'Supprimer ce lien ?',
    deleteMessage: 'Le lien « {name} » va être supprimé. Tu ne pourras pas annuler.',
    deleted: 'Lien supprimé',
    newTab: '(s’ouvre dans un nouvel onglet)',
    copy: 'Copier l’adresse de « {name} »',
    copied: 'Adresse copiée',
    copyFailed: 'Impossible de copier l’adresse',
    edit: 'Modifier « {name} »',
    delete: 'Supprimer « {name} »',
    moveMenu: 'Déplacer « {name} »',
    moveUp: 'Monter',
    moveDown: 'Descendre',
    moveToGroup: 'Déplacer vers un groupe…',
    moveTitle: 'Déplacer « {name} »',
    moveLabel: 'Groupe',
    move: 'Déplacer',
    moved: 'Lien déplacé',
  },

  colors: {
    label: 'Couleur',
    orange: 'Orange',
    amber: 'Ambre',
    yellow: 'Jaune',
    lime: 'Citron vert',
    green: 'Vert',
    teal: 'Sarcelle',
    cyan: 'Cyan',
    sky: 'Ciel',
    blue: 'Bleu',
    indigo: 'Indigo',
    violet: 'Violet',
    purple: 'Pourpre',
    fuchsia: 'Fuchsia',
    pink: 'Rose',
    rose: 'Rose vif',
    slate: 'Ardoise',
  },

  data: {
    exportJson: 'Exporter en JSON',
    importJson: 'Importer un JSON',
    exported: 'Sauvegarde téléchargée',
    exportFailed: 'Export impossible',
    replaceTitle: 'Remplacer les favoris ?',
    replaceMessage: {
      '=0': 'Tous les groupes et les liens de l’espace de travail « {name} » vont être remplacés par le contenu du fichier, qui ne contient aucun lien. Tu ne pourras pas annuler.',
      one: 'Tous les groupes et les liens de l’espace de travail « {name} » vont être remplacés par le contenu du fichier (1 lien). Tu ne pourras pas annuler.',
      other:
        'Tous les groupes et les liens de l’espace de travail « {name} » vont être remplacés par le contenu du fichier ({count} liens). Tu ne pourras pas annuler.',
    },
    replaceConfirm: 'Remplacer les favoris',
    imported: 'Import terminé',
    importedOld: 'Import terminé (fichier de la version précédente)',
    importedSkipped: {
      one: '1 enregistrement du fichier était inutilisable et a été ignoré.',
      other:
        '{count} enregistrements du fichier étaient inutilisables et ont été ignorés. {unsafe} d’entre eux avaient une adresse qui n’est pas en http ou https.',
    },
    importFailed: 'Import impossible',
    clear: 'Tout effacer',
    clearTitle: 'Effacer cet espace de travail ?',
    clearMessage:
      'Tous les groupes et les liens de l’espace de travail « {name} » vont être effacés. Tu ne pourras pas annuler.',
    clearConfirm: 'Tout effacer',
    cleared: 'Espace de travail effacé',
  },

  legacy: {
    title: 'Tes favoris ont été importés',
    body: {
      one: 'La version précédente de Favoris avait {count} espace : c’est maintenant un espace de travail. Liens importés : {links}. Les anciennes données restent intactes dans ce navigateur.',
      other:
        'La version précédente de Favoris avait {count} espaces : ce sont maintenant des espaces de travail. Liens importés : {links}. Les anciennes données restent intactes dans ce navigateur.',
    },
    skippedTitle: 'Certains enregistrements n’ont pas été importés',
    skipped: {
      one: '1 enregistrement était inutilisable et a été ignoré.',
      other:
        '{count} enregistrements étaient inutilisables et ont été ignorés. {unsafe} d’entre eux avaient une adresse qui n’est pas en http ou https.',
    },
    unreadable: {
      one: '1 espace contenait des données illisibles : il a été importé vide.',
      other: '{count} espaces contenaient des données illisibles : ils ont été importés vides.',
    },
  },

  prefs: {
    title: 'Préférences',
    language: 'Langue / Language',
    languageAuto: 'Automatique',
    languageEnglish: 'English',
    languageFrench: 'Français',
    languageHint: 'Automatique suit la langue du navigateur. Changer de langue recharge la page.',
    theme: 'Thème',
    themeSystem: 'Système',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    themeHint: 'Système suit le réglage de ton appareil, clair et sombre le remplacent.',
    textSize: 'Taille du texte',
    textSizeAuto: 'Automatique',
    textSizeStandard: 'Standard',
    textSizeComfortable: 'Confortable',
    textSizeLarge: 'Grande',
    textSizeHint: 'Automatique agrandit le texte sur les grands écrans.',
    siteIcons: 'Charger les icônes des sites depuis Google (Google voit les domaines de tes liens)',
    siteIconsHint:
      'Désactivé par défaut : chaque lien affiche une initiale colorée et rien ne quitte ton appareil. Activé, le navigateur demande une icône par lien au service de favicons de Google, ce qui lui indique le domaine de chaque lien et ton adresse IP.',
    singleKey: 'Raccourcis à une touche',
    singleKeyHint:
      'N et / fonctionnent sans autre touche. Ils ne se déclenchent jamais pendant la saisie ni quand une boîte de dialogue est ouverte.',
    shortcuts: 'Raccourcis',
    shortcutNew: 'Nouveau lien',
    shortcutSearch: 'Rechercher dans les liens',
    keySearchModifier: 'Ctrl+K',
    shortcutSearchModifier: 'Rechercher dans les liens (toujours actif)',
  },

  workspaces: {
    defaultLabel: 'Mes favoris',
    title: 'Espaces de travail',
    intro:
      'Chaque espace de travail est une page de favoris séparée, stockée dans sa propre base IndexedDB. Sers-t’en pour garder les liens à part, par exemple pour le travail et pour la maison.',
    active: 'Actif',
    created: 'créé le {date}',
    nameLabel: 'Nom de l’espace de travail',
    validate: 'Confirmer',
    switch: 'Basculer',
    switchTitle: 'Changer d’espace de travail ?',
    switchMessage: 'La page va se recharger pour afficher l’espace de travail « {name} ».',
    rename: 'Renommer',
    duplicate: 'Dupliquer',
    copyName: '{name} (copie)',
    duplicated: 'Espace de travail dupliqué',
    duplicateFailed: 'Duplication impossible',
    cannotDelete: 'Indisponible : espace actif ou dernier espace',
    deleteTitle: 'Supprimer cet espace de travail ?',
    deleteMessage:
      'Tous les favoris de l’espace de travail « {name} » vont être effacés (groupes et liens). Tu ne pourras pas annuler.',
    deleted: 'Espace de travail supprimé',
    newTitle: 'Nouvel espace de travail',
    newName: 'Nom du nouvel espace de travail',
    newPlaceholder: 'Ex. Travail, Maison, Lectures…',
    nameEmpty: 'Le nom est vide. Saisis un nom pour le nouvel espace de travail.',
    createFailed: 'Création impossible',
    switchToNewTitle: 'Basculer sur cet espace ?',
    switchToNewMessage: 'L’espace de travail « {name} » a été créé. Basculer dessus maintenant ?',
    createdToast: 'Espace de travail créé',
  },

  pwa: {
    updateTitle: 'Une nouvelle version est prête',
    updateBody: 'Recharge Favoris pour l’utiliser. Elle est déjà disponible hors ligne.',
    reload: 'Recharger',
    reloading: 'Rechargement…',
  },

  importErrors: {
    invalidJson: 'Le fichier n’est pas un JSON valide.',
    invalidFormat: 'Le fichier n’est pas une sauvegarde Favoris.',
    invalidData: 'Le fichier ne contient ni groupe ni lien utilisable.',
    wrongApp: 'Ce fichier n’a pas été exporté par Favoris.',
    newerVersion:
      'Ce fichier vient d’une version plus récente de Favoris. Mets l’application à jour puis réessaie.',
    cannotConvert: 'Ce fichier ne peut pas être converti.',
  },
};
