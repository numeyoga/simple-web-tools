import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers/load.mjs';

const app = loadApp({ scripts: ['lib.js', 'Rapport.js'] });
const construire = app.UI.construireCSVRapport || app.construireCSVRapport;

const projets = [
  { id: 'p1', nom: 'Site "vitrine"', client: 'Café Müller' },
  { id: 'p2', nom: '=SOMME(A1:A2)', client: '@cible' },
];
const debut = new Date(2026, 10, 16, 9, 0).getTime();
const sess = (extra) => ({
  id: 's', projetId: 'p1', debut, fin: debut + 5400_000,
  duree: 5400_000, statut: 'termine', description: 'Maquette', ...extra,
});

test('construireCSVRapport est exposée', () => {
  assert.equal(typeof construire, 'function');
});

test('séparateur ; , BOM UTF-8 et fins de ligne CRLF', () => {
  const csv = construire([sess()], projets);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  const lignes = csv.slice(1).split('\r\n');
  assert.equal(lignes[0], '"Date";"Projet";"Client";"Description";"Début";"Fin";"Durée (h)"');
  assert.equal(lignes[1].split('";"').length, 7);
  assert.ok(!csv.slice(1).includes('\n') || csv.includes('\r\n'));
  assert.ok(csv.includes('Café Müller'));
});

test('durée avec virgule décimale', () => {
  const csv = construire([sess()], projets);
  const ligne = csv.slice(1).split('\r\n')[1];
  assert.ok(ligne.endsWith(';"1,50"'), ligne);
  assert.ok(!ligne.includes('1.50'));
});

test('guillemets doublés', () => {
  const csv = construire([sess()], projets);
  assert.ok(csv.includes('"Site ""vitrine"""'));
});

test('injection de formule neutralisée sur les champs texte uniquement', () => {
  const csv = construire([
    sess({ projetId: 'p2', description: '+1+1' }),
    sess({ description: '-2' }),
    sess({ description: '@x' }),
    sess({ description: '=1+1' }),
  ], projets);
  const l = csv.slice(1).split('\r\n');
  assert.ok(l[1].includes(`"'=SOMME(A1:A2)"`), l[1]);
  assert.ok(l[1].includes(`"'@cible"`), l[1]);
  assert.ok(l[1].includes(`"'+1+1"`), l[1]);
  assert.ok(l[2].includes(`"'-2"`));
  assert.ok(l[3].includes(`"'@x"`));
  assert.ok(l[4].includes(`"'=1+1"`));
  // les champs non texte restent intacts (pas d'apostrophe sur date/heure/durée)
  assert.ok(!/"'\d/.test(l[1]));
});

test('UI.fmtDateISO donne la date locale', () => {
  assert.equal(app.UI.fmtDateISO(new Date(2026, 10, 16)), '2026-11-16');
});
