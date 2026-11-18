import { describe, it, expect } from 'vitest';
import { noteToMarkdown, richTextDocToMarkdown } from '../../src/core/markdown.js';
import { createNote } from '../../src/core/model.js';

describe('markdown', () => {
  const NOW = '2026-11-15T10:00:00.000Z';

  it('convertit titres H1/H2/H3, marques en ligne, listes et images locales en Markdown', () => {
    /** @type {import('../../src/types.d.ts').RichTextDoc} */
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Grand Titre' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Sous-section' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Texte ' },
            { type: 'text', text: 'gras', marks: [{ type: 'bold' }] },
            { type: 'text', text: ', ' },
            { type: 'text', text: 'italique', marks: [{ type: 'italic' }] },
            { type: 'text', text: ', ' },
            { type: 'text', text: 'barré', marks: [{ type: 'strike' }] },
            { type: 'text', text: ', ' },
            { type: 'text', text: 'npm test', marks: [{ type: 'code' }] },
            { type: 'text', text: ' et ' },
            {
              type: 'text',
              text: 'documentation',
              marks: [{ type: 'link', attrs: { href: 'https://exemple.org/doc' } }],
            },
            { type: 'text', text: '.' },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Puce A' }] }],
            },
          ],
        },
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Étape 1' }] }],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Étape 2' }] }],
            },
          ],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fait' }] }],
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'À faire' }] }],
            },
          ],
        },
        { type: 'localImage', attrs: { assetId: 'img-1', alt: 'Capture locale' } },
      ],
    };

    const md = richTextDocToMarkdown(doc);
    expect(md).toContain('# Grand Titre');
    expect(md).toContain('## Section');
    expect(md).toContain('### Sous-section');
    expect(md).toContain(
      'Texte **gras**, *italique*, ~~barré~~, `npm test` et [documentation](https://exemple.org/doc).',
    );
    expect(md).toContain('- Puce A');
    expect(md).toContain('1. Étape 1\n2. Étape 2');
    expect(md).toContain('- [x] Fait\n- [ ] À faire');
    expect(md).toContain('![Capture locale](local-asset://img-1)');
  });

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
