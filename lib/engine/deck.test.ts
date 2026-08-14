import { describe, expect, it } from 'vitest';

import {
  ACTIONS,
  ALL_COLORS,
  CARDS,
  COLORS,
  DECK_COMPOSITION,
  canBank,
  colorsFor,
  freshDeckIds,
  getCard,
} from './cards.ts';
import { hashSeed, roomCodeFromSeed, shuffle } from './rng.ts';
import type { ActionKind, Card, CardKind } from './types.ts';

function ofKind(kind: CardKind): Card[] {
  return DECK_COMPOSITION.filter((c) => c.kind === kind);
}

/** Les quatre actions que seul le tête-à-tête distribue. */
const DUEL_ONLY: ActionKind[] = ['REFLECT', 'FINE', 'RATP_CHECK', 'TAIL'];

describe('Composition du deck', () => {
  it('contient 106 cartes (20 + 28 + 11 + 34 + 13)', () => {
    expect(DECK_COMPOSITION.length).toBe(106);
  });

  it('a 20 cartes Argent réparties selon la table', () => {
    const moneys = ofKind('MONEY');
    expect(moneys).toHaveLength(20);
    const counts: Record<number, number> = {};
    for (const m of moneys) counts[m.value] = (counts[m.value] ?? 0) + 1;
    expect(counts).toEqual({ 1: 6, 2: 5, 3: 3, 4: 3, 5: 2, 10: 1 });
  });

  it('a 28 cartes Propriété', () => {
    expect(ofKind('PROPERTY')).toHaveLength(28);
  });

  it('a autant de propriétés par couleur que la taille du lot', () => {
    // Le deck classique ne distribue pas les familles étendues.
    for (const color of colorsFor('CLASSIC')) {
      const n = ofKind('PROPERTY').filter(
        (c) => c.kind === 'PROPERTY' && c.color === color,
      ).length;
      expect(n).toBe(COLORS[color].size);
    }
  });

  it('a 9 jokers bicolores et 2 jokers universels', () => {
    expect(ofKind('WILD')).toHaveLength(9);
    expect(ofKind('WILD_ANY')).toHaveLength(2);
  });

  it('donne une valeur banque de 0M aux jokers universels, non posables en banque', () => {
    for (const c of ofKind('WILD_ANY')) {
      expect(c.value).toBe(0);
      expect(canBank(c.id)).toBe(false);
    }
  });

  it('a 34 cartes Action aux quantités annoncées', () => {
    // Le deck classique ne distribue pas les actions réservées au tête-à-tête :
    // leur quantité y est donc nulle, et pleine dans le catalogue.
    const actions = ofKind('ACTION');
    expect(actions).toHaveLength(34);
    for (const kind of Object.keys(ACTIONS) as ActionKind[]) {
      const n = actions.filter(
        (c) => c.kind === 'ACTION' && c.action === kind,
      ).length;
      expect(n, kind).toBe(DUEL_ONLY.includes(kind) ? 0 : ACTIONS[kind].qty);
    }
  });

  it('réserve quatre actions au tête-à-tête', () => {
    const compte = (ids: readonly string[], kind: ActionKind): number =>
      ids.map(getCard).filter((c) => c.kind === 'ACTION' && c.action === kind).length;
    const classique = freshDeckIds('CLASSIC');
    const duel = freshDeckIds('DUEL');
    for (const kind of DUEL_ONLY) {
      expect(compte(classique, kind), kind).toBe(0);
      expect(compte(duel, kind), kind).toBe(ACTIONS[kind].qty);
    }
    // Sept cartes de plus, et pas une de moins ailleurs.
    const ajout = DUEL_ONLY.reduce((n, k) => n + ACTIONS[k].qty, 0);
    expect(duel.length - classique.length).toBeGreaterThanOrEqual(ajout);
  });

  it('a 13 cartes Loyer dont 3 universelles', () => {
    const rents = ofKind('RENT');
    expect(rents).toHaveLength(13);
    expect(
      rents.filter((c) => c.kind === 'RENT' && c.universal),
    ).toHaveLength(3);
  });

  it("n'a aucun id dupliqué", () => {
    const ids = freshDeckIds();
    expect(new Set(ids).size).toBe(ids.length);
    // Le catalogue contient les cartes de TOUS les modes : il est plus large
    // que le deck classique, jamais plus étroit.
    expect(Object.keys(CARDS).length).toBeGreaterThanOrEqual(ids.length);
    const duel = freshDeckIds('DUEL');
    expect(new Set(duel).size).toBe(duel.length);
    expect(Object.keys(CARDS)).toHaveLength(duel.length);
  });

  it('le deck duel ajoute les aéroports et le métro au deck classique', () => {
    const classique = new Set(freshDeckIds('CLASSIC'));
    const duel = freshDeckIds('DUEL');
    expect(duel.length).toBeGreaterThan(classique.size);
    for (const id of classique) expect(duel).toContain(id);

    const extra = duel.filter((id) => !classique.has(id)).map(getCard);
    // 3 aéroports + 4 lignes de métro + 1 joker bicolore + 2 quittances.
    expect(extra.filter((c) => c.kind === 'PROPERTY')).toHaveLength(7);
    expect(extra.filter((c) => c.kind === 'WILD')).toHaveLength(1);
    expect(extra.filter((c) => c.kind === 'RENT')).toHaveLength(2);
  });

  it('aucune couleur étendue ne traîne dans le deck classique', () => {
    for (const id of freshDeckIds('CLASSIC')) {
      const card = getCard(id);
      if (card.kind === 'PROPERTY') {
        expect(['airport', 'metro']).not.toContain(card.color);
      }
      if (card.kind === 'WILD') {
        expect(card.colors.some((c) => c === 'airport' || c === 'metro')).toBe(false);
      }
      if (card.kind === 'RENT' && !card.universal) {
        expect(card.colors.some((c) => c === 'airport' || c === 'metro')).toBe(false);
      }
    }
  });

  it('respecte les grilles de loyer de la spec', () => {
    expect(COLORS.brown.rents).toEqual([1, 2]);
    expect(COLORS.lightblue.rents).toEqual([1, 2, 3]);
    expect(COLORS.pink.rents).toEqual([1, 2, 4]);
    expect(COLORS.orange.rents).toEqual([1, 3, 5]);
    expect(COLORS.red.rents).toEqual([2, 3, 6]);
    expect(COLORS.yellow.rents).toEqual([2, 4, 6]);
    expect(COLORS.green.rents).toEqual([2, 4, 7]);
    expect(COLORS.darkblue.rents).toEqual([3, 8]);
    expect(COLORS.black.rents).toEqual([1, 2, 3, 4]);
    expect(COLORS.turquoise.rents).toEqual([1, 2]);
  });

  it('interdit les constructions sur Transports et Services', () => {
    expect(COLORS.black.buildable).toBe(false);
    expect(COLORS.turquoise.buildable).toBe(false);
    expect(COLORS.brown.buildable).toBe(true);
  });

  it('donne à chaque propriété la valeur banque de sa couleur', () => {
    for (const c of ofKind('PROPERTY')) {
      if (c.kind !== 'PROPERTY') continue;
      expect(c.value).toBe(COLORS[c.color].value);
    }
  });

  it('nomme chaque propriété par une rue distincte', () => {
    const names = ofKind('PROPERTY').map((c) => c.label);
    expect(new Set(names).size).toBe(names.length);
    expect(getCard('prop-darkblue-1').label).toBe('Rue de la Paix');
  });
});

describe('Mélange déterministe', () => {
  it('produit le même ordre pour le même seed', () => {
    expect(shuffle(freshDeckIds(), 'abc')).toEqual(shuffle(freshDeckIds(), 'abc'));
  });

  it('produit un ordre différent pour un seed différent', () => {
    expect(shuffle(freshDeckIds(), 'abc')).not.toEqual(
      shuffle(freshDeckIds(), 'abd'),
    );
  });

  it('distingue les remélanges successifs du même seed', () => {
    expect(shuffle(freshDeckIds(), 'abc', 0)).not.toEqual(
      shuffle(freshDeckIds(), 'abc', 1),
    );
  });

  it('est une permutation stricte du deck', () => {
    const shuffled = shuffle(freshDeckIds(), 'xyz');
    expect(shuffled).toHaveLength(106);
    expect([...shuffled].sort()).toEqual([...freshDeckIds()].sort());
  });

  it('hash un seed de façon stable', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
  });

  it('dérive un code de partie de 4 lettres stable', () => {
    const code = roomCodeFromSeed('une-partie');
    expect(code).toHaveLength(4);
    expect(/^[A-Z]{4}$/.test(code)).toBe(true);
    expect(roomCodeFromSeed('une-partie')).toBe(code);
  });
});
