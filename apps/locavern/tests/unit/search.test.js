import { describe, it, expect } from 'vitest';
import {
  extractNoteSearchText,
  extractRichTextPlainText,
  extractTaskSearchText,
  extractWhiteboardSearchText,
  matchesSearchTokens,
  normalizeSearchText,
  tokenizeSearchQuery,
} from '../../src/core/search.js';
import { createNote, createTask, createWhiteboard } from '../../src/core/model.js';

describe('search', () => {
  const NOW = '2026-11-15T10:00:00.000Z';

  it('normalise sans accents ni casse et découpe en jetons', () => {
    expect(normalizeSearchText('  Échéance   Critique — Étape  ')).toBe(
      'echeance critique — etape',
    );
    expect(tokenizeSearchQuery('Échéance Critique')).toEqual(['echeance', 'critique']);
    expect(matchesSearchTokens('Vérifier échéance finale', ['echeance', 'finale'])).toBe(true);
    expect(matchesSearchTokens('Vérifier échéance finale', ['echeance', 'absent'])).toBe(false);
  });

  it('extrait le texte des documents Tiptap, checklists, notes et tableaux blancs', () => {
    /** @type {import('../../src/types.d.ts').RichTextDoc} */
    const richDoc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Architecture' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Synchronisation' },
            { type: 'hardBreak' },
            { type: 'text', text: 'IndexedDB locale.' },
          ],
        },
        {
          type: 'localImage',
          attrs: { assetId: 'a1', alt: 'Schéma réseau' },
        },
      ],
    };

    expect(extractRichTextPlainText(richDoc)).toContain('Architecture');
    expect(extractRichTextPlainText(richDoc)).toContain('IndexedDB locale.');
    expect(extractRichTextPlainText(richDoc)).toContain('Schéma réseau');

    const task = createTask({
      id: 't1',
      projectId: 'p1',
      title: 'Préparer démo',
      descriptionDoc: richDoc,
      checklist: [{ id: 'c1', text: 'Vérifier manifeste PWA', done: false }],
      now: NOW,
    });
    const taskHaystack = extractTaskSearchText(task);
    expect(taskHaystack).toContain('Préparer démo');
    expect(taskHaystack).toContain('IndexedDB locale.');
    expect(taskHaystack).toContain('Vérifier manifeste PWA');

    const note = createNote({
      id: 'n1',
      projectId: null,
      title: 'Compte rendu',
      contentDoc: richDoc,
      now: NOW,
    });
    expect(extractNoteSearchText(note)).toContain('Compte rendu');
    expect(extractNoteSearchText(note)).toContain('Synchronisation');

    const wb = createWhiteboard({
      id: 'wb1',
      projectId: null,
      title: 'Tableau flux',
      elements: [
        {
          id: 'el1',
          type: 'sticky',
          x: 0,
          y: 0,
          width: 180,
          height: 120,
          color: 'warning',
          text: 'Connecteur WebLocks',
          zIndex: 0,
        },
      ],
      now: NOW,
    });
    expect(extractWhiteboardSearchText(wb)).toContain('Tableau flux');
    expect(extractWhiteboardSearchText(wb)).toContain('Connecteur WebLocks');
  });
});
