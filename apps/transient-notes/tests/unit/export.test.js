// Exports of notes as text and Markdown, and the file names. No clock: the date of a file name
// is a local `YYYY-MM-DD` string given by the caller.
import { describe, expect, test } from 'vitest';
import {
  docToPlainText,
  exportFileName,
  noteToMarkdown,
  noteToText,
  notesForExport,
  notesToMarkdown,
  notesToText,
  safeFileName,
} from '../../src/core/export.js';
import { at, doc, docWithImage, note } from './support/data.js';

const labels = { untitled: 'Untitled', imageAlt: 'Image' };

/** @param {object[]} blocks @returns {import('../../src/types.d.ts').RichTextDoc} */
const withBlocks = (blocks) => /** @type {never} */ ({ type: 'doc', content: blocks });
const text = (/** @type {string} */ value) => ({ type: 'text', text: value });
const item = (/** @type {object[]} */ ...content) => ({ type: 'listItem', content });
const para = (/** @type {string} */ value) => ({ type: 'paragraph', content: [text(value)] });

describe('docToPlainText', () => {
  test('keeps the paragraphs as blocks and the lists as lines', () => {
    const d = withBlocks([
      { type: 'heading', attrs: { level: 1 }, content: [text('Plan')] },
      para('First paragraph'),
      { type: 'bulletList', content: [item(para('one')), item(para('two'))] },
      { type: 'orderedList', content: [item(para('a')), item(para('b'))] },
      {
        type: 'taskList',
        content: [
          { type: 'taskItem', attrs: { checked: true }, content: [para('done')] },
          { type: 'taskItem', attrs: { checked: false }, content: [para('todo')] },
        ],
      },
    ]);

    expect(docToPlainText(d, labels)).toBe(
      ['Plan', 'First paragraph', '- one\n- two', '1. a\n2. b', '[x] done\n[ ] todo'].join('\n\n'),
    );
  });

  test('indents a nested list and writes a hard break as a line break', () => {
    const d = withBlocks([
      {
        type: 'bulletList',
        content: [item(para('parent'), { type: 'bulletList', content: [item(para('child'))] })],
      },
      { type: 'paragraph', content: [text('a'), { type: 'hardBreak' }, text('b')] },
    ]);

    expect(docToPlainText(d, labels)).toBe('- parent\n  - child\n\na\nb');
  });

  test('a picture reads as its alt text in brackets, or the translated placeholder', () => {
    expect(docToPlainText(docWithImage('a1', 'Chart'), labels)).toBe('[Chart]');
    expect(docToPlainText(docWithImage('a1'), { imageAlt: 'Image' })).toBe('[Image]');
  });

  test('an empty or missing document is an empty text', () => {
    expect(docToPlainText(doc(), labels)).toBe('');
    expect(docToPlainText(null, labels)).toBe('');
  });
});

describe('text export', () => {
  test('one note: the title, a rule, the content', () => {
    const n = note({ id: 'n1', title: 'My note', doc: doc('Hello', 'World') });

    expect(noteToText(n, labels)).toBe(`My note\n${'='.repeat(50)}\n\nHello\n\nWorld\n`);
  });

  test('a note with no title or content still exports', () => {
    expect(noteToText(note({ id: 'n1', title: '  ' }), labels)).toBe(
      `Untitled\n${'='.repeat(50)}\n`,
    );
  });

  test('all notes: a translated header, then every note between rules', () => {
    const notes = [
      note({ id: 'a', title: 'A', doc: doc('one') }),
      note({ id: 'b', title: 'B', doc: doc('two') }),
    ];

    const out = notesToText(notes, {
      ...labels,
      heading: 'TRANSIENT NOTES - Full export',
      exportedAt: 'Date: Nov 18, 2026',
      count: 'Number of notes: 2',
    });

    expect(out).toBe(
      [
        'TRANSIENT NOTES - Full export',
        'Date: Nov 18, 2026',
        'Number of notes: 2',
        '='.repeat(80),
        '',
        `A\n${'='.repeat(50)}\n\none`,
        '',
        '='.repeat(80),
        '',
        `B\n${'='.repeat(50)}\n\ntwo`,
        '',
      ].join('\n'),
    );
  });
});

describe('Markdown export', () => {
  test('one note: a heading with the title, then the content as Markdown', () => {
    const n = note({
      id: 'n1',
      title: 'Plan',
      doc: withBlocks([para('Some text'), { type: 'bulletList', content: [item(para('x'))] }]),
    });

    expect(noteToMarkdown(n, labels)).toBe('# Plan\n\nSome text\n\n- x\n');
  });

  test('a picture keeps its asset address, with the translated placeholder as alt', () => {
    const n = note({ id: 'n1', title: 'T', doc: docWithImage('a1') });

    expect(noteToMarkdown(n, { untitled: 'Sans titre', imageAlt: 'Image' })).toBe(
      '# T\n\n![Image](local-asset://a1)\n',
    );
  });

  test('all notes are separated by a rule', () => {
    const out = notesToMarkdown(
      [
        note({ id: 'a', title: 'A', doc: doc('one') }),
        note({ id: 'b', title: '', doc: doc('two') }),
      ],
      labels,
    );

    expect(out).toBe('# A\n\none\n\n---\n\n# Untitled\n\ntwo\n');
  });
});

describe('notesForExport', () => {
  test('orders by last edit, newest first, without changing the given list', () => {
    const notes = [
      note({ id: 'old', updatedAt: at(1) }),
      note({ id: 'new', updatedAt: at(9) }),
      note({ id: 'mid', updatedAt: at(5) }),
    ];

    expect(notesForExport(notes).map((n) => n.id)).toEqual(['new', 'mid', 'old']);
    expect(notes.map((n) => n.id)).toEqual(['old', 'new', 'mid']);
  });
});

describe('safeFileName', () => {
  test.each([
    ['Plan 2026', 'Plan 2026'],
    ['a/b\\c:d*e?f"g<h>i|j', 'a b c d e f g h i j'],
    ['../../etc/passwd', 'etc passwd'],
    ['  .hidden  ', 'hidden'],
    ['trailing...', 'trailing'],
    ['tab\tand\nnewline', 'tab and newline'],
    ['Café ☕ notes', 'Café ☕ notes'],
  ])('%j becomes %j', (title, expected) => {
    expect(safeFileName(title, 'fallback')).toBe(expected);
  });

  test.each(['', '   ', '...', '///', 'CON', 'nul', 'COM1'])(
    'uses the fallback for %j',
    (title) => {
      expect(safeFileName(title, 'fallback')).toBe('fallback');
    },
  );

  test('is cut at 80 characters', () => {
    expect(safeFileName('x'.repeat(200), 'f')).toHaveLength(80);
  });
});

describe('exportFileName', () => {
  test('a note is named after its title', () => {
    expect(
      exportFileName({ kind: 'note', title: 'Meeting: Q4', fallback: 'Untitled', extension: 'md' }),
    ).toBe('Meeting Q4.md');
    expect(
      exportFileName({ kind: 'note', title: '', fallback: 'Untitled', extension: 'txt' }),
    ).toBe('Untitled.txt');
  });

  test('everything is named after the workspace and the local date', () => {
    expect(
      exportFileName({ kind: 'all', workspaceId: 'work', date: '2026-11-18', extension: 'txt' }),
    ).toBe('transient-notes-work-2026-11-18.txt');
    expect(
      exportFileName({
        kind: 'all',
        workspaceId: 'default',
        date: '2026-01-02',
        extension: 'json',
      }),
    ).toBe('transient-notes-default-2026-01-02.json');
  });
});
