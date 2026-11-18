import { describe, it, expect } from 'vitest';
import {
  BUILTIN_TEMPLATES,
  createLocalTemplate,
  instantiateChecklistTemplate,
  instantiateNoteTemplate,
  instantiateWhiteboardTemplate,
} from '../../src/core/templates.js';
import { createInitialState, createStore, selectTemplates } from '../../src/core/store.js';

describe('templates core & store', () => {
  it('fournit des modèles intégrés valides pour checklists, notes et tableaux blancs', () => {
    const checklists = BUILTIN_TEMPLATES.filter((t) => t.kind === 'checklist');
    const notes = BUILTIN_TEMPLATES.filter((t) => t.kind === 'note');
    const whiteboards = BUILTIN_TEMPLATES.filter((t) => t.kind === 'whiteboard');
    expect(checklists.length).toBeGreaterThanOrEqual(2);
    expect(notes.length).toBeGreaterThanOrEqual(2);
    expect(whiteboards.length).toBeGreaterThanOrEqual(2);

    const clTpl = checklists[0];
    if (!clTpl) throw new Error('missing checklist builtin');
    let idx = 0;
    const items = instantiateChecklistTemplate(clTpl, () => `ci-${++idx}`);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.done === false && i.id.startsWith('ci-'))).toBe(true);

    const flowTpl = whiteboards.find((t) => t.id === 'builtin-wb-flow');
    if (!flowTpl) throw new Error('missing flow builtin');
    let wbIdx = 0;
    const wbInst = instantiateWhiteboardTemplate(flowTpl, () => `el-${++wbIdx}`);
    expect(wbInst.elements).toHaveLength(5);
    const arrow = wbInst.elements.find((el) => el.type === 'arrow');
    expect(arrow?.startBinding?.elementId).toBe('el-1');
    expect(arrow?.endBinding?.elementId).toBe('el-2');
  });

  it('assainit les modèles personnalisés et exclut les images binaires orphelines', () => {
    expect(() =>
      createLocalTemplate({
        id: 'bad-1',
        kind: 'checklist',
        name: '   ',
        checklistItems: ['A'],
        now: '2026-11-15T10:00:00.000Z',
      }),
    ).toThrow();

    expect(() =>
      createLocalTemplate({
        id: 'bad-2',
        kind: 'whiteboard',
        name: 'Seulement image',
        elements: [
          {
            id: 'img-1',
            type: 'image',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            color: 'neutral',
            assetId: 'a1',
            zIndex: 0,
          },
        ],
        now: '2026-11-15T10:00:00.000Z',
      }),
    ).toThrow();

    const noteTpl = createLocalTemplate({
      id: 'tpl-n-1',
      kind: 'note',
      name: 'Ma trame',
      contentDoc: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section' }] },
          { type: 'localImage', attrs: { assetId: 'asset-123', alt: 'Photo' } },
          { type: 'paragraph', content: [{ type: 'text', text: 'Texte utile' }] },
        ],
      },
      now: '2026-11-15T10:00:00.000Z',
    });
    const instantiated = instantiateNoteTemplate(noteTpl);
    expect(JSON.stringify(instantiated)).not.toContain('localImage');
    expect(JSON.stringify(instantiated)).toContain('Texte utile');
  });

  it('gère création, sélection et suppression des modèles locaux dans le store', () => {
    const store = createStore(createInitialState());
    store.dispatch({
      type: 'create_template',
      id: 'custom-cl-1',
      kind: 'checklist',
      name: 'Checklist perso',
      checklistItems: ['Étape alpha', 'Étape bêta'],
      now: '2026-11-15T10:00:00.000Z',
    });

    const checklistTemplates = selectTemplates(store.getState(), 'checklist');
    expect(checklistTemplates.some((t) => t.id === 'custom-cl-1' && !t.builtin)).toBe(true);

    // Built-in templates cannot be deleted via delete_template
    const beforeLen = store.getState().templates.length;
    store.dispatch({ type: 'delete_template', id: 'builtin-checklist-release' });
    expect(store.getState().templates).toHaveLength(beforeLen);

    // Custom templates can be deleted
    const delRes = store.dispatch({ type: 'delete_template', id: 'custom-cl-1' });
    expect(delRes.effects).toEqual([{ type: 'remove_template', id: 'custom-cl-1' }]);
    expect(selectTemplates(store.getState(), 'checklist').some((t) => t.id === 'custom-cl-1')).toBe(
      false,
    );
  });
});
