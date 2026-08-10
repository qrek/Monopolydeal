import { describe, expect, it } from 'vitest';

import { reduce, reduceAll } from './reduce.ts';
import { bankTotal, isBroke, payableCards } from './selectors.ts';
import {
  act,
  bank,
  group,
  hand,
  money,
  newTable,
  player,
  prop,
} from './test-utils.ts';
import type { GameAction, GameState } from './types.ts';

/** p1 réclame 5M à p2 via Recouvrement, p2 accepte : on est en AWAITING_PAYMENT. */
function owe5(setup: (s: GameState) => void): GameState {
  const s = newTable();
  hand(s, 'p1', [act('DEBT_COLLECTOR', 0)]);
  setup(s);
  return reduceAll(s, [
    {
      type: 'PLAY_DEBT_COLLECTOR',
      playerId: 'p1',
      cardId: act('DEBT_COLLECTOR', 0),
      targetPlayerId: 'p2',
    },
    { type: 'RESPOND_ACCEPT', playerId: 'p2' },
  ]);
}

const pay = (cardIds: string[]): GameAction => ({
  type: 'PAY',
  playerId: 'p2',
  cardIds,
});

describe('Paiement', () => {
  it('accepte un paiement exact depuis la banque', () => {
    const mid = owe5((s) => bank(s, 'p2', [money(3, 0), money(2, 0)]));
    const out = reduce(mid, pay([money(3, 0), money(2, 0)]));
    expect(bankTotal(player(out, 'p1'))).toBe(5);
    expect(player(out, 'p2').bank).toHaveLength(0);
    expect(out.phase).toBe('PLAY');
  });

  it('ne rend pas la monnaie', () => {
    const mid = owe5((s) => bank(s, 'p2', [money(10, 0)]));
    const out = reduce(mid, pay([money(10, 0)]));
    expect(bankTotal(player(out, 'p1'))).toBe(10);
    expect(player(out, 'p2').bank).toHaveLength(0);
  });

  it('refuse un paiement insuffisant quand le joueur peut faire mieux', () => {
    const mid = owe5((s) => bank(s, 'p2', [money(1, 0), money(5, 0)]));
    expect(() => reduce(mid, pay([money(1, 0)]))).toThrow('manque');
  });

  it('accepte tout ce que le joueur possède quand c’est moins que la dette', () => {
    const mid = owe5((s) => bank(s, 'p2', [money(1, 0)]));
    const out = reduce(mid, pay([money(1, 0)]));
    expect(player(out, 'p2').bank).toHaveLength(0);
    expect(bankTotal(player(out, 'p1'))).toBe(1);
    expect(out.phase).toBe('PLAY');
  });

  it('éteint la dette d’un joueur qui n’a rien (cas 8)', () => {
    const s = newTable();
    hand(s, 'p1', [act('DEBT_COLLECTOR', 0)]);
    hand(s, 'p2', [money(5, 0)]); // en main : intouchable
    const out = reduceAll(s, [
      {
        type: 'PLAY_DEBT_COLLECTOR',
        playerId: 'p1',
        cardId: act('DEBT_COLLECTOR', 0),
        targetPlayerId: 'p2',
      },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
    ]);
    expect(isBroke(player(s, 'p2'))).toBe(true);
    expect(player(out, 'p2').hand).toEqual([money(5, 0)]);
    expect(player(out, 'p1').bank).toHaveLength(0);
    expect(out.phase).toBe('PLAY');
    expect(out.events.some((e) => e.t === 'DEBT_FORGIVEN')).toBe(true);
  });

  it('interdit de payer avec une carte de sa main', () => {
    const mid = owe5((s) => {
      bank(s, 'p2', [money(5, 0)]);
      hand(s, 'p2', [money(3, 0)]);
    });
    expect(() => reduce(mid, pay([money(3, 0)]))).toThrow('payable');
  });

  it('range une propriété reçue dans les propriétés et l’argent en banque', () => {
    const mid = owe5((s) => {
      bank(s, 'p2', [money(4, 0)]);
      group(s, 'p2', 'green', [prop('green', 0)]);
    });
    const out = reduce(mid, pay([money(4, 0), prop('green', 0)]));
    expect(player(out, 'p1').bank).toEqual([money(4, 0)]);
    expect(player(out, 'p1').groups[0]?.cards).toEqual([prop('green', 0)]);
    expect(player(out, 'p1').groups[0]?.color).toBe('green');
    expect(player(out, 'p2').groups).toHaveLength(0);
  });

  it('range une Maison reçue en paiement dans la banque du receveur', () => {
    const s = newTable();
    hand(s, 'p1', [act('DEBT_COLLECTOR', 0)]);
    group(s, 'p2', 'brown', [prop('brown', 0), prop('brown', 1)], {
      house: act('HOUSE', 0),
    });
    bank(s, 'p2', [money(2, 0)]);
    const mid = reduceAll(s, [
      {
        type: 'PLAY_DEBT_COLLECTOR',
        playerId: 'p1',
        cardId: act('DEBT_COLLECTOR', 0),
        targetPlayerId: 'p2',
      },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
    ]);
    const out = reduce(mid, pay([act('HOUSE', 0), money(2, 0)]));
    expect(player(out, 'p1').bank).toEqual([act('HOUSE', 0), money(2, 0)]);
    expect(player(out, 'p1').groups).toHaveLength(0);
    expect(player(out, 'p2').groups[0]?.house).toBeNull();
  });

  it('renvoie la construction en banque quand le paiement casse le lot', () => {
    const mid = owe5((s) => {
      group(s, 'p2', 'brown', [prop('brown', 0), prop('brown', 1)], {
        house: act('HOUSE', 0),
      });
      bank(s, 'p2', [money(10, 0)]);
    });
    const out = reduce(mid, pay([money(10, 0), prop('brown', 0)]));
    expect(player(out, 'p2').bank).toEqual([act('HOUSE', 0)]);
    expect(player(out, 'p2').groups[0]?.cards).toEqual([prop('brown', 1)]);
    expect(out.events.some((e) => e.t === 'BUILDING_RETURNED')).toBe(true);
  });

  it('refuse une carte dupliquée dans le paiement', () => {
    const mid = owe5((s) => bank(s, 'p2', [money(5, 0)]));
    expect(() => reduce(mid, pay([money(5, 0), money(5, 0)]))).toThrow();
  });

  it('refuse un paiement d’un joueur qui ne doit rien', () => {
    const mid = owe5((s) => bank(s, 'p2', [money(5, 0)]));
    expect(() =>
      reduce(mid, { type: 'PAY', playerId: 'p1', cardIds: [] }),
    ).toThrow();
  });

  it('liste banque, propriétés et constructions comme cartes payables', () => {
    const s = newTable();
    bank(s, 'p2', [money(1, 0)]);
    group(s, 'p2', 'brown', [prop('brown', 0), prop('brown', 1)], {
      house: act('HOUSE', 0),
      hotel: act('HOTEL', 0),
    });
    expect(payableCards(player(s, 'p2')).sort()).toEqual(
      [
        money(1, 0),
        prop('brown', 0),
        prop('brown', 1),
        act('HOUSE', 0),
        act('HOTEL', 0),
      ].sort(),
    );
  });

  it('journalise le paiement avec son montant', () => {
    const mid = owe5((s) => bank(s, 'p2', [money(5, 0)]));
    const out = reduce(mid, pay([money(5, 0)]));
    const paid = out.events.find((e) => e.t === 'PAID');
    expect(paid).toMatchObject({ fromId: 'p2', toId: 'p1', amount: 5 });
  });
});
