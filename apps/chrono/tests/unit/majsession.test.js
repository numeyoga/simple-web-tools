import { describe, expect, test } from 'vitest';
import { majSession } from '../../src/core/sessions.js';
import { H, h, session, terminee, vide } from './support/data.js';

/** 9h-17h with 1 h of pause already counted: duree = 7 h. */
const base = () => ({ ...vide(), sessions: [terminee()] });

describe('majSession', () => {
  test('conserve les pauses déjà décomptées', () => {
    let d = majSession(base(), { id: 's1', patch: { fin: h(18) } });
    expect(session(d, 's1').duree).toBe(8 * H); // 9h-18h moins 1h de pause

    d = majSession(d, { id: 's1', patch: { debut: h(10) } });
    expect(session(d, 's1').duree).toBe(7 * H); // 10h-18h moins 1h de pause
  });

  test('duree explicite prioritaire, durée plancher à 0', () => {
    let d = majSession(base(), { id: 's1', patch: { fin: h(18), duree: 2 * H } });
    expect(session(d, 's1').duree).toBe(2 * H);

    d = majSession(d, { id: 's1', patch: { debut: h(18), fin: h(18) } });
    expect(session(d, 's1').duree).toBe(0);
  });

  test('session non terminée avant le patch : calcul fin - debut', () => {
    const d = {
      ...vide(),
      sessions: [terminee({ fin: null, duree: 30 * 60_000, statut: 'en_pause' })],
    };

    const apres = majSession(d, { id: 's1', patch: { statut: 'terminee', fin: h(11) } });

    expect(session(apres, 's1').duree).toBe(2 * H);
  });

  test('session sans pause : duree = fin - debut', () => {
    const d = { ...vide(), sessions: [terminee({ fin: h(10), duree: H })] };

    const apres = majSession(d, { id: 's1', patch: { fin: h(12) } });

    expect(session(apres, 's1').duree).toBe(3 * H);
  });

  test('ne modifie pas les données reçues', () => {
    const d = base();
    const avant = JSON.stringify(d);

    majSession(d, { id: 's1', patch: { fin: h(18) } });

    expect(JSON.stringify(d)).toBe(avant);
  });
});
