// plagesPresence / dureePresence (core/presence.js) and tronquerSurPresence (core/sessions.js),
// the latter through the public rules that trigger it.
import { describe, expect, test } from 'vitest';
import { pointer } from '../../src/core/pointage.js';
import { dureePresence, plagesPresence } from '../../src/core/presence.js';
import {
  arreterSession,
  arreterTout,
  demarrer,
  pauserSession,
  reprendreSession,
} from '../../src/core/sessions.js';
import { H, h, session, vide } from './support/data.js';

describe('plagesPresence', () => {
  test("plages fermées, plage ouverte jusqu'à now", () => {
    /** @type {{ type: import('../../src/types.js').TypePointage, at: number }[]} */
    const ev = [
      { type: 'pause_debut', at: h(12) },
      { type: 'arrivee', at: h(9) },
      { type: 'pause_fin', at: h(13) },
      { type: 'depart', at: h(17) },
    ];
    const bornes = (/** @type {{ debut: number, fin: number }[]} */ plages) =>
      plages.map((p) => [p.debut, p.fin]);

    expect(bornes(plagesPresence(ev, h(18)))).toEqual([
      [h(9), h(12)],
      [h(13), h(17)],
    ]);
    expect(bornes(plagesPresence(ev.slice(0, 2), h(15)))).toEqual([[h(9), h(12)]]);
    expect(bornes(plagesPresence([{ type: 'arrivee', at: h(9) }], h(11)))).toEqual([[h(9), h(11)]]);
    expect(dureePresence(ev, h(18))).toBe(7 * H);
    expect(dureePresence([], h(18))).toBe(0);
  });
});

describe('troncature des sessions sur la présence', () => {
  test('deux chronos parallèles de 9h à 10h, présence 9h-10h : aucune coupe', () => {
    let d = pointer(vide(), { type: 'arrivee' }, h(9), 'pt1');
    d = demarrer(d, { projetId: 'p1', description: 'a' }, h(9), 'a');
    d = demarrer(d, { projetId: 'p2', description: 'b' }, h(9), 'b');
    d = arreterTout(d, h(10));

    expect(session(d, 'a').duree).toBe(H);
    expect(session(d, 'b').duree).toBe(H);
    expect(session(d, 'a').debut).toBe(h(9));
  });

  test('chrono 8h-12h, arrivée à 9h : durée 3h et début à 9h', () => {
    let d = demarrer(vide(), { projetId: 'p1', description: 'x' }, h(8), 'a');
    d = pointer(d, { type: 'arrivee' }, h(9), 'pt1');
    d = arreterSession(d, { id: 'a' }, h(12));

    expect(session(d, 'a').duree).toBe(3 * H);
    expect(session(d, 'a').debut).toBe(h(9));
    expect(session(d, 'a').fin).toBe(h(12));
  });

  test('chrono 9h-17h avec pause pointée 12h-13h : durée 7h, rien de coupé', () => {
    let d = pointer(vide(), { type: 'arrivee' }, h(9), 'pt1');
    d = demarrer(d, { projetId: 'p1', description: 'x' }, h(9), 'a');
    d = pointer(d, { type: 'pause_debut' }, h(12), 'pt2');
    d = pointer(d, { type: 'pause_fin' }, h(13), 'pt3');
    d = arreterSession(d, { id: 'a' }, h(17));

    expect(session(d, 'a').duree).toBe(7 * H);
    expect(session(d, 'a').debut).toBe(h(9));
    expect(session(d, 'a').fin).toBe(h(17));
  });

  test("sans arrivée ce jour-là : rien n'est coupé", () => {
    let d = demarrer(vide(), { projetId: 'p1', description: 'x' }, h(8), 'a');
    d = arreterSession(d, { id: 'a' }, h(12));

    expect(session(d, 'a').duree).toBe(4 * H);
    expect(session(d, 'a').debut).toBe(h(8));
  });

  test("chrono mis en pause avant l'arrivée : seule la durée est coupée, pas le début", () => {
    let d = demarrer(vide(), { projetId: 'p1', description: 'x' }, h(8), 'a');
    d = pauserSession(d, { id: 'a' }, h(9)); // 1h comptée
    d = pointer(d, { type: 'arrivee' }, h(10), 'pt1');
    d = reprendreSession(d, { id: 'a' }, h(10));
    d = arreterSession(d, { id: 'a' }, h(10, 30)); // 1h30 comptées, 2h30 de bloc

    // présence 10h-10h30 = 30 min : durée ramenée à 30 min, début inchangé (pause existante)
    expect(session(d, 'a').duree).toBe(30 * 60_000);
    expect(session(d, 'a').debut).toBe(h(8));
    expect(session(d, 'a').fin).toBe(h(10, 30));
  });

  test('départ : les chronos arrêtés sont tronqués sur la présence', () => {
    let d = demarrer(vide(), { projetId: 'p1', description: 'x' }, h(8), 'a');
    d = pointer(d, { type: 'arrivee' }, h(9), 'pt1');
    d = pointer(d, { type: 'depart' }, h(11), 'pt2');

    expect(session(d, 'a').duree).toBe(2 * H);
    expect(session(d, 'a').debut).toBe(h(9));
  });
});
