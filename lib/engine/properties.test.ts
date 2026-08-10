import { describe, expect, it } from 'vitest';

import { groupRent, isGroupComplete } from './cards.ts';
import { reduce, reduceAll } from './reduce.ts';
import { completeColors } from './selectors.ts';
import {
  act,
  group,
  groupOf,
  hand,
  newTable,
  player,
  prop,
  wild,
  wildAny,
} from './test-utils.ts';

describe('Pose de propriétés', () => {
  it('crée un lot à la première carte', () => {
    const s = newTable();
    hand(s, 'p1', [prop('green', 0)]);
    const out = reduce(s, {
      type: 'PLAY_PROPERTY',
      playerId: 'p1',
      cardId: prop('green', 0),
    });
    expect(player(out, 'p1').groups).toHaveLength(1);
    expect(player(out, 'p1').groups[0]?.color).toBe('green');
    expect(out.actionsPlayed).toBe(1);
  });

  it('complète un lot existant non plein', () => {
    const s = newTable();
    hand(s, 'p1', [prop('green', 1)]);
    const gid = group(s, 'p1', 'green', [prop('green', 0)]);
    const out = reduce(s, {
      type: 'PLAY_PROPERTY',
      playerId: 'p1',
      cardId: prop('green', 1),
    });
    expect(groupOf(out, 'p1', gid).cards).toHaveLength(2);
    expect(player(out, 'p1').groups).toHaveLength(1);
  });

  it('ouvre un second lot quand le premier est plein (cas 3)', () => {
    const s = newTable();
    // Marron : lot de 2. Deux cartes déjà posées, deux jokers marron en main.
    group(s, 'p1', 'brown', [prop('brown', 0), prop('brown', 1)]);
    hand(s, 'p1', [wild('lightblue', 'brown', 0), wildAny(0)]);
    const out = reduceAll(s, [
      {
        type: 'PLAY_PROPERTY',
        playerId: 'p1',
        cardId: wild('lightblue', 'brown', 0),
        color: 'brown',
      },
      {
        type: 'PLAY_PROPERTY',
        playerId: 'p1',
        cardId: wildAny(0),
        color: 'brown',
      },
    ]);
    const groups = player(out, 'p1').groups.filter((g) => g.color === 'brown');
    expect(groups).toHaveLength(2);
    expect(groups[0]?.cards).toHaveLength(2);
    expect(groups[1]?.cards).toHaveLength(2);
    // Les lots sont des entités distinctes, pas un compteur par couleur.
    expect(groups[0]?.id).not.toBe(groups[1]?.id);
  });

  it('compte un lot complet et un lot partiel séparément (cas 3)', () => {
    const s = newTable();
    group(s, 'p1', 'lightblue', [
      prop('lightblue', 0),
      prop('lightblue', 1),
      prop('lightblue', 2),
    ]);
    hand(s, 'p1', [wild('lightblue', 'brown', 0)]);
    const out = reduce(s, {
      type: 'PLAY_PROPERTY',
      playerId: 'p1',
      cardId: wild('lightblue', 'brown', 0),
      color: 'lightblue',
    });
    const groups = player(out, 'p1').groups;
    expect(groups).toHaveLength(2);
    expect(isGroupComplete(groups[0]!)).toBe(true);
    expect(isGroupComplete(groups[1]!)).toBe(false);
    // Une seule couleur complète malgré 4 cartes.
    expect(completeColors(player(out, 'p1'))).toEqual(['lightblue']);
  });

  it('refuse une carte non-propriété', () => {
    const s = newTable();
    hand(s, 'p1', [act('PASS_GO', 0)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_PROPERTY',
        playerId: 'p1',
        cardId: act('PASS_GO', 0),
      }),
    ).toThrow();
  });

  it('force un nouveau lot avec newGroup', () => {
    const s = newTable();
    group(s, 'p1', 'green', [prop('green', 0)]);
    hand(s, 'p1', [prop('green', 1)]);
    const out = reduce(s, {
      type: 'PLAY_PROPERTY',
      playerId: 'p1',
      cardId: prop('green', 1),
      color: 'green',
      newGroup: true,
    });
    expect(player(out, 'p1').groups).toHaveLength(2);
  });
});

describe('Jokers', () => {
  it('accepte un joker bicolore dans chacune de ses deux couleurs', () => {
    for (const color of ['lightblue', 'brown'] as const) {
      const s = newTable();
      hand(s, 'p1', [wild('lightblue', 'brown', 0)]);
      const out = reduce(s, {
        type: 'PLAY_PROPERTY',
        playerId: 'p1',
        cardId: wild('lightblue', 'brown', 0),
        color,
      });
      expect(player(out, 'p1').groups[0]?.color).toBe(color);
    }
  });

  it('refuse un joker bicolore dans une troisième couleur', () => {
    const s = newTable();
    hand(s, 'p1', [wild('lightblue', 'brown', 0)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_PROPERTY',
        playerId: 'p1',
        cardId: wild('lightblue', 'brown', 0),
        color: 'red',
      }),
    ).toThrow();
  });

  it('exige une couleur explicite pour un joker', () => {
    const s = newTable();
    hand(s, 'p1', [wildAny(0)]);
    expect(() =>
      reduce(s, { type: 'PLAY_PROPERTY', playerId: 'p1', cardId: wildAny(0) }),
    ).toThrow('Couleur à préciser');
  });

  it('accepte un joker universel dans n’importe quelle couleur', () => {
    const s = newTable();
    hand(s, 'p1', [wildAny(0)]);
    const out = reduce(s, {
      type: 'PLAY_PROPERTY',
      playerId: 'p1',
      cardId: wildAny(0),
      color: 'red',
    });
    expect(player(out, 'p1').groups[0]?.color).toBe('red');
  });

  it('ne considère pas complet un lot fait uniquement de jokers universels', () => {
    const s = newTable();
    const gid = group(s, 'p1', 'brown', [wildAny(0), wildAny(1)]);
    expect(isGroupComplete(groupOf(s, 'p1', gid))).toBe(false);
  });

  it('permute un joker sans consommer d’action', () => {
    const s = newTable();
    const brown = group(s, 'p1', 'brown', [
      prop('brown', 0),
      wild('lightblue', 'brown', 0),
    ]);
    group(s, 'p1', 'lightblue', [prop('lightblue', 0)]);
    const out = reduce(s, {
      type: 'MOVE_WILD',
      playerId: 'p1',
      cardId: wild('lightblue', 'brown', 0),
      color: 'lightblue',
    });
    expect(out.actionsPlayed).toBe(0);
    expect(groupOf(out, 'p1', brown).cards).toEqual([prop('brown', 0)]);
    expect(
      player(out, 'p1').groups.find((g) => g.color === 'lightblue')?.cards,
    ).toHaveLength(2);
  });

  it('interdit une permutation qui casse un lot complet portant une Maison (cas 4)', () => {
    const s = newTable();
    group(
      s,
      'p1',
      'brown',
      [prop('brown', 0), wild('lightblue', 'brown', 0)],
      { house: act('HOUSE', 0) },
    );
    group(s, 'p1', 'lightblue', [prop('lightblue', 0)]);
    expect(() =>
      reduce(s, {
        type: 'MOVE_WILD',
        playerId: 'p1',
        cardId: wild('lightblue', 'brown', 0),
        color: 'lightblue',
      }),
    ).toThrow('construction');
  });

  it('interdit aussi la permutation sous un Hôtel (cas 4)', () => {
    const s = newTable();
    group(
      s,
      'p1',
      'brown',
      [prop('brown', 0), wild('lightblue', 'brown', 0)],
      { house: act('HOUSE', 0), hotel: act('HOTEL', 0) },
    );
    expect(() =>
      reduce(s, {
        type: 'MOVE_WILD',
        playerId: 'p1',
        cardId: wild('lightblue', 'brown', 0),
        color: 'lightblue',
      }),
    ).toThrow('construction');
  });

  it('autorise la permutation depuis un lot complet sans construction', () => {
    const s = newTable();
    group(s, 'p1', 'brown', [prop('brown', 0), wild('lightblue', 'brown', 0)]);
    const out = reduce(s, {
      type: 'MOVE_WILD',
      playerId: 'p1',
      cardId: wild('lightblue', 'brown', 0),
      color: 'lightblue',
    });
    expect(completeColors(player(out, 'p1'))).toEqual([]);
  });

  it('refuse de permuter une carte qui n’est pas un joker', () => {
    const s = newTable();
    group(s, 'p1', 'brown', [prop('brown', 0)]);
    expect(() =>
      reduce(s, {
        type: 'MOVE_WILD',
        playerId: 'p1',
        cardId: prop('brown', 0),
        color: 'lightblue',
      }),
    ).toThrow();
  });
});

describe('Maison et Hôtel', () => {
  it('pose une Maison sur un lot complet et ajoute 3M au loyer', () => {
    const s = newTable();
    const gid = group(s, 'p1', 'brown', [prop('brown', 0), prop('brown', 1)]);
    hand(s, 'p1', [act('HOUSE', 0)]);
    expect(groupRent(groupOf(s, 'p1', gid))).toBe(2);
    const out = reduce(s, {
      type: 'PLAY_BUILDING',
      playerId: 'p1',
      cardId: act('HOUSE', 0),
      groupId: gid,
    });
    expect(groupOf(out, 'p1', gid).house).toBe(act('HOUSE', 0));
    expect(groupRent(groupOf(out, 'p1', gid))).toBe(5);
    expect(out.actionsPlayed).toBe(1);
  });

  it('refuse un Hôtel sans Maison (cas 12)', () => {
    const s = newTable();
    const gid = group(s, 'p1', 'brown', [prop('brown', 0), prop('brown', 1)]);
    hand(s, 'p1', [act('HOTEL', 0)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_BUILDING',
        playerId: 'p1',
        cardId: act('HOTEL', 0),
        groupId: gid,
      }),
    ).toThrow('Maison');
  });

  it('accepte un Hôtel sur un lot portant déjà une Maison', () => {
    const s = newTable();
    const gid = group(s, 'p1', 'brown', [prop('brown', 0), prop('brown', 1)], {
      house: act('HOUSE', 0),
    });
    hand(s, 'p1', [act('HOTEL', 0)]);
    const out = reduce(s, {
      type: 'PLAY_BUILDING',
      playerId: 'p1',
      cardId: act('HOTEL', 0),
      groupId: gid,
    });
    expect(groupRent(groupOf(out, 'p1', gid))).toBe(2 + 3 + 4);
  });

  it('refuse une Maison sur un lot Transports (cas 13)', () => {
    const s = newTable();
    const gid = group(s, 'p1', 'black', [
      prop('black', 0), prop('black', 1), prop('black', 2), prop('black', 3),
    ]);
    hand(s, 'p1', [act('HOUSE', 0)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_BUILDING',
        playerId: 'p1',
        cardId: act('HOUSE', 0),
        groupId: gid,
      }),
    ).toThrow('Transports');
  });

  it('refuse une Maison sur un lot Services (cas 13)', () => {
    const s = newTable();
    const gid = group(s, 'p1', 'turquoise', [
      prop('turquoise', 0),
      prop('turquoise', 1),
    ]);
    hand(s, 'p1', [act('HOUSE', 0)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_BUILDING',
        playerId: 'p1',
        cardId: act('HOUSE', 0),
        groupId: gid,
      }),
    ).toThrow('Services');
  });

  it('refuse une Maison sur un lot incomplet', () => {
    const s = newTable();
    const gid = group(s, 'p1', 'brown', [prop('brown', 0)]);
    hand(s, 'p1', [act('HOUSE', 0)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_BUILDING',
        playerId: 'p1',
        cardId: act('HOUSE', 0),
        groupId: gid,
      }),
    ).toThrow('complet');
  });

  it('refuse deux Maisons sur le même lot', () => {
    const s = newTable();
    const gid = group(s, 'p1', 'brown', [prop('brown', 0), prop('brown', 1)], {
      house: act('HOUSE', 0),
    });
    hand(s, 'p1', [act('HOUSE', 1)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_BUILDING',
        playerId: 'p1',
        cardId: act('HOUSE', 1),
        groupId: gid,
      }),
    ).toThrow('déjà posée');
  });
});

describe('Grille de loyer', () => {
  it('indexe le loyer sur le nombre de cartes du lot', () => {
    const s = newTable();
    const gid = group(s, 'p1', 'green', [prop('green', 0)]);
    expect(groupRent(groupOf(s, 'p1', gid))).toBe(2);
    groupOf(s, 'p1', gid).cards.push(prop('green', 1));
    expect(groupRent(groupOf(s, 'p1', gid))).toBe(4);
    groupOf(s, 'p1', gid).cards.push(prop('green', 2));
    expect(groupRent(groupOf(s, 'p1', gid))).toBe(7);
  });

  it("ne compte pas les constructions d'un lot devenu incomplet", () => {
    const s = newTable();
    const gid = group(s, 'p1', 'brown', [prop('brown', 0)], {
      house: act('HOUSE', 0),
    });
    expect(groupRent(groupOf(s, 'p1', gid))).toBe(1);
  });
});
