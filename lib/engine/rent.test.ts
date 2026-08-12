import { describe, expect, it } from 'vitest';

import { reduce, reduceAll } from './reduce.ts';
import { bestRentForColor } from './selectors.ts';
import {
  act,
  bank,
  group,
  hand,
  money,
  newTable,
  player,
  prop,
  rent,
  rentAny,
} from './test-utils.ts';

describe('Cartes Loyer', () => {
  it('réclame le loyer de la couleur choisie au nombre de cartes possédées', () => {
    const s = newTable();
    hand(s, 'p1', [rent('red', 'yellow', 0)]);
    group(s, 'p1', 'red', [prop('red', 0), prop('red', 1)]);
    bank(s, 'p2', [money(3, 0)]);
    const mid = reduceAll(s, [
      {
        type: 'PLAY_RENT',
        playerId: 'p1',
        cardId: rent('red', 'yellow', 0),
        color: 'red',
        targetPlayerId: 'p2',
      },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
    ]);
    expect(mid.pending?.targets[0]?.debt).toBe(3);
  });

  it('refuse une couleur où le joueur ne possède rien (cas 15)', () => {
    const s = newTable();
    hand(s, 'p1', [rent('red', 'yellow', 0)]);
    group(s, 'p1', 'red', []);
    expect(() =>
      reduce(s, {
        type: 'PLAY_RENT',
        playerId: 'p1',
        cardId: rent('red', 'yellow', 0),
        color: 'yellow',
        targetPlayerId: 'p2',
      }),
    ).toThrow('Aucune carte possédée');
  });

  it('refuse une couleur absente de la carte Loyer', () => {
    const s = newTable();
    hand(s, 'p1', [rent('red', 'yellow', 0)]);
    group(s, 'p1', 'green', [prop('green', 0)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_RENT',
        playerId: 'p1',
        cardId: rent('red', 'yellow', 0),
        color: 'green',
        targetPlayerId: 'p2',
      }),
    ).toThrow('ne couvre pas');
  });

  it('accepte n’importe quelle couleur avec le Loyer universel', () => {
    const s = newTable();
    hand(s, 'p1', [rentAny(0)]);
    group(s, 'p1', 'green', [prop('green', 0), prop('green', 1)]);
    bank(s, 'p2', [money(10, 0)]);
    const mid = reduceAll(s, [
      {
        type: 'PLAY_RENT',
        playerId: 'p1',
        cardId: rentAny(0),
        color: 'green',
        targetPlayerId: 'p2',
      },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
    ]);
    expect(mid.pending?.targets[0]?.debt).toBe(4);
  });

  it('ne vise qu’un seul adversaire', () => {
    const s = newTable(3);
    hand(s, 'p1', [rentAny(0)]);
    group(s, 'p1', 'green', [prop('green', 0)]);
    const mid = reduce(s, {
      type: 'PLAY_RENT',
      playerId: 'p1',
      cardId: rentAny(0),
      color: 'green',
      targetPlayerId: 'p3',
    });
    expect(mid.pending?.targets).toHaveLength(1);
    expect(mid.pending?.targets[0]?.playerId).toBe('p3');
  });

  it('retient le meilleur lot quand plusieurs lots partagent la couleur', () => {
    const s = newTable();
    group(s, 'p1', 'green', [prop('green', 0)]);
    group(s, 'p1', 'green', [prop('green', 1), prop('green', 2)]);
    expect(bestRentForColor(player(s, 'p1'), 'green')).toBe(4);
  });

  it('inclut le bonus des constructions', () => {
    const s = newTable();
    group(s, 'p1', 'brown', [prop('brown', 0), prop('brown', 1)], {
      house: act('HOUSE', 0),
      hotel: act('HOTEL', 0),
    });
    expect(bestRentForColor(player(s, 'p1'), 'brown')).toBe(2 + 3 + 4);
  });

  it('peut être annulé par un Refus catégorique', () => {
    const s = newTable();
    hand(s, 'p1', [rentAny(0)]);
    hand(s, 'p2', [act('JUST_SAY_NO', 0)]);
    group(s, 'p1', 'green', [prop('green', 0)]);
    bank(s, 'p2', [money(5, 0)]);
    const out = reduceAll(s, [
      {
        type: 'PLAY_RENT',
        playerId: 'p1',
        cardId: rentAny(0),
        color: 'green',
        targetPlayerId: 'p2',
      },
      { type: 'RESPOND_JUST_SAY_NO', playerId: 'p2', cardId: act('JUST_SAY_NO', 0) },
      { type: 'RESPOND_ACCEPT', playerId: 'p1' },
    ]);
    expect(player(out, 'p2').bank).toEqual([money(5, 0)]);
    expect(out.phase).toBe('PLAY');
  });
});

describe('Double loyer', () => {
  it('double le montant et consomme une action supplémentaire', () => {
    const s = newTable();
    hand(s, 'p1', [rentAny(0), act('DOUBLE_RENT', 0)]);
    group(s, 'p1', 'green', [prop('green', 0), prop('green', 1)]);
    bank(s, 'p2', [money(10, 0)]);
    const mid = reduceAll(s, [
      {
        type: 'PLAY_RENT',
        playerId: 'p1',
        cardId: rentAny(0),
        color: 'green',
        targetPlayerId: 'p2',
        doubleCardIds: [act('DOUBLE_RENT', 0)],
      },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
    ]);
    expect(mid.actionsPlayed).toBe(2);
    expect(mid.pending?.targets[0]?.debt).toBe(8);
  });

  it('est refusé s’il ne reste qu’une action (cas 5)', () => {
    const s = newTable();
    s.actionsPlayed = 2;
    hand(s, 'p1', [rentAny(0), act('DOUBLE_RENT', 0)]);
    group(s, 'p1', 'green', [prop('green', 0)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_RENT',
        playerId: 'p1',
        cardId: rentAny(0),
        color: 'green',
        targetPlayerId: 'p2',
        doubleCardIds: [act('DOUBLE_RENT', 0)],
      }),
    ).toThrow('action');
  });

  it('quadruple le loyer avec deux Double loyer (cas 6)', () => {
    const s = newTable();
    hand(s, 'p1', [rentAny(0), act('DOUBLE_RENT', 0), act('DOUBLE_RENT', 1)]);
    group(s, 'p1', 'green', [prop('green', 0), prop('green', 1)]);
    bank(s, 'p2', [money(10, 0)]);
    const mid = reduceAll(s, [
      {
        type: 'PLAY_RENT',
        playerId: 'p1',
        cardId: rentAny(0),
        color: 'green',
        targetPlayerId: 'p2',
        doubleCardIds: [act('DOUBLE_RENT', 0), act('DOUBLE_RENT', 1)],
      },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
    ]);
    expect(mid.actionsPlayed).toBe(3);
    expect(mid.pending?.targets[0]?.debt).toBe(16);
  });

  it('refuse deux Double loyer s’il ne reste que deux actions (cas 6)', () => {
    const s = newTable();
    s.actionsPlayed = 1;
    hand(s, 'p1', [rentAny(0), act('DOUBLE_RENT', 0), act('DOUBLE_RENT', 1)]);
    group(s, 'p1', 'green', [prop('green', 0)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_RENT',
        playerId: 'p1',
        cardId: rentAny(0),
        color: 'green',
        targetPlayerId: 'p2',
        doubleCardIds: [act('DOUBLE_RENT', 0), act('DOUBLE_RENT', 1)],
      }),
    ).toThrow();
  });

  it('refuse deux fois la même carte Double loyer', () => {
    const s = newTable();
    hand(s, 'p1', [rentAny(0), act('DOUBLE_RENT', 0)]);
    group(s, 'p1', 'green', [prop('green', 0)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_RENT',
        playerId: 'p1',
        cardId: rentAny(0),
        color: 'green',
        targetPlayerId: 'p2',
        doubleCardIds: [act('DOUBLE_RENT', 0), act('DOUBLE_RENT', 0)],
      }),
    ).toThrow();
  });

  it('défausse la carte Loyer et les Double loyer', () => {
    const s = newTable();
    hand(s, 'p1', [rentAny(0), act('DOUBLE_RENT', 0)]);
    group(s, 'p1', 'green', [prop('green', 0)]);
    const mid = reduce(s, {
      type: 'PLAY_RENT',
      playerId: 'p1',
      cardId: rentAny(0),
      color: 'green',
      targetPlayerId: 'p2',
      doubleCardIds: [act('DOUBLE_RENT', 0)],
    });
    expect(mid.discard).toEqual([rentAny(0), act('DOUBLE_RENT', 0)]);
    expect(player(mid, 'p1').hand).toHaveLength(0);
  });

  describe('Constructions', () => {
    it('la Maison augmente le loyer d’un lot complet', () => {
      const s = newTable();
      hand(s, 'p1', [rent('red', 'yellow', 0)]);
      group(s, 'p1', 'red', [prop('red', 0), prop('red', 1), prop('red', 2)]);
      const lot = player(s, 'p1').groups[0]!;
      lot.house = act('HOUSE', 0);
      bank(s, 'p2', [money(10, 0)]);
      const mid = reduceAll(s, [
        { type: 'PLAY_RENT', playerId: 'p1', cardId: rent('red', 'yellow', 0), color: 'red' },
        { type: 'RESPOND_ACCEPT', playerId: 'p2' },
      ]);
      // Rouge complet = 6 M, plus 3 M de Maison.
      expect(mid.pending?.targets[0]?.debt).toBe(9);
    });

    it('Maison et Hôtel se cumulent', () => {
      const s = newTable();
      hand(s, 'p1', [rent('red', 'yellow', 0)]);
      group(s, 'p1', 'red', [prop('red', 0), prop('red', 1), prop('red', 2)]);
      const lot = player(s, 'p1').groups[0]!;
      lot.house = act('HOUSE', 0);
      lot.hotel = act('HOTEL', 0);
      bank(s, 'p2', [money(10, 0)]);
      const mid = reduceAll(s, [
        { type: 'PLAY_RENT', playerId: 'p1', cardId: rent('red', 'yellow', 0), color: 'red' },
        { type: 'RESPOND_ACCEPT', playerId: 'p2' },
      ]);
      expect(mid.pending?.targets[0]?.debt).toBe(6 + 3 + 4);
    });

    it('un lot incomplet ne profite d’aucune construction', () => {
      const s = newTable();
      hand(s, 'p1', [rent('red', 'yellow', 0)]);
      group(s, 'p1', 'red', [prop('red', 0), prop('red', 1)]);
      const lot = player(s, 'p1').groups[0]!;
      lot.house = act('HOUSE', 0);
      bank(s, 'p2', [money(10, 0)]);
      const mid = reduceAll(s, [
        { type: 'PLAY_RENT', playerId: 'p1', cardId: rent('red', 'yellow', 0), color: 'red' },
        { type: 'RESPOND_ACCEPT', playerId: 'p2' },
      ]);
      expect(mid.pending?.targets[0]?.debt).toBe(3);
    });

    it('le Double loyer double aussi les constructions', () => {
      const s = newTable();
      hand(s, 'p1', [rent('red', 'yellow', 0), act('DOUBLE_RENT', 0)]);
      group(s, 'p1', 'red', [prop('red', 0), prop('red', 1), prop('red', 2)]);
      const lot = player(s, 'p1').groups[0]!;
      lot.house = act('HOUSE', 0);
      bank(s, 'p2', [money(10, 0), money(10, 0)]);
      const mid = reduceAll(s, [
        {
          type: 'PLAY_RENT',
          playerId: 'p1',
          cardId: rent('red', 'yellow', 0),
          color: 'red',
          doubleCardIds: [act('DOUBLE_RENT', 0)],
        },
        { type: 'RESPOND_ACCEPT', playerId: 'p2' },
      ]);
      expect(mid.pending?.targets[0]?.debt).toBe(18);
    });
  });

  describe('Portée : bicolore contre universelle', () => {
    it('une quittance bicolore frappe tous les adversaires', () => {
      const s = newTable(4);
      hand(s, 'p1', [rent('red', 'yellow', 0)]);
      group(s, 'p1', 'red', [prop('red', 0), prop('red', 1)]);
      // Sans banque, une cible ruinée voit sa dette s'éteindre aussitôt : ce
      // n'est pas ce qu'on mesure ici.
      bank(s, 'p2', [money(5, 0)]);
      bank(s, 'p3', [money(5, 1)]);
      bank(s, 'p4', [money(4, 0)]);
      const mid = reduce(s, {
        type: 'PLAY_RENT',
        playerId: 'p1',
        cardId: rent('red', 'yellow', 0),
        color: 'red',
      });
      expect(mid.pending?.targets.map((t) => t.playerId)).toEqual([
        'p2',
        'p3',
        'p4',
      ]);
      // Chacun doit le loyer plein : on ne partage pas la note. La dette est
      // inscrite quand la cible renonce à refuser.
      const after = reduceAll(mid, [
        { type: 'RESPOND_ACCEPT', playerId: 'p2' },
        { type: 'RESPOND_ACCEPT', playerId: 'p3' },
        { type: 'RESPOND_ACCEPT', playerId: 'p4' },
      ]);
      expect(after.pending?.targets.every((t) => t.debt === 3)).toBe(true);
    });

    it('la cible désignée est ignorée sur une bicolore', () => {
      const s = newTable(3);
      hand(s, 'p1', [rent('red', 'yellow', 0)]);
      group(s, 'p1', 'red', [prop('red', 0)]);
      const mid = reduce(s, {
        type: 'PLAY_RENT',
        playerId: 'p1',
        cardId: rent('red', 'yellow', 0),
        color: 'red',
        targetPlayerId: 'p2',
      });
      expect(mid.pending?.targets.map((t) => t.playerId)).toEqual(['p2', 'p3']);
    });

    it('une quittance universelle ne vise qu’un joueur', () => {
      const s = newTable(4);
      hand(s, 'p1', [rentAny(0)]);
      group(s, 'p1', 'green', [prop('green', 0)]);
      const mid = reduce(s, {
        type: 'PLAY_RENT',
        playerId: 'p1',
        cardId: rentAny(0),
        color: 'green',
        targetPlayerId: 'p3',
      });
      expect(mid.pending?.targets.map((t) => t.playerId)).toEqual(['p3']);
    });

    it('refuse une quittance universelle sans cible', () => {
      const s = newTable(3);
      hand(s, 'p1', [rentAny(0)]);
      group(s, 'p1', 'green', [prop('green', 0)]);
      expect(() =>
        reduce(s, {
          type: 'PLAY_RENT',
          playerId: 'p1',
          cardId: rentAny(0),
          color: 'green',
        }),
      ).toThrow('viser un adversaire');
    });

    it('chaque adversaire paie séparément, et le Double loyer s’applique à tous', () => {
      const s = newTable(3);
      hand(s, 'p1', [rent('red', 'yellow', 0), act('DOUBLE_RENT', 0)]);
      group(s, 'p1', 'red', [prop('red', 0), prop('red', 1)]);
      bank(s, 'p2', [money(10, 0)]);
      bank(s, 'p3', [money(10, 0)]);
      const end = reduceAll(s, [
        {
          type: 'PLAY_RENT',
          playerId: 'p1',
          cardId: rent('red', 'yellow', 0),
          color: 'red',
          doubleCardIds: [act('DOUBLE_RENT', 0)],
        },
        { type: 'RESPOND_ACCEPT', playerId: 'p2' },
        { type: 'PAY', playerId: 'p2', cardIds: [money(10, 0)] },
        { type: 'RESPOND_ACCEPT', playerId: 'p3' },
        { type: 'PAY', playerId: 'p3', cardIds: [money(10, 0)] },
      ]);
      // 3 M de loyer doublés = 6 M dus par chacun ; personne ne rend la monnaie.
      expect(player(end, 'p1').bank).toHaveLength(2);
      expect(end.phase).toBe('PLAY');
    });
  });
});
