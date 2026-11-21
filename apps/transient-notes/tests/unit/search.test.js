import { describe, expect, test } from 'vitest';
import {
  matchesSearchTokens,
  normalizeSearchText,
  noteMatches,
  notePreview,
  tokenizeSearchQuery,
} from '../../src/core/search.js';
import { doc, docWithImage, note } from './support/data.js';

describe('normalizeSearchText', () => {
  test('lowercases, drops accents, collapses whitespace', () => {
    expect(normalizeSearchText('  Éléphant   ÇA\tva  ')).toBe('elephant ca va');
  });
});

describe('tokenizeSearchQuery', () => {
  test('splits into normalized words; blank gives none', () => {
    expect(tokenizeSearchQuery(' Réunion  Équipe ')).toEqual(['reunion', 'equipe']);
    expect(tokenizeSearchQuery('   ')).toEqual([]);
  });
});

describe('matchesSearchTokens', () => {
  test('every token must be found; no token matches everything', () => {
    expect(matchesSearchTokens('Plan du projet', tokenizeSearchQuery('PLAN projet'))).toBe(true);
    expect(matchesSearchTokens('Plan du projet', tokenizeSearchQuery('plan budget'))).toBe(false);
    expect(matchesSearchTokens('anything', [])).toBe(true);
  });
});

describe('noteMatches', () => {
  const n = note({
    id: 'n1',
    title: 'Compte rendu',
    doc: doc('Décision sur le BUDGET', 'à suivre'),
  });

  test('finds words of the title and of the content, ignoring case and accents', () => {
    expect(noteMatches(n, tokenizeSearchQuery('COMPTE'))).toBe(true);
    expect(noteMatches(n, tokenizeSearchQuery('decision budget'))).toBe(true);
    expect(noteMatches(n, tokenizeSearchQuery('a suivre rendu'))).toBe(true); // title and content
    expect(noteMatches(n, tokenizeSearchQuery('absent'))).toBe(false);
  });

  test('a blank query matches every note', () => {
    expect(noteMatches(n, [])).toBe(true);
  });

  test('also finds the alt text of a picture', () => {
    const withPicture = note({ id: 'n2', doc: docWithImage('a1', 'Whiteboard photo') });

    expect(noteMatches(withPicture, tokenizeSearchQuery('whiteboard'))).toBe(true);
  });
});

describe('notePreview', () => {
  test('is the plain text of the content, cut with an ellipsis', () => {
    const n = note({ id: 'n1', doc: doc('Hello world', 'second paragraph') });

    expect(notePreview(n)).toBe('Hello world second paragraph');
    expect(notePreview(n, 5)).toBe('Hello…');
  });
});
