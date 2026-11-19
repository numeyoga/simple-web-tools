import { describe, expect, test } from 'vitest';
import { fmtDateISO } from '../../src/core/dates.js';
import { agregerSemaine, construireCSVRapport } from '../../src/core/report.js';
import { H, terminee } from './support/data.js';

const projets = [
  { id: 'p1', nom: 'Site "vitrine"', client: 'Café Müller' },
  { id: 'p2', nom: '=SOMME(A1:A2)', client: '@cible' },
];
const debut = new Date(2026, 10, 16, 9, 0).getTime();
const NOW = new Date(2026, 10, 18, 10, 0).getTime();
/** @param {Record<string, unknown>} [extra] */
const sess = (extra) =>
  /** @type {any} */ ({
    id: 's',
    projetId: 'p1',
    debut,
    fin: debut + 5400_000,
    duree: 5400_000,
    statut: 'termine',
    description: 'Maquette',
    ...extra,
  });
const csv = (/** @type {any[]} */ sessions) => construireCSVRapport(sessions, projets, NOW);

describe('construireCSVRapport', () => {
  test('est une fonction', () => {
    expect(typeof construireCSVRapport).toBe('function');
  });

  test('séparateur ; , BOM UTF-8 et fins de ligne CRLF', () => {
    const texte = csv([sess()]);

    expect(texte.charCodeAt(0)).toBe(0xfeff);
    const lignes = texte.slice(1).split('\r\n');
    expect(lignes[0]).toBe('"Date";"Projet";"Client";"Description";"Début";"Fin";"Durée (h)"');
    expect(lignes[1]?.split('";"')).toHaveLength(7);
    expect(!texte.slice(1).includes('\n') || texte.includes('\r\n')).toBe(true);
    expect(texte).toContain('Café Müller');
  });

  test('durée avec virgule décimale', () => {
    const ligne = csv([sess()]).slice(1).split('\r\n')[1] ?? '';

    expect(ligne.endsWith(';"1,50"')).toBe(true);
    expect(ligne).not.toContain('1.50');
  });

  test('guillemets doublés', () => {
    expect(csv([sess()])).toContain('"Site ""vitrine"""');
  });

  test('injection de formule neutralisée sur les champs texte uniquement', () => {
    const l = csv([
      sess({ projetId: 'p2', description: '+1+1' }),
      sess({ description: '-2' }),
      sess({ description: '@x' }),
      sess({ description: '=1+1' }),
    ])
      .slice(1)
      .split('\r\n');

    expect(l[1]).toContain(`"'=SOMME(A1:A2)"`);
    expect(l[1]).toContain(`"'@cible"`);
    expect(l[1]).toContain(`"'+1+1"`);
    expect(l[2]).toContain(`"'-2"`);
    expect(l[3]).toContain(`"'@x"`);
    expect(l[4]).toContain(`"'=1+1"`);
    // les champs non texte restent intacts (pas d'apostrophe sur date/heure/durée)
    expect(l[1]).not.toMatch(/"'\d/);
  });

  test("une session en cours compte jusqu'à now", () => {
    const enCours = sess({
      statut: 'en_cours',
      duree: 0,
      dernierDebut: NOW - 90 * 60_000,
      fin: null,
    });

    const ligne = csv([enCours]).slice(1).split('\r\n')[1] ?? '';

    expect(ligne.endsWith(';"";"1,50"')).toBe(true);
  });
});

describe('fmtDateISO', () => {
  test('donne la date locale', () => {
    expect(fmtDateISO(new Date(2026, 10, 16))).toBe('2026-11-16');
  });
});

describe('agregerSemaine', () => {
  test('totaux par jour et par projet de la semaine du lundi 16 au dimanche 22 novembre', () => {
    const lundi = terminee({ id: 'a', projetId: 'p1', debut, duree: 2 * H });
    const mardi = terminee({ id: 'b', projetId: 'p2', debut: debut + 26 * H, duree: H });
    const horsSemaine = terminee({
      id: 'c',
      projetId: 'p1',
      debut: debut - 7 * 24 * H,
      duree: 5 * H,
    });

    const s = agregerSemaine([lundi, mardi, horsSemaine], /** @type {any} */ (projets), 0, NOW);

    expect(fmtDateISO(s.lundi)).toBe('2026-11-16');
    expect(fmtDateISO(s.dimanche)).toBe('2026-11-22');
    expect(s.totalSemaine).toBe(3 * H);
    expect(s.totalSessions).toBe(2);
    expect(s.joursActifs).toBe(2);
    expect(s.parJour.map((j) => j.total)).toEqual([2 * H, H, 0, 0, 0, 0, 0]);
    expect(s.projetsTri.map((p) => [p.id, p.duree])).toEqual([
      ['p1', 2 * H],
      ['p2', H],
    ]);
    expect(s.maxJour).toBe(8 * H);
  });
});
