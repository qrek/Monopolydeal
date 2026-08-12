import { describe, expect, it } from 'vitest';

import { reduce, reduceAll, getAutoActions } from './reduce.ts';
import { HAND_LIMIT } from './selectors.ts';
import {
  act,
  hand,
  money,
  newLobby,
  newTable,
  player,
  prop,
  stackDeck,
  wildAny,
} from './test-utils.ts';

describe('Mise en place', () => {
  it('distribue 5 cartes à chaque joueur et passe en phase DRAW', () => {
    const s = reduce(newLobby(3), { type: 'START_GAME' });
    expect(s.phase).toBe('DRAW');
    for (const p of s.players) expect(p.hand).toHaveLength(5);
    expect(s.deck).toHaveLength(106 - 15);
    expect(s.discard).toHaveLength(0);
  });

  it('refuse une partie à 1 joueur', () => {
    expect(() => reduce(newLobby(1), { type: 'START_GAME' })).toThrow(
      '2 à 5 joueurs',
    );
  });

  it('refuse une partie à 6 joueurs', () => {
    expect(() => reduce(newLobby(6), { type: 'START_GAME' })).toThrow(
      '2 à 5 joueurs',
    );
  });

  it('donne des mains différentes selon le seed', () => {
    const a = reduce(newLobby(2), { type: 'START_GAME' });
    const b = { ...newLobby(2), seed: 'un-autre-seed' };
    const c = reduce(b, { type: 'START_GAME' });
    expect(a.players[0]?.hand).not.toEqual(c.players[0]?.hand);
  });

  it('tire au sort le joueur qui commence', () => {
    // Le seed décide, donc le tirage est rejouable ; mais il ne doit pas
    // toujours désigner l'hôte, sinon créer la partie serait un avantage.
    const seeds = Array.from({ length: 40 }, (_, i) => `depart-${i}`);
    const ouvreurs = new Set(
      seeds.map((seed) => {
        const s = reduce({ ...newLobby(3), seed }, { type: 'START_GAME' });
        return s.turnIndex;
      }),
    );
    expect(ouvreurs.size).toBeGreaterThan(1);

    // Rejouable : même seed, même joueur.
    const a = reduce({ ...newLobby(3), seed: 'depart-7' }, { type: 'START_GAME' });
    const b = reduce({ ...newLobby(3), seed: 'depart-7' }, { type: 'START_GAME' });
    expect(a.turnIndex).toBe(b.turnIndex);
    expect(a.events.find((e) => e.t === 'TURN_STARTED')).toEqual(
      b.events.find((e) => e.t === 'TURN_STARTED'),
    );
  });

  it('annonce le tour du joueur tiré au sort, pas celui du premier siège', () => {
    const s = reduce({ ...newLobby(4), seed: 'depart-3' }, { type: 'START_GAME' });
    const debut = s.events.find((e) => e.t === 'TURN_STARTED');
    expect(debut && 'playerId' in debut ? debut.playerId : null).toBe(
      s.players[s.turnIndex]?.id,
    );
  });

  it('journalise le démarrage', () => {
    const s = reduce(newLobby(2), { type: 'START_GAME' });
    expect(s.events[0]?.t).toBe('GAME_STARTED');
    expect(s.events.some((e) => e.t === 'TURN_STARTED')).toBe(true);
  });
});

describe('Pioche', () => {
  it('pioche 2 cartes puis passe en PLAY', () => {
    const s = newTable();
    s.phase = 'DRAW';
    hand(s, 'p1', [money(1, 0)]);
    const out = reduce(s, { type: 'DRAW', playerId: 'p1' });
    expect(player(out, 'p1').hand).toHaveLength(3);
    expect(out.phase).toBe('PLAY');
    expect(out.actionsPlayed).toBe(0);
  });

  it('pioche 5 cartes si la main est vide en début de tour (cas 10)', () => {
    const s = newTable();
    s.phase = 'DRAW';
    hand(s, 'p1', []);
    const out = reduce(s, { type: 'DRAW', playerId: 'p1' });
    expect(player(out, 'p1').hand).toHaveLength(5);
  });

  it("refuse la pioche d'un joueur dont ce n'est pas le tour", () => {
    const s = newTable();
    s.phase = 'DRAW';
    expect(() => reduce(s, { type: 'DRAW', playerId: 'p2' })).toThrow();
  });

  it('remélange la défausse quand la pioche est vide', () => {
    const s = newTable();
    s.phase = 'DRAW';
    hand(s, 'p1', [money(1, 0)]);
    s.deck = [];
    s.discard = [money(2, 0), money(3, 0), money(4, 0)];
    const out = reduce(s, { type: 'DRAW', playerId: 'p1' });
    expect(player(out, 'p1').hand).toHaveLength(3);
    expect(out.discard).toHaveLength(0);
    expect(out.deck).toHaveLength(1);
    expect(out.events.some((e) => e.t === 'DECK_RESHUFFLED')).toBe(true);
  });

  it('ne bloque pas quand pioche et défausse sont vides', () => {
    const s = newTable();
    s.phase = 'DRAW';
    hand(s, 'p1', [money(1, 0)]);
    s.deck = [];
    s.discard = [];
    const out = reduce(s, { type: 'DRAW', playerId: 'p1' });
    expect(player(out, 'p1').hand).toHaveLength(1);
    expect(out.phase).toBe('PLAY');
  });
});

describe('Compteur de 3 actions', () => {
  it('accepte exactement 3 cartes jouées', () => {
    const s = newTable();
    hand(s, 'p1', [money(1, 0), money(1, 1), money(1, 2), money(1, 3)]);
    const out = reduceAll(s, [
      { type: 'PLAY_MONEY', playerId: 'p1', cardId: money(1, 0) },
      { type: 'PLAY_MONEY', playerId: 'p1', cardId: money(1, 1) },
      { type: 'PLAY_MONEY', playerId: 'p1', cardId: money(1, 2) },
    ]);
    expect(out.actionsPlayed).toBe(3);
    expect(player(out, 'p1').bank).toHaveLength(3);
  });

  it('refuse une 4e carte', () => {
    const s = newTable();
    hand(s, 'p1', [money(1, 0), money(1, 1), money(1, 2), money(1, 3)]);
    const out = reduceAll(s, [
      { type: 'PLAY_MONEY', playerId: 'p1', cardId: money(1, 0) },
      { type: 'PLAY_MONEY', playerId: 'p1', cardId: money(1, 1) },
      { type: 'PLAY_MONEY', playerId: 'p1', cardId: money(1, 2) },
    ]);
    expect(() =>
      reduce(out, { type: 'PLAY_MONEY', playerId: 'p1', cardId: money(1, 3) }),
    ).toThrow();
  });

  it('autorise à passer sans rien jouer', () => {
    const s = newTable();
    hand(s, 'p1', [money(1, 0)]);
    const out = reduce(s, { type: 'END_TURN', playerId: 'p1' });
    expect(out.phase).toBe('END_TURN');
    expect(out.actionsPlayed).toBe(0);
  });

  it("refuse de jouer une carte qu'on n'a pas en main", () => {
    const s = newTable();
    hand(s, 'p1', []);
    expect(() =>
      reduce(s, { type: 'PLAY_MONEY', playerId: 'p1', cardId: money(5, 0) }),
    ).toThrow("n'est pas en main");
  });
});

describe('Banque', () => {
  it('pose une carte argent en banque', () => {
    const s = newTable();
    hand(s, 'p1', [money(5, 0)]);
    const out = reduce(s, {
      type: 'PLAY_MONEY',
      playerId: 'p1',
      cardId: money(5, 0),
    });
    expect(player(out, 'p1').bank).toEqual([money(5, 0)]);
    expect(player(out, 'p1').hand).toHaveLength(0);
  });

  it('accepte une carte Action posée comme argent', () => {
    const s = newTable();
    hand(s, 'p1', [act('DEAL_BREAKER', 0)]);
    const out = reduce(s, {
      type: 'PLAY_MONEY',
      playerId: 'p1',
      cardId: act('DEAL_BREAKER', 0),
    });
    expect(player(out, 'p1').bank).toEqual([act('DEAL_BREAKER', 0)]);
  });

  it('refuse un joker universel en banque', () => {
    const s = newTable();
    hand(s, 'p1', [wildAny(0)]);
    expect(() =>
      reduce(s, { type: 'PLAY_MONEY', playerId: 'p1', cardId: wildAny(0) }),
    ).toThrow('joker universel');
  });
});

describe('Passe départ', () => {
  it('pioche 2 cartes et consomme une action', () => {
    const s = newTable();
    hand(s, 'p1', [act('PASS_GO', 0)]);
    stackDeck(s, [money(1, 0), money(2, 0)]);
    const out = reduce(s, {
      type: 'PLAY_PASS_GO',
      playerId: 'p1',
      cardId: act('PASS_GO', 0),
    });
    expect(player(out, 'p1').hand).toEqual([money(1, 0), money(2, 0)]);
    expect(out.actionsPlayed).toBe(1);
    expect(out.discard).toContain(act('PASS_GO', 0));
  });
});

describe('Fin de tour et défausse', () => {
  it('exige une défausse au-delà de 7 cartes', () => {
    const s = newTable();
    hand(s, 'p1', [
      money(1, 0), money(1, 1), money(1, 2), money(1, 3),
      money(2, 0), money(2, 1), money(2, 2), money(2, 3), money(3, 0),
    ]);
    const out = reduce(s, { type: 'END_TURN', playerId: 'p1' });
    expect(out.phase).toBe('DISCARD');
  });

  it('défausse exactement le surplus puis passe en END_TURN', () => {
    const s = newTable();
    hand(s, 'p1', [
      money(1, 0), money(1, 1), money(1, 2), money(1, 3),
      money(2, 0), money(2, 1), money(2, 2), money(2, 3), money(3, 0),
    ]);
    const mid = reduce(s, { type: 'END_TURN', playerId: 'p1' });
    const out = reduce(mid, {
      type: 'DISCARD',
      playerId: 'p1',
      cardIds: [money(1, 0), money(1, 1)],
    });
    expect(player(out, 'p1').hand).toHaveLength(HAND_LIMIT);
    expect(out.discard).toHaveLength(2);
    expect(out.phase).toBe('END_TURN');
  });

  it('refuse une défausse incomplète', () => {
    const s = newTable();
    hand(s, 'p1', [
      money(1, 0), money(1, 1), money(1, 2), money(1, 3),
      money(2, 0), money(2, 1), money(2, 2), money(2, 3), money(3, 0),
    ]);
    const mid = reduce(s, { type: 'END_TURN', playerId: 'p1' });
    expect(() =>
      reduce(mid, { type: 'DISCARD', playerId: 'p1', cardIds: [money(1, 0)] }),
    ).toThrow();
  });

  it('ne demande pas de défausse à 7 cartes pile', () => {
    const s = newTable();
    hand(s, 'p1', [
      money(1, 0), money(1, 1), money(1, 2), money(1, 3),
      money(2, 0), money(2, 1), money(2, 2),
    ]);
    expect(reduce(s, { type: 'END_TURN', playerId: 'p1' }).phase).toBe('END_TURN');
  });

  it('passe la main au joueur suivant et remet le compteur à zéro', () => {
    const s = newTable(3);
    hand(s, 'p1', [money(1, 0)]);
    const ended = reduceAll(s, [
      { type: 'PLAY_MONEY', playerId: 'p1', cardId: money(1, 0) },
      { type: 'END_TURN', playerId: 'p1' },
    ]);
    expect(getAutoActions(ended)).toEqual([{ type: 'ADVANCE_TURN' }]);
    const out = reduce(ended, { type: 'ADVANCE_TURN' });
    expect(out.turnIndex).toBe(1);
    expect(out.phase).toBe('DRAW');
    expect(out.actionsPlayed).toBe(0);
  });

  it('boucle sur le premier joueur après le dernier', () => {
    const s = newTable(3);
    s.turnIndex = 2;
    hand(s, 'p3', []);
    const out = reduceAll(s, [
      { type: 'END_TURN', playerId: 'p3' },
      { type: 'ADVANCE_TURN' },
    ]);
    expect(out.turnIndex).toBe(0);
  });

  it("ne propose aucune action automatique hors de la phase END_TURN", () => {
    expect(getAutoActions(newTable())).toEqual([]);
  });
});

describe('Pureté du réducteur', () => {
  it('ne mute jamais son entrée', () => {
    const s = newTable();
    hand(s, 'p1', [prop('brown', 0)]);
    const before = JSON.stringify(s);
    reduce(s, {
      type: 'PLAY_PROPERTY',
      playerId: 'p1',
      cardId: prop('brown', 0),
    });
    expect(JSON.stringify(s)).toBe(before);
  });
});
