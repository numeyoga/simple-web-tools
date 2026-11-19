import { describe, expect, test } from 'vitest';
import { construireExport, validerImport } from '../../src/core/import-export.js';
import { terminee, vide } from './support/data.js';

const NOW = new Date(2026, 10, 18, 10, 0).getTime();
const S = terminee({ id: 's1', debut: 1, fin: 2, duree: 1 });

describe('validerImport', () => {
  test('filtre les éléments invalides', () => {
    const r = validerImport(
      {
        projets: [{ id: 'p1' }, { id: 3 }, null, 'x', { nom: 'sans id' }],
        sessions: [
          S,
          { ...S, id: 's2', statut: 'bizarre' },
          { ...S, id: 's3', statut: 'en_cours' },
          { ...S, id: 's4', statut: 'en_pause' },
        ],
      },
      NOW,
    );

    expect(r.projets.map((p) => p.id)).toEqual(['p1']);
    expect(r.sessions.map((s) => s.id)).toEqual(['s1', 's3', 's4']);
  });

  test('tout invalide => erreur', () => {
    expect(() =>
      validerImport({ projets: [{ nom: 'x' }], sessions: [{ id: 's', statut: 'nope' }] }, NOW),
    ).toThrow(/aucune donnée valide/);
  });

  test('fichier vide mais bien formé => accepté', () => {
    const r = validerImport({ projets: [], sessions: [] }, NOW);

    expect(r).toEqual({ projets: [], todos: [], sessions: [], pointage: [] });
  });

  test("accepte une enveloppe d'export et ignore les clés inconnues", () => {
    const r = validerImport(
      {
        data: {
          projets: [{ id: 'p1', nom: 'A' }],
          todos: [{ id: 't1', titre: 'x' }],
          sessions: [S],
          pointage: [{ id: 'pt1', type: 'arrivee', at: 5 }],
          activeId: 'zz',
        },
      },
      NOW,
    );

    expect(Object.keys(r).sort()).toEqual(['pointage', 'projets', 'sessions', 'todos']);
  });

  test("rejette un format qui n'est pas un objet", () => {
    expect(() => validerImport(null, NOW)).toThrow(/format invalide/);
  });

  test('migre les échéances des todos importés (ancien format)', () => {
    const hier = new Date(2026, 10, 17, 9, 0).getTime();
    const todo = (/** @type {string} */ id, /** @type {string} */ echeance) => ({
      id,
      titre: id,
      fait: false,
      projetId: null,
      echeance,
      creeLe: hier,
    });

    const r = validerImport(
      { data: { todos: [todo('a', 'today'), todo('b', 'nimporte'), todo('c', '2026-11-30')] } },
      NOW,
    );

    expect(r.todos.map((x) => x.echeance)).toEqual(['2026-11-17', null, '2026-11-30']);
  });
});

describe('construireExport', () => {
  test("format version 1 : espace, heure d'export et les quatre collections", () => {
    const ws = { id: 'default', label: 'Espace principal', creeLe: 1 };
    const data = {
      ...vide(),
      projets: [{ id: 'p1', nom: 'A', couleur: '#000', client: '', archive: false }],
    };

    const out = construireExport(data, ws, Date.UTC(2026, 10, 18, 9, 0));

    expect(out).toEqual({
      version: 1,
      exporteLe: '2026-11-18T09:00:00.000Z',
      workspace: ws,
      data: { projets: data.projets, todos: [], sessions: [], pointage: [] },
    });
  });
});
