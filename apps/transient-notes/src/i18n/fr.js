// French interface catalog of Transient Notes. `en.js` is the reference for the keys (see
// tests/unit/i18n-catalogs.test.js). Same layout and voice as the English catalog.

export default {
  app: {
    name: 'Transient Notes',
    title: 'Transient Notes · notes classées avec PARA',
  },

  common: {
    cancel: 'Annuler',
    close: 'Fermer',
    confirm: 'Confirmer',
    create: 'Créer',
    delete: 'Supprimer',
  },

  shell: {
    skipLink: 'Aller au contenu',
    navLabel: 'Navigation principale',
    menu: 'Menu',
    preferences: 'Préférences',
    workspace: 'Espace de travail',
    loading: 'Chargement…',
    loadError: 'Erreur de chargement : {message}',
    readOnly: {
      title: 'Transient Notes est ouvert dans un autre onglet.',
      text: 'Cet onglet est en lecture seule.',
      resume: 'Reprendre l’édition',
      stillWriting: 'Un autre onglet écrit encore',
      closeIt: 'Ferme-le puis réessaie.',
      toastTitle: 'Lecture seule',
      toastBody:
        'Transient Notes est ouvert dans un autre onglet. Cet onglet est en lecture seule.',
      restored: 'Édition rétablie',
      restoredBody: 'Cet onglet peut de nouveau modifier tes notes.',
    },
    storageBlocked: {
      title: 'Transient Notes est bloqué par un autre onglet',
      body: 'Une autre fenêtre ou un autre onglet garde ouverte une ancienne version de Transient Notes et empêche la mise à jour de la base de données. Ferme tous les autres onglets Transient Notes, puis recharge cette page.',
    },
    storageUnavailable: {
      title: 'Transient Notes ne peut pas utiliser le stockage du navigateur',
      body: 'Transient Notes enregistre tes notes dans IndexedDB, qui est indisponible ici (navigation privée, stockage bloqué ou navigateur trop ancien). Rien n’a été lu ni écrit. Autorise le stockage pour ce site ou ouvre Transient Notes dans une fenêtre de navigation normale, puis recharge la page.',
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
    allNotes: 'Toutes les notes',
  },

  para: {
    projects: 'Projets',
    areas: 'Domaines',
    resources: 'Ressources',
    archives: 'Archives',
    defaultFolder: {
      projects: 'Projets généraux',
      areas: 'Domaines généraux',
      resources: 'Ressources générales',
      archives: 'Archives générales',
    },
  },

  notes: {
    new: 'Nouvelle note',
    untitled: 'Sans titre',
    count: { one: '{count} note', other: '{count} notes' },
    listLabel: 'Notes',
    emptyTitle: 'Aucune note ici pour le moment',
    emptyText: 'Crée une note pour commencer. Elle est enregistrée dans ce navigateur uniquement.',
  },

  export: {
    heading: 'TRANSIENT NOTES - Export complet',
    exportedAt: 'Date : {date}',
    count: 'Nombre de notes : {count}',
    imageAlt: 'Image',
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
    singleKey: 'Raccourcis à une touche',
    singleKeyHint:
      'N, 1, 2, 3 et 4 agissent sans autre touche. Ils ne se déclenchent jamais pendant une saisie ni quand un dialogue est ouvert.',
    shortcuts: 'Raccourcis',
    shortcutNew: 'Nouvelle note',
    shortcutCategory: 'Nouvelle note dans Projets, Domaines, Ressources ou Archives',
  },

  workspaces: {
    defaultLabel: 'Espace principal',
    title: 'Espaces de travail',
    intro:
      'Chaque espace est un ensemble de notes séparé, stocké dans sa propre base IndexedDB. Utilise-les pour séparer tes notes par rôle ou par importance.',
    active: 'Actif',
    created: 'créé {date}',
    nameLabel: 'Nom de l’espace',
    validate: 'Valider',
    switch: 'Basculer',
    switchTitle: 'Changer d’espace ?',
    switchMessage: 'La page va se recharger pour afficher l’espace « {name} ».',
    rename: 'Renommer',
    cannotDelete: 'Impossible : actif ou dernier',
    deleteTitle: 'Supprimer cet espace ?',
    deleteMessage:
      'Toutes les notes de l’espace « {name} » seront effacées (dossiers, notes et images). Tu ne pourras pas annuler.',
    deleted: 'Espace supprimé',
    newTitle: 'Nouvel espace',
    newName: 'Nom du nouvel espace',
    newPlaceholder: 'Ex. Travail, Perso, Archives…',
    nameEmpty: 'Le nom est vide. Saisis le nom du nouvel espace.',
    createFailed: 'Création impossible',
    switchToNewTitle: 'Basculer sur cet espace ?',
    switchToNewMessage: 'L’espace « {name} » a été créé. Veux-tu basculer dessus maintenant ?',
    createdToast: 'Espace créé',
    backup: 'Sauvegarde',
    backupHint:
      'Exporte ou importe l’espace actif au format JSON, images comprises. Pratique pour archiver ou déplacer tes notes.',
    exportJson: 'Exporter JSON',
    importJson: 'Importer JSON',
    exported: 'Sauvegarde téléchargée',
    exportFailed: 'Export impossible',
    replaceTitle: 'Remplacer les notes ?',
    replaceMessage:
      'Toutes les notes actuelles de l’espace « {name} » seront remplacées par le contenu du fichier. Tu ne pourras pas annuler.',
    replaceConfirm: 'Remplacer les notes',
    imported: 'Import terminé',
    importedSkipped:
      'Certains enregistrements du fichier étaient inutilisables et ont été ignorés.',
    reloading: 'Rechargement…',
    importFailed: 'Import impossible',
  },

  pwa: {
    updateTitle: 'Une nouvelle version est prête',
    updateBody: 'Recharge Transient Notes pour l’utiliser. Elle est déjà disponible hors ligne.',
    reload: 'Recharger',
    reloading: 'Rechargement…',
  },

  importErrors: {
    invalidJson: 'Le fichier n’est pas du JSON valide.',
    invalidFormat: 'Le fichier n’est pas une sauvegarde Transient Notes.',
    invalidData: 'La sauvegarde ne contient ni notes ni dossiers utilisables.',
    wrongApp: 'Ce fichier n’a pas été exporté par Transient Notes.',
    newerVersion:
      'Ce fichier vient d’une version plus récente de Transient Notes. Mets l’application à jour puis réessaie.',
    cannotConvert: 'Ce fichier ne peut pas être converti.',
  },
};
