// Workspace API: JSON import (localStorage fallback and IndexedDB) and storage names.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createStore } from '../../src/adapters/store.js';
import { WORKSPACES } from '../../src/adapters/workspaces.js';
import {
  channelNameFor,
  dbNameFor,
  lsKeyFor,
  wsLoadList,
  wsSetActiveId,
} from '../../src/adapters/workspace-list.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { terminee } from './support/data.js';
import { lire } from './support/idb.js';

const KEY = 'chrono.fallback.default.v1';
const NOW = new Date(2026, 10, 18, 10, 0).getTime();
const hier = new Date(2026, 10, 17, 9, 0).getTime();
const S = terminee({ id: 's1', debut: 1, fin: 2, duree: 1 });

afterEach(uninstallBrowser);

describe('import sans IndexedDB', () => {
  test('écrit dans localStorage au format du repli, et le store le relit', async () => {
    const nav = installBrowser({ indexedDB: false });

    await WORKSPACES.importJSON('default', {
      data: {
        projets: [{ id: 'p1', nom: 'A' }],
        todos: [{ id: 't1', titre: 'x' }],
        sessions: [S],
        pointage: [{ id: 'pt1', type: 'arrivee', at: 5 }],
        activeId: 'zz',
      },
    });

    const saved = JSON.parse(nav.localStorage.getItem(KEY) ?? 'null');
    expect(Object.keys(saved).sort()).toEqual(['pointage', 'projets', 'sessions', 'todos']);
    expect(saved.projets).toHaveLength(1);
    expect(saved.sessions[0].id).toBe('s1');
    const store = createStore();
    await store.init({ seedIfEmpty: false });
    expect(store.state.pointage).toHaveLength(1);
  });

  test("tout invalide => erreur, rien d'écrit", async () => {
    const nav = installBrowser({ indexedDB: false });

    await expect(
      WORKSPACES.importJSON('default', {
        projets: [{ nom: 'x' }],
        sessions: [{ id: 's', statut: 'nope' }],
      }),
    ).rejects.toThrow(/aucune donnée valide/);

    expect(nav.localStorage.getItem(KEY)).toBeNull();
  });

  test('fichier vide mais bien formé => accepté', async () => {
    const nav = installBrowser({ indexedDB: false });

    await WORKSPACES.importJSON('default', { projets: [], sessions: [] });

    expect(JSON.parse(nav.localStorage.getItem(KEY) ?? 'null').projets).toHaveLength(0);
  });

  test('les todos importés (ancien format) sont migrés', async () => {
    const nav = installBrowser({ indexedDB: false, now: NOW });
    const t = (/** @type {string} */ id, /** @type {string} */ echeance) => ({
      id,
      titre: id,
      fait: false,
      projetId: null,
      echeance,
      creeLe: hier,
    });

    await WORKSPACES.importJSON('default', {
      data: { todos: [t('a', 'today'), t('b', 'nimporte'), t('c', '2026-11-30')] },
    });

    const saved = JSON.parse(nav.localStorage.getItem(KEY) ?? 'null');
    expect(saved.todos.map((/** @type {{ echeance: string | null }} */ x) => x.echeance)).toEqual([
      '2026-11-17',
      null,
      '2026-11-30',
    ]);
  });
});

describe('import avec IndexedDB', () => {
  test('remplace le contenu de la base du workspace', async () => {
    installBrowser();
    const store = createStore();
    await store.init({ seedIfEmpty: false });
    store.actions.ajouterProjet('Ancien');
    await store.flush();

    await WORKSPACES.importJSON('default', { data: { projets: [{ id: 'p1', nom: 'Nouveau' }] } });

    expect((await lire('chrono__default', 'projets')).map((p) => p.nom)).toEqual(['Nouveau']);
    // L'import prévient les autres onglets : ils relisent la base.
    await vi.waitFor(() => expect(store.state.projets.map((p) => p.nom)).toEqual(['Nouveau']));
  });
});

describe("noms de stockage préfixés par l'application (décision 0005)", () => {
  test('bases, clés de repli et canaux commencent par « chrono »', () => {
    expect(dbNameFor('abc')).toBe('chrono__abc');
    expect(lsKeyFor('abc')).toBe('chrono.fallback.abc.v1');
    expect(channelNameFor('abc')).toBe('chrono:abc');
  });

  test("la liste des espaces et l'espace actif aussi", () => {
    const nav = installBrowser({ indexedDB: false });

    wsLoadList();
    wsSetActiveId('default');

    expect(nav.localStorage.keys().sort()).toEqual([
      'chrono.workspace.active',
      'chrono.workspaces',
    ]);
  });
});
