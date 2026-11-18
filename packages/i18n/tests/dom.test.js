import { describe, expect, it } from 'vitest';
import { applyDocumentLanguage } from '../src/dom.js';

describe('applyDocumentLanguage', () => {
  it('sets <html lang> on the given document', () => {
    const doc = { documentElement: { lang: '' } };
    applyDocumentLanguage('fr', /** @type {any} */ (doc));
    expect(doc.documentElement.lang).toBe('fr');
  });
});
