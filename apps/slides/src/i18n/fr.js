// Catalogue français de l’interface de Slides : mêmes clés que l’anglais, qui est la référence
// (décision 0002). Voix : tutoiement, casse de phrase, pas de point d’exclamation, les boutons sont
// des verbes. Une « présentation » est le dossier qui contient `slides.md` et ses images ; une
// « diapositive » en est un écran ; la « vue présentateur » est la seconde fenêtre avec les notes et
// les minuteurs ; la « vue d’ensemble » est la grille de toutes les diapositives.

export default {
  app: {
    title: 'Slides · présentations en Markdown',
    titleWith: '{title} · Slides',
  },

  common: {
    cancel: 'Annuler',
    close: 'Fermer',
    confirm: 'Confirmer',
  },

  shell: {
    skipLink: 'Aller au contenu',
    navLabel: 'Navigation principale',
    menu: 'Menu',
    apps: 'Applications',
    preferences: 'Préférences',
    notifications: 'Notifications',
    dismissNotification: 'Fermer la notification',
  },

  pwa: {
    updateTitle: 'Une nouvelle version est prête',
    updateBody: 'Recharge Slides pour l’utiliser. Elle est déjà disponible hors ligne.',
    reload: 'Recharger',
    reloading: 'Rechargement…',
  },

  home: {
    title: 'Ouvrir une présentation',
    openTitle: 'Choisis le dossier de ta présentation',
    openText:
      'Choisis le dossier qui contient {file} et ses images, ou dépose-le ici. Rien n’est envoyé : les fichiers sont lus dans ce navigateur.',
    choose: 'Choisir un dossier',
    example: 'Charger l’exemple',
    reading: 'Lecture du dossier…',
    formatTitle: 'Comment écrire une présentation',
    formatIntro:
      'Le dossier contient à sa racine un fichier Markdown nommé {file}, et les images qu’il utilise.',
    formatSeparator: 'Une ligne qui ne contient que {separator} termine une diapositive.',
    formatFrontmatter:
      'Un bloc de réglages facultatif en haut du fichier définit {keys} (le thème est clair ou sombre, le ratio est fixe ou auto).',
    formatNotes:
      'Les notes vont dans un bloc {presenter}, affiché dans la vue présentateur, ou un bloc {public}, qui est aussi imprimé.',
    formatImages:
      'Les images sont lues dans le dossier, en général dans {folder}. Les images du web ne sont pas chargées.',
    formatDiagrams: 'Un bloc de code du langage {language} est dessiné comme un diagramme.',
    formatPrivacy:
      'Le HTML brut de tes diapositives est nettoyé avant d’être affiché : les scripts, les formulaires et les gestionnaires d’événements sont retirés.',
    shortcutsTitle: 'Raccourcis clavier',
  },

  error: {
    noMainFile: {
      title: 'Ce dossier ne contient pas de présentation',
      text: 'Le fichier slides.md est introuvable à la racine du dossier. Choisis le dossier qui le contient, pas un dossier au-dessus ou en dessous.',
    },
    noSlides: {
      title: 'La présentation est vide',
      text: 'Le fichier slides.md ne contient aucune diapositive. Écris du Markdown dedans et sépare les diapositives par une ligne de trois tirets.',
    },
    frontmatter: {
      title: 'Les réglages en haut du fichier ne sont pas valides',
      text: 'Le bloc entre les deux premières lignes de trois tirets n’est pas du YAML valide. Corrige-le, ou retire-le.',
      textDetail:
        'Le bloc entre les deux premières lignes de trois tirets n’est pas du YAML valide ({detail}). Corrige-le, ou retire-le.',
    },
    tooLarge: {
      title: 'Le fichier est trop volumineux',
      text: 'Le fichier slides.md dépasse 5 Mo. Découpe l’exposé en plusieurs présentations.',
    },
    unreadable: {
      title: 'Le dossier n’a pas pu être lu',
      text: 'Le navigateur a refusé de lire slides.md. Choisis de nouveau le dossier.',
    },
  },

  slide: {
    untitled: 'Diapositive {number}',
    image: {
      remote: {
        title: 'Image du web non chargée',
        reason:
          'Slides ne contacte jamais d’autres sites. Mets l’image dans le dossier et désigne-la par son chemin.',
      },
      inline: {
        title: 'Image intégrée non chargée',
        reason:
          'Les images intégrées au texte ne sont pas prises en charge. Mets l’image dans le dossier et désigne-la par son chemin.',
      },
      missing: {
        title: 'Image introuvable dans le dossier',
        reason:
          'Aucun fichier n’a ce chemin. Vérifie le nom, et que le dossier choisi contient bien le fichier.',
      },
      unsupported: {
        title: 'Adresse d’image non prise en charge',
        reason: 'Seuls les fichiers PNG, JPEG, GIF, WebP et SVG du dossier peuvent être affichés.',
      },
      alt: 'Description : {alt}',
    },
    diagram: {
      failed: 'Ce diagramme n’a pas pu être dessiné. Son code est affiché à la place.',
    },
  },

  nav: {
    label: 'Contrôles de la présentation',
    previous: 'Diapositive précédente',
    next: 'Diapositive suivante',
    position: 'Position dans la présentation',
    goTo: 'Aller au numéro de diapositive',
    counter: '{current} / {total}',
    overview: 'Vue d’ensemble',
    presenter: 'Vue présentateur',
    print: 'Imprimer',
    fit: 'Ajuster la diapositive à la fenêtre',
    fullscreen: 'Plein écran',
    close: 'Fermer la présentation',
  },

  stage: {
    slideLabel: 'Diapositive {current} sur {total} : {title}',
  },

  overview: {
    title: 'Vue d’ensemble',
    list: 'Diapositives',
  },

  presenter: {
    title: 'Vue présentateur',
    titleWith: 'Présentateur · {title}',
    heading: 'Vue présentateur',
    start: 'Démarrer le minuteur',
    pause: 'Mettre le minuteur en pause',
    reset: 'Remettre le minuteur total à zéro',
    total: 'Total',
    slideTimer: 'Diapositive',
    current: 'Diapositive courante',
    next: 'Diapositive suivante',
    notesPresenter: 'Notes du présentateur',
    notesPublic: 'Notes publiques',
    noPresenterNotes: 'Aucune note du présentateur.',
    noPublicNotes: 'Aucune note publique.',
    end: 'Fin de la présentation',
    previousSlide: 'Précédente',
    nextSlide: 'Suivante',
    waiting:
      'En attente de la présentation. Ouvre une présentation dans la fenêtre principale de Slides, elle apparaîtra ici.',
    ask: 'Demander de nouveau',
  },

  prefs: {
    title: 'Préférences',
    language: 'Language / Langue',
    languageAuto: 'Automatique',
    languageEnglish: 'English',
    languageFrench: 'Français',
    languageHint:
      'Automatique suit la langue de ton navigateur. Changer de langue recharge la page.',
    theme: 'Thème',
    themeSystem: 'Système',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    themeHint:
      'Système suit le réglage de ton appareil. Clair et sombre le remplacent. Il habille l’application, pas tes diapositives : une présentation choisit son propre thème.',
    textSize: 'Taille du texte',
    textSizeAuto: 'Automatique',
    textSizeStandard: 'Standard',
    textSizeComfortable: 'Confortable',
    textSizeLarge: 'Grande',
    textSizeHint: 'Automatique agrandit le texte sur les grands écrans.',
    singleKey: 'Raccourcis lettres et chiffres',
    singleKeyHint:
      'O, S, R, F et les chiffres fonctionnent sans autre touche. Ils ne se déclenchent jamais pendant une saisie ni quand une boîte de dialogue est ouverte. Les flèches, Espace, Début et Fin fonctionnent toujours.',
    shortcuts: 'Raccourcis',
  },

  shortcut: {
    next: 'Diapositive suivante',
    previous: 'Diapositive précédente',
    firstLast: 'Première et dernière diapositive',
    overview: 'Vue d’ensemble',
    presenter: 'Vue présentateur',
    ratio: 'Ajuster la diapositive à la fenêtre, ou revenir au 16:9',
    fullscreen: 'Plein écran',
    goto: 'Aller à un numéro de diapositive',
    closeOverview: 'Fermer la vue d’ensemble',
  },

  keys: {
    arrows: '→ ↓',
    arrowsBack: '← ↑',
    space: 'Espace',
    pageUp: 'Page préc.',
    pageDown: 'Page suiv.',
    home: 'Début',
    end: 'Fin',
    digits: '0-9',
    enter: 'Entrée',
    escape: 'Échap',
  },
};
