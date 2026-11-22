// English interface catalog of Slides, the reference: it has every key, and it is the fallback
// (decision 0002). `fr.js` is checked against it (see tests/unit/i18n-catalogs.test.js).
// Voice: sentence case, no exclamation mark, buttons are verbs, an error says what failed, why
// and what to do next. A "presentation" is the folder that holds `slides.md` and its images; a
// "slide" is one screen of it; the "presenter view" is the second window with the notes and the
// timers; the "overview" is the grid of all the slides.
//
// Layout of the keys: `app`, `common`, `shell` (frame), `pwa`, `home` (the screen that opens a
// presentation), `error` (why a folder cannot be opened), `slide` (what a slide shows when an image
// or a diagram cannot be), `nav` (the control bar), `stage`, `overview`, `presenter`, `prefs`,
// `shortcut` and `keys` (the list of shortcuts).

export default {
  app: {
    title: 'Slides · Markdown presentations',
    titleWith: '{title} · Slides',
  },

  common: {
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
  },

  shell: {
    skipLink: 'Skip to content',
    navLabel: 'Main navigation',
    menu: 'Menu',
    apps: 'Apps',
    preferences: 'Preferences',
    notifications: 'Notifications',
    dismissNotification: 'Dismiss the notification',
  },

  pwa: {
    updateTitle: 'A new version is ready',
    updateBody: 'Reload Slides to use it. It is already available offline.',
    reload: 'Reload',
    reloading: 'Reloading…',
  },

  home: {
    title: 'Open a presentation',
    openTitle: 'Choose the folder of your presentation',
    openText:
      'Pick the folder that holds {file} and its images, or drop it here. Nothing is uploaded: the files are read in this browser.',
    choose: 'Choose a folder',
    example: 'Load the example',
    reading: 'Reading the folder…',
    formatTitle: 'How a presentation is written',
    formatIntro:
      'The folder holds a Markdown file named {file} at its root, and the images it uses.',
    formatSeparator: 'A line with {separator} alone ends a slide.',
    formatFrontmatter:
      'An optional block of settings at the top of the file sets the {keys} (the theme is light or dark, the ratio is fixed or auto).',
    formatNotes:
      'Notes go in a {presenter} block, shown in the presenter view, or a {public} block, which is also printed.',
    formatImages:
      'Images are read from the folder, usually in {folder}. Images from the web are not loaded.',
    formatDiagrams: 'A code block in the {language} language is drawn as a diagram.',
    formatPrivacy:
      'Raw HTML in your slides is cleaned before it is shown: scripts, forms and event handlers are removed.',
    shortcutsTitle: 'Keyboard shortcuts',
  },

  error: {
    noMainFile: {
      title: 'This folder has no presentation',
      text: 'The file slides.md was not found at the root of the folder. Choose the folder that holds it, not a folder above or below.',
    },
    noSlides: {
      title: 'The presentation is empty',
      text: 'The file slides.md has no slide. Write some Markdown in it and separate the slides with a line of three dashes.',
    },
    frontmatter: {
      title: 'The settings at the top of the file are not valid',
      text: 'The block between the first two lines of three dashes is not valid YAML. Fix it, or remove it.',
      textDetail:
        'The block between the first two lines of three dashes is not valid YAML ({detail}). Fix it, or remove it.',
    },
    tooLarge: {
      title: 'The file is too large',
      text: 'The file slides.md is larger than 5 MB. Split the talk in several presentations.',
    },
    unreadable: {
      title: 'The folder could not be read',
      text: 'The browser refused to read slides.md. Choose the folder again.',
    },
  },

  slide: {
    untitled: 'Slide {number}',
    image: {
      remote: {
        title: 'Image from the web not loaded',
        reason:
          'Slides never contact other sites. Put the image in the folder and refer to it by its path.',
      },
      inline: {
        title: 'Embedded image not loaded',
        reason:
          'Images embedded in the text are not supported. Put the image in the folder and refer to it by its path.',
      },
      missing: {
        title: 'Image not found in the folder',
        reason: 'No file has this path. Check the name, and that the folder you chose holds it.',
      },
      unsupported: {
        title: 'Image address not supported',
        reason: 'Only PNG, JPEG, GIF, WebP and SVG files of the folder can be shown.',
      },
      alt: 'Description: {alt}',
    },
    diagram: {
      failed: 'This diagram could not be drawn. Its code is shown instead.',
    },
  },

  nav: {
    label: 'Presentation controls',
    previous: 'Previous slide',
    next: 'Next slide',
    position: 'Position in the presentation',
    goTo: 'Go to slide number',
    counter: '{current} / {total}',
    overview: 'Overview',
    presenter: 'Presenter view',
    print: 'Print',
    fit: 'Fit the slide to the window',
    fullscreen: 'Full screen',
    close: 'Close the presentation',
  },

  stage: {
    slideLabel: 'Slide {current} of {total}: {title}',
  },

  overview: {
    title: 'Overview',
    list: 'Slides',
  },

  presenter: {
    title: 'Presenter view',
    titleWith: 'Presenter · {title}',
    heading: 'Presenter view',
    start: 'Start the timer',
    pause: 'Pause the timer',
    reset: 'Reset the total timer',
    total: 'Total',
    slideTimer: 'Slide',
    current: 'Current slide',
    next: 'Next slide',
    notesPresenter: 'Presenter notes',
    notesPublic: 'Public notes',
    noPresenterNotes: 'No presenter notes.',
    noPublicNotes: 'No public notes.',
    end: 'End of the presentation',
    previousSlide: 'Previous',
    nextSlide: 'Next',
    waiting:
      'Waiting for the presentation. Open a presentation in the main Slides window, and it appears here.',
    ask: 'Ask again',
  },

  prefs: {
    title: 'Preferences',
    language: 'Language / Langue',
    languageAuto: 'Automatic',
    languageEnglish: 'English',
    languageFrench: 'Français',
    languageHint:
      'Automatic follows your browser language. Changing the language reloads the page.',
    theme: 'Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeHint:
      'System follows your device setting. Light and dark override it. It styles the app, not your slides: a presentation sets its own theme.',
    textSize: 'Text size',
    textSizeAuto: 'Automatic',
    textSizeStandard: 'Standard',
    textSizeComfortable: 'Comfortable',
    textSizeLarge: 'Large',
    textSizeHint: 'Automatic enlarges the text on large screens.',
    singleKey: 'Letter and digit shortcuts',
    singleKeyHint:
      'O, S, R, F and the digits work without any other key. They never fire while you type or when a dialog is open. The arrows, Space, Home and End always work.',
    shortcuts: 'Shortcuts',
  },

  shortcut: {
    next: 'Next slide',
    previous: 'Previous slide',
    firstLast: 'First and last slide',
    overview: 'Overview',
    presenter: 'Presenter view',
    ratio: 'Fit the slide to the window, or back to 16:9',
    fullscreen: 'Full screen',
    goto: 'Go to a slide number',
    closeOverview: 'Close the overview',
  },

  keys: {
    arrows: '→ ↓',
    arrowsBack: '← ↑',
    space: 'Space',
    pageUp: 'Page up',
    pageDown: 'Page down',
    home: 'Home',
    end: 'End',
    digits: '0-9',
    enter: 'Enter',
    escape: 'Esc',
  },
};
