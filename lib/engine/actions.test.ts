import { describe, expect, it } from 'vitest';

import { isCancelledByChain, reduce, reduceAll } from './reduce.ts';
import {
  act,
  bank,
  group,
  hand,
  money,
  newTable,
  player,
  prop,
  wildAny,
} from './test-utils.ts';

describe('Coup de filet', () => {
  it('vole un lot complet, constructions comprises', () => {
    const s = newTable();
    hand(s, 'p1', [act('DEAL_BREAKER', 0)]);
    const gid = group(s, 'p2', 'brown', [prop('brown', 0), prop('brown', 1)], {
      house: act('HOUSE', 0),
    });
    const out = reduceAll(s, [
      {
        type: 'PLAY_DEAL_BREAKER',
        playerId: 'p1',
        cardId: act('DEAL_BREAKER', 0),
        targetPlayerId: 'p2',
        targetGroupId: gid,
      },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
    ]);
    expect(player(out, 'p2').groups).toHaveLength(0);
    const stolen = player(out, 'p1').groups[0];
    expect(stolen?.cards).toEqual([prop('brown', 0), prop('brown', 1)]);
    expect(stolen?.house).toBe(act('HOUSE', 0));
    expect(out.phase).toBe('PLAY');
  });

  it('vole un lot complet contenant un joker universel (cas 1)', () => {
    const s = newTable();
    hand(s, 'p1', [act('DEAL_BREAKER', 0)]);
    const gid = group(s, 'p2', 'darkblue', [prop('darkblue', 0), wildAny(0)]);
    const out = reduceAll(s, [
      {
        type: 'PLAY_DEAL_BREAKER',
        playerId: 'p1',
        cardId: act('DEAL_BREAKER', 0),
        targetPlayerId: 'p2',
        targetGroupId: gid,
      },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
    ]);
    expect(player(out, 'p1').groups[0]?.cards).toContain(wildAny(0));
    expect(player(out, 'p2').groups).toHaveLength(0);
  });

  it('refuse un lot incomplet', () => {
    const s = newTable();
    hand(s, 'p1', [act('DEAL_BREAKER', 0)]);
    const gid = group(s, 'p2', 'brown', [prop('brown', 0)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_DEAL_BREAKER',
        playerId: 'p1',
        cardId: act('DEAL_BREAKER', 0),
        targetPlayerId: 'p2',
        targetGroupId: gid,
      }),
    ).toThrow('complets');
  });

  it('refuse de se viser soi-même', () => {
    const s = newTable();
    hand(s, 'p1', [act('DEAL_BREAKER', 0)]);
    const gid = group(s, 'p1', 'brown', [prop('brown', 0), prop('brown', 1)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_DEAL_BREAKER',
        playerId: 'p1',
        cardId: act('DEAL_BREAKER', 0),
        targetPlayerId: 'p1',
        targetGroupId: gid,
      }),
    ).toThrow('adversaire');
  });
});

describe('Affaire douteuse', () => {
  it('vole une carte d’un lot incomplet', () => {
    const s = newTable();
    hand(s, 'p1', [act('SLY_DEAL', 0)]);
    group(s, 'p2', 'green', [prop('green', 0), prop('green', 1)]);
    const out = reduceAll(s, [
      {
        type: 'PLAY_SLY_DEAL',
        playerId: 'p1',
        cardId: act('SLY_DEAL', 0),
        targetPlayerId: 'p2',
        targetCardId: prop('green', 0),
      },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
    ]);
    expect(player(out, 'p1').groups[0]?.cards).toEqual([prop('green', 0)]);
    expect(player(out, 'p2').groups[0]?.cards).toEqual([prop('green', 1)]);
  });

  it('refuse une carte appartenant à un lot complet (cas 2)', () => {
    const s = newTable();
    hand(s, 'p1', [act('SLY_DEAL', 0)]);
    group(s, 'p2', 'brown', [prop('brown', 0), prop('brown', 1)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_SLY_DEAL',
        playerId: 'p1',
        cardId: act('SLY_DEAL', 0),
        targetPlayerId: 'p2',
        targetCardId: prop('brown', 0),
      }),
    ).toThrow('lot complet');
  });

  it('refuse une carte qui n’est pas posée', () => {
    const s = newTable();
    hand(s, 'p1', [act('SLY_DEAL', 0)]);
    hand(s, 'p2', [prop('green', 0)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_SLY_DEAL',
        playerId: 'p1',
        cardId: act('SLY_DEAL', 0),
        targetPlayerId: 'p2',
        targetCardId: prop('green', 0),
      }),
    ).toThrow();
  });
});

describe('Échange forcé', () => {
  it('échange deux propriétés hors lots complets', () => {
    const s = newTable();
    hand(s, 'p1', [act('FORCED_DEAL', 0)]);
    group(s, 'p1', 'red', [prop('red', 0)]);
    group(s, 'p2', 'green', [prop('green', 0)]);
    const out = reduceAll(s, [
      {
        type: 'PLAY_FORCED_DEAL',
        playerId: 'p1',
        cardId: act('FORCED_DEAL', 0),
        targetPlayerId: 'p2',
        targetCardId: prop('green', 0),
        ownCardId: prop('red', 0),
      },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
    ]);
    expect(player(out, 'p1').groups.map((g) => g.cards)).toEqual([
      [prop('green', 0)],
    ]);
    expect(player(out, 'p2').groups.map((g) => g.cards)).toEqual([
      [prop('red', 0)],
    ]);
  });

  it('refuse si la carte visée est dans un lot complet (cas 2)', () => {
    const s = newTable();
    hand(s, 'p1', [act('FORCED_DEAL', 0)]);
    group(s, 'p1', 'red', [prop('red', 0)]);
    group(s, 'p2', 'brown', [prop('brown', 0), prop('brown', 1)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_FORCED_DEAL',
        playerId: 'p1',
        cardId: act('FORCED_DEAL', 0),
        targetPlayerId: 'p2',
        targetCardId: prop('brown', 0),
        ownCardId: prop('red', 0),
      }),
    ).toThrow('lot complet');
  });

  it('refuse si ma propre carte est dans un lot complet (cas 2)', () => {
    const s = newTable();
    hand(s, 'p1', [act('FORCED_DEAL', 0)]);
    group(s, 'p1', 'brown', [prop('brown', 0), prop('brown', 1)]);
    group(s, 'p2', 'green', [prop('green', 0)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_FORCED_DEAL',
        playerId: 'p1',
        cardId: act('FORCED_DEAL', 0),
        targetPlayerId: 'p2',
        targetCardId: prop('green', 0),
        ownCardId: prop('brown', 0),
      }),
    ).toThrow('lot complet');
  });
});

describe('Refus catégorique', () => {
  it('annule l’action visée', () => {
    const s = newTable();
    hand(s, 'p1', [act('SLY_DEAL', 0)]);
    hand(s, 'p2', [act('JUST_SAY_NO', 0)]);
    group(s, 'p2', 'green', [prop('green', 0)]);
    const out = reduceAll(s, [
      {
        type: 'PLAY_SLY_DEAL',
        playerId: 'p1',
        cardId: act('SLY_DEAL', 0),
        targetPlayerId: 'p2',
        targetCardId: prop('green', 0),
      },
      { type: 'RESPOND_JUST_SAY_NO', playerId: 'p2', cardId: act('JUST_SAY_NO', 0) },
      { type: 'RESPOND_ACCEPT', playerId: 'p1' },
    ]);
    expect(player(out, 'p2').groups[0]?.cards).toEqual([prop('green', 0)]);
    expect(player(out, 'p1').groups).toHaveLength(0);
    expect(out.phase).toBe('PLAY');
    expect(out.events.some((e) => e.t === 'ACTION_CANCELLED')).toBe(true);
  });

  it('ne consomme aucune des 3 actions', () => {
    const s = newTable();
    hand(s, 'p1', [act('SLY_DEAL', 0)]);
    hand(s, 'p2', [act('JUST_SAY_NO', 0)]);
    group(s, 'p2', 'green', [prop('green', 0)]);
    const out = reduceAll(s, [
      {
        type: 'PLAY_SLY_DEAL',
        playerId: 'p1',
        cardId: act('SLY_DEAL', 0),
        targetPlayerId: 'p2',
        targetCardId: prop('green', 0),
      },
      { type: 'RESPOND_JUST_SAY_NO', playerId: 'p2', cardId: act('JUST_SAY_NO', 0) },
    ]);
    expect(out.actionsPlayed).toBe(1);
  });

  it('peut être contré par un second Refus : l’action passe', () => {
    const s = newTable();
    hand(s, 'p1', [act('SLY_DEAL', 0), act('JUST_SAY_NO', 1)]);
    hand(s, 'p2', [act('JUST_SAY_NO', 0)]);
    group(s, 'p2', 'green', [prop('green', 0)]);
    const out = reduceAll(s, [
      {
        type: 'PLAY_SLY_DEAL',
        playerId: 'p1',
        cardId: act('SLY_DEAL', 0),
        targetPlayerId: 'p2',
        targetCardId: prop('green', 0),
      },
      { type: 'RESPOND_JUST_SAY_NO', playerId: 'p2', cardId: act('JUST_SAY_NO', 0) },
      { type: 'RESPOND_JUST_SAY_NO', playerId: 'p1', cardId: act('JUST_SAY_NO', 1) },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
    ]);
    expect(player(out, 'p1').groups[0]?.cards).toEqual([prop('green', 0)]);
  });

  it('chaîne de 3 Refus : parité impaire, l’action est annulée (cas 14)', () => {
    // La spec dit « l'action passe » ; c'est incompatible avec la règle de chaîne
    // (« la cible du Refus est le joueur qui vient de jouer »). On applique la
    // parité : 1 Refus annule, 2 rétablissent, 3 annulent.
    const s = newTable();
    hand(s, 'p1', [act('SLY_DEAL', 0), act('JUST_SAY_NO', 1)]);
    hand(s, 'p2', [act('JUST_SAY_NO', 0), act('JUST_SAY_NO', 2)]);
    group(s, 'p2', 'green', [prop('green', 0)]);
    const out = reduceAll(s, [
      {
        type: 'PLAY_SLY_DEAL',
        playerId: 'p1',
        cardId: act('SLY_DEAL', 0),
        targetPlayerId: 'p2',
        targetCardId: prop('green', 0),
      },
      { type: 'RESPOND_JUST_SAY_NO', playerId: 'p2', cardId: act('JUST_SAY_NO', 0) },
      { type: 'RESPOND_JUST_SAY_NO', playerId: 'p1', cardId: act('JUST_SAY_NO', 1) },
      { type: 'RESPOND_JUST_SAY_NO', playerId: 'p2', cardId: act('JUST_SAY_NO', 2) },
      { type: 'RESPOND_ACCEPT', playerId: 'p1' },
    ]);
    expect(player(out, 'p2').groups[0]?.cards).toEqual([prop('green', 0)]);
    expect(out.discard).toHaveLength(4);
  });

  it('expose la règle de parité', () => {
    expect(isCancelledByChain(0)).toBe(false);
    expect(isCancelledByChain(1)).toBe(true);
    expect(isCancelledByChain(2)).toBe(false);
    expect(isCancelledByChain(3)).toBe(true);
  });

  it('refuse un Refus joué par quelqu’un qui n’est pas visé', () => {
    const s = newTable(3);
    hand(s, 'p1', [act('SLY_DEAL', 0)]);
    hand(s, 'p3', [act('JUST_SAY_NO', 0)]);
    group(s, 'p2', 'green', [prop('green', 0)]);
    const mid = reduce(s, {
      type: 'PLAY_SLY_DEAL',
      playerId: 'p1',
      cardId: act('SLY_DEAL', 0),
      targetPlayerId: 'p2',
      targetCardId: prop('green', 0),
    });
    expect(() =>
      reduce(mid, {
        type: 'RESPOND_JUST_SAY_NO',
        playerId: 'p3',
        cardId: act('JUST_SAY_NO', 0),
      }),
    ).toThrow();
  });
});

describe('Anniversaire', () => {
  it('crée une dette de 2M par adversaire, résolue séparément (cas 7)', () => {
    const s = newTable(3);
    hand(s, 'p1', [act('BIRTHDAY', 0)]);
    bank(s, 'p2', [money(2, 0)]);
    bank(s, 'p3', [money(2, 1)]);
    const mid = reduce(s, {
      type: 'PLAY_BIRTHDAY',
      playerId: 'p1',
      cardId: act('BIRTHDAY', 0),
    });
    expect(mid.pending?.targets).toHaveLength(2);
    const out = reduceAll(mid, [
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
      { type: 'RESPOND_ACCEPT', playerId: 'p3' },
      { type: 'PAY', playerId: 'p2', cardIds: [money(2, 0)] },
      { type: 'PAY', playerId: 'p3', cardIds: [money(2, 1)] },
    ]);
    expect(player(out, 'p1').bank).toEqual([money(2, 0), money(2, 1)]);
    expect(out.phase).toBe('PLAY');
  });

  it('laisse un adversaire refuser sans protéger les autres (cas 7)', () => {
    const s = newTable(3);
    hand(s, 'p1', [act('BIRTHDAY', 0)]);
    hand(s, 'p2', [act('JUST_SAY_NO', 0)]);
    bank(s, 'p2', [money(2, 0)]);
    bank(s, 'p3', [money(2, 1)]);
    const out = reduceAll(s, [
      { type: 'PLAY_BIRTHDAY', playerId: 'p1', cardId: act('BIRTHDAY', 0) },
      { type: 'RESPOND_JUST_SAY_NO', playerId: 'p2', cardId: act('JUST_SAY_NO', 0) },
      { type: 'RESPOND_ACCEPT', playerId: 'p1', againstPlayerId: 'p2' },
      { type: 'RESPOND_ACCEPT', playerId: 'p3' },
      { type: 'PAY', playerId: 'p3', cardIds: [money(2, 1)] },
    ]);
    expect(player(out, 'p2').bank).toEqual([money(2, 0)]);
    expect(player(out, 'p1').bank).toEqual([money(2, 1)]);
    expect(out.phase).toBe('PLAY');
  });
});

describe('Recouvrement', () => {
  it('réclame 5M à un seul adversaire', () => {
    const s = newTable(3);
    hand(s, 'p1', [act('DEBT_COLLECTOR', 0)]);
    bank(s, 'p2', [money(5, 0)]);
    bank(s, 'p3', [money(5, 1)]);
    const mid = reduceAll(s, [
      {
        type: 'PLAY_DEBT_COLLECTOR',
        playerId: 'p1',
        cardId: act('DEBT_COLLECTOR', 0),
        targetPlayerId: 'p2',
      },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
    ]);
    expect(mid.phase).toBe('AWAITING_PAYMENT');
    expect(mid.pending?.targets[0]?.debt).toBe(5);
    const out = reduce(mid, {
      type: 'PAY',
      playerId: 'p2',
      cardIds: [money(5, 0)],
    });
    expect(player(out, 'p1').bank).toEqual([money(5, 0)]);
    expect(player(out, 'p3').bank).toEqual([money(5, 1)]);
  });
});

describe('Événements', () => {
  it('journalise chaque étape de la résolution', () => {
    const s = newTable();
    hand(s, 'p1', [act('SLY_DEAL', 0)]);
    group(s, 'p2', 'green', [prop('green', 0)]);
    const out = reduceAll(s, [
      {
        type: 'PLAY_SLY_DEAL',
        playerId: 'p1',
        cardId: act('SLY_DEAL', 0),
        targetPlayerId: 'p2',
        targetCardId: prop('green', 0),
      },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
    ]);
    const kinds = out.events.map((e) => e.t);
    expect(kinds).toContain('ACTION_PLAYED');
    expect(kinds).toContain('CARDS_STOLEN');
    expect(out.events.map((e) => e.seq)).toEqual(
      out.events.map((_, i) => i),
    );
  });
});
