// The localStorage of the previous version of Favoris, as that version wrote it (a copy of its
// formats from public/index.html: `favoris.spaces`, `favoris.currentSpace`, `favoris.v1:<id>`, the
// single key `favoris.v1` of the versions before spaces, `favoris.theme`). The values are JSON
// strings, as `localStorage` holds them.

/** The keys of a browser that used several spaces. */
export function multiSpaceStorage() {
  return {
    'favoris.spaces': JSON.stringify([
      { id: 'default', label: 'Mon espace', createdAt: 1700000000000 },
      { id: 'travail', label: 'Travail', createdAt: 1700000100000, synced: false },
      { id: 'lectures-2', label: 'Lectures', createdAt: 1700000200000, synced: true },
    ]),
    'favoris.currentSpace': 'travail',
    'favoris.theme': 'dark',
    'favoris.v1:default': JSON.stringify({
      tags: [
        { id: 'docs', label: 'Documentation', color: '#6366f1', featured: true },
        { id: 'tools', label: 'Outils', color: '#0d9488', collapsed: true },
        { id: 'reading', label: 'Lecture', color: '#d97706' },
      ],
      links: [
        { id: 'l1', name: 'MDN Web Docs', url: 'https://developer.mozilla.org', tag: 'docs' },
        { id: 'l2', name: 'GitHub', url: 'https://github.com', tag: 'tools' },
        { id: 'l3', name: 'Can I Use', url: 'https://caniuse.com', tag: 'docs' },
        // A link whose tag was deleted: the old app showed it in a card named after the tag id.
        { id: 'l4', name: 'Vieux lien', url: 'https://old.example', tag: '' },
        { id: 'l5', name: 'Tag disparu', url: 'https://gone.example', tag: 'ancien-tag' },
        // What the old import let through.
        { id: 'l6', name: 'Piégé', url: 'javascript:alert(document.cookie)', tag: 'docs' },
        { id: 'l7', name: 'Sans schéma', url: 'exemple.org', tag: 'reading' },
      ],
      editMode: true,
    }),
    'favoris.v1:travail': JSON.stringify({
      tags: [{ id: 'clients', label: 'Clients', color: '#db2777' }],
      links: [{ id: 't1', name: 'Intranet', url: 'https://intranet.example/', tag: 'clients' }],
      editMode: false,
    }),
    // `lectures-2` was never opened: it has no data key.
  };
}

/** The key of the versions before spaces: one space, one key. */
export function singleKeyStorage() {
  return {
    'favoris.v1': JSON.stringify({
      tags: [{ id: 'docs', label: 'Documentation', color: '#2563eb', featured: true }],
      links: [
        { id: 'a', name: 'MDN', url: 'https://developer.mozilla.org', tag: 'docs' },
        { id: 'b', name: 'Sans tag', url: 'https://example.org', tag: '' },
      ],
      editMode: false,
    }),
  };
}

/**
 * The file the previous version exported: no version, no envelope.
 */
export function legacyExportFile() {
  return {
    space: 'Travail',
    tags: [
      { id: 'clients', label: 'Clients', color: '#db2777', featured: true },
      { id: 'outils', label: 'Outils', color: '#0d9488' },
    ],
    links: [
      { id: 't1', name: 'Intranet', url: 'https://intranet.example/', tag: 'clients' },
      { id: 't2', name: 'Évil', url: 'JaVaScRiPt:alert(1)', tag: 'outils' },
      { id: 't3', name: 'Sans id', url: 'wiki.example', tag: 'outils' },
      { name: 'Pas de lien' },
    ],
  };
}
