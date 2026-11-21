import { describe, it, expect } from 'vitest';
import { noteToMarkdown } from '../../src/core/markdown.js';
import { createNote } from '../../src/core/model.js';

describe('markdown', () => {
  const NOW = '2026-11-15T10:00:00.000Z';

  it('génère un document Markdown complet pour une note avec métadonnées', () => {
    const note = createNote({
      id: 'n1',
      projectId: 'p1',
      title: 'Architecture PWA',
      contentDoc: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Stockage' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'IndexedDB locale.' }] },
        ],
      },
      now: NOW,
    });

    const out = noteToMarkdown(note, { projectName: 'Locavern' });
    expect(
      out.startsWith('# Architecture PWA\n\n> Projet : Locavern · Mise à jour : 2026-11-15\n\n'),
    ).toBe(true);
    expect(out).toContain('### Stockage\n\nIndexedDB locale.\n');
  });
});
