import { describe, expect, it } from 'vitest';

import { ALLOWED_ACTIONS, CLIENT_ACTIONS, isLegalTransition } from './machine.ts';
import { createGame, reduce, reduceAll, replay } from './reduce.ts';
import {
  completeColors,
  completeGroups,
  hasWon,
  redactFor,
} from './selectors.ts';
import {
  SEED,
  act,
  almostWinning,
  bank,
  group,
  hand,
  money,
  newLobby,
  newTable,
  player,
  prop,
  wild,
  wildAny,
} from './test-utils.ts';
import type { GameAction, GameActionType, GameState } from './types.ts';

describe('Condition de victoire', () => {
  it('déclare vainqueur à 3 lots complets de 3 couleurs différentes', () => {
    const s = newTable();
    almostWinning(s, 'p1');
    hand(s, 'p1', [prop('turquoise', 1)]);
    const out = reduce(s, {
      type: 'PLAY_PROPERTY',
      playerId: 'p1',
      cardId: prop('turquoise', 1),
    });
    expect(out.winnerId).toBe('p1');
    expect(out.phase).toBe('GAME_OVER');
    expect(out.events.at(-1)?.t).toBe('GAME_OVER');
  });

  it('ne déclare pas vainqueur avec 3 lots complets sur 2 couleurs seulement', () => {
    const s = newTable();
    group(s, 'p1', 'brown', [prop('brown', 0), prop('brown', 1)]);
    group(s, 'p1', 'brown', [wild('lightblue', 'brown', 0), wildAny(0)]);
    group(s, 'p1', 'darkblue', [prop('darkblue', 0), prop('darkblue', 1)]);
    expect(completeGroups(player(s, 'p1'))).toHaveLength(3);
    expect(completeColors(player(s, 'p1')).sort()).toEqual(['brown', 'darkblue']);
    expect(hasWon(player(s, 'p1'))).toBe(false);
  });

  it('gagne en récupérant un lot au Coup de filet', () => {
    const s = newTable();
    group(s, 'p1', 'brown', [prop('brown', 0), prop('brown', 1)]);
    group(s, 'p1', 'darkblue', [prop('darkblue', 0), prop('darkblue', 1)]);
    hand(s, 'p1', [act('DEAL_BREAKER', 0)]);
    const gid = group(s, 'p2', 'turquoise', [
      prop('turquoise', 0),
      prop('turquoise', 1),
    ]);
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
    expect(out.winnerId).toBe('p1');
  });

  it('gagne en recevant une propriété en paiement, sans attendre la fin du tour (cas 9)', () => {
    const s = newTable();
    group(s, 'p1', 'brown', [prop('brown', 0), prop('brown', 1)]);
    group(s, 'p1', 'darkblue', [prop('darkblue', 0), prop('darkblue', 1)]);
    group(s, 'p1', 'turquoise', [prop('turquoise', 0)]);
    hand(s, 'p1', [act('DEBT_COLLECTOR', 0)]);
    group(s, 'p2', 'turquoise', [prop('turquoise', 1)]);
    bank(s, 'p2', [money(10, 0)]);
    const out = reduceAll(s, [
      {
        type: 'PLAY_DEBT_COLLECTOR',
        playerId: 'p1',
        cardId: act('DEBT_COLLECTOR', 0),
        targetPlayerId: 'p2',
      },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
      {
        type: 'PAY',
        playerId: 'p2',
        cardIds: [money(10, 0), prop('turquoise', 1)],
      },
    ]);
    expect(out.winnerId).toBe('p1');
    expect(out.phase).toBe('GAME_OVER');
  });

  it('peut faire gagner un adversaire pendant mon tour, via Échange forcé (cas 9)', () => {
    const s = newTable();
    hand(s, 'p1', [act('FORCED_DEAL', 0)]);
    group(s, 'p1', 'turquoise', [prop('turquoise', 1)]);
    group(s, 'p2', 'brown', [prop('brown', 0), prop('brown', 1)]);
    group(s, 'p2', 'darkblue', [prop('darkblue', 0), prop('darkblue', 1)]);
    group(s, 'p2', 'turquoise', [prop('turquoise', 0)]);
    group(s, 'p2', 'green', [prop('green', 0)]);
    const out = reduceAll(s, [
      {
        type: 'PLAY_FORCED_DEAL',
        playerId: 'p1',
        cardId: act('FORCED_DEAL', 0),
        targetPlayerId: 'p2',
        targetCardId: prop('green', 0),
        ownCardId: prop('turquoise', 1),
      },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
    ]);
    expect(out.winnerId).toBe('p2');
    expect(out.turnIndex).toBe(0);
  });

  it('gèle la partie une fois terminée', () => {
    const s = newTable();
    almostWinning(s, 'p1');
    hand(s, 'p1', [prop('turquoise', 1), money(1, 0)]);
    const out = reduce(s, {
      type: 'PLAY_PROPERTY',
      playerId: 'p1',
      cardId: prop('turquoise', 1),
    });
    expect(() =>
      reduce(out, { type: 'PLAY_MONEY', playerId: 'p1', cardId: money(1, 0) }),
    ).toThrow('terminée');
  });

  it('laisse passer les changements de connexion après la fin', () => {
    const s = newTable();
    almostWinning(s, 'p1');
    hand(s, 'p1', [prop('turquoise', 1)]);
    const out = reduce(s, {
      type: 'PLAY_PROPERTY',
      playerId: 'p1',
      cardId: prop('turquoise', 1),
    });
    const after = reduce(out, {
      type: 'SET_CONNECTED',
      playerId: 'p2',
      connected: false,
    });
    expect(player(after, 'p2').connected).toBe(false);
  });
});

describe('Replay et reconnexion', () => {
  const init = {
    id: 'game-test',
    seed: SEED,
    players: [
      { id: 'p1', name: 'Joueur 1' },
      { id: 'p2', name: 'Joueur 2' },
    ],
  };

  function script(s: GameState): GameAction[] {
    const bankable = player(s, 'p1').hand.find(
      (id) => !id.startsWith('wildany'),
    ) as string;
    return [
      { type: 'PLAY_MONEY', playerId: 'p1', cardId: bankable },
      { type: 'END_TURN', playerId: 'p1' },
      { type: 'ADVANCE_TURN' },
      { type: 'DRAW', playerId: 'p2' },
    ];
  }

  it('reconstruit exactement le même état depuis le log (cas 11)', () => {
    const started = reduce(createGame(init), { type: 'START_GAME' });
    const actions: GameAction[] = [
      { type: 'START_GAME' },
      { type: 'DRAW', playerId: 'p1' },
      ...script(reduce(started, { type: 'DRAW', playerId: 'p1' })),
    ];
    const live = reduceAll(createGame(init), actions);
    const restored = replay(init, actions);
    expect(restored).toEqual(live);
  });

  it('restaure une partie après déconnexion et reconnexion (cas 11)', () => {
    const actions: GameAction[] = [
      { type: 'START_GAME' },
      { type: 'DRAW', playerId: 'p1' },
      { type: 'SET_CONNECTED', playerId: 'p2', connected: false },
      { type: 'SET_CONNECTED', playerId: 'p2', connected: true },
    ];
    const restored = replay(init, actions);
    expect(player(restored, 'p2').connected).toBe(true);
    expect(player(restored, 'p1').hand).toHaveLength(7);
    expect(restored.phase).toBe('PLAY');
  });

  it('numérote les événements de façon strictement croissante', () => {
    const s = replay(init, [
      { type: 'START_GAME' },
      { type: 'DRAW', playerId: 'p1' },
    ]);
    expect(s.events.map((e) => e.seq)).toEqual(s.events.map((_, i) => i));
  });

  it('cache la main des adversaires dans la vue redacted', () => {
    const s = reduce(newLobby(3), { type: 'START_GAME' });
    const view = redactFor(s, 'p1');
    expect(view.players[0]?.hand).toHaveLength(5);
    expect(view.players[1]?.hand).toHaveLength(0);
    expect(view.players[1]?.handCount).toBe(5);
    expect(view.deckCount).toBe(106 - 15);
  });
});

describe('Machine à états', () => {
  it('ne produit que des transitions déclarées', () => {
    const s = newTable();
    hand(s, 'p1', [act('DEBT_COLLECTOR', 0)]);
    bank(s, 'p2', [money(5, 0)]);
    const actions: GameAction[] = [
      {
        type: 'PLAY_DEBT_COLLECTOR',
        playerId: 'p1',
        cardId: act('DEBT_COLLECTOR', 0),
        targetPlayerId: 'p2',
      },
      { type: 'RESPOND_ACCEPT', playerId: 'p2' },
      { type: 'PAY', playerId: 'p2', cardIds: [money(5, 0)] },
      { type: 'END_TURN', playerId: 'p1' },
      { type: 'ADVANCE_TURN' },
    ];
    let cur = s;
    for (const a of actions) {
      const next = reduce(cur, a);
      expect(isLegalTransition(cur.phase, next.phase)).toBe(true);
      cur = next;
    }
    expect(cur.phase).toBe('DRAW');
  });

  it('déclare les intentions acceptables dans chaque phase', () => {
    expect(ALLOWED_ACTIONS.LOBBY).toContain('START_GAME');
    expect(ALLOWED_ACTIONS.PLAY).toContain('PLAY_RENT');
    expect(ALLOWED_ACTIONS.RESOLVING_ACTION).toContain('RESPOND_JUST_SAY_NO');
    expect(ALLOWED_ACTIONS.DISCARD).toContain('DISCARD');
    expect(ALLOWED_ACTIONS.GAME_OVER).not.toContain('PLAY_MONEY');
  });

  it('ouvre au client tout ce qu’un joueur peut jouer', () => {
    // Le bug qui a motivé ce test : quatre intentions ajoutées au moteur, la
    // machine les acceptait, l'interface les proposait, et la liste blanche du
    // serveur — tenue à la main — les refusait toutes les quatre. Toute
    // intention qu'une phase de JEU accepte doit être émettable par un client,
    // à l'exception des trois que le serveur déclenche lui-même.
    const SERVEUR: GameActionType[] = ['START_GAME', 'ADVANCE_TURN', 'SET_CONNECTED'];
    const jouables = new Set<GameActionType>();
    for (const phase of ['DRAW', 'PLAY', 'RESOLVING_ACTION', 'AWAITING_PAYMENT', 'DISCARD'] as const) {
      for (const a of ALLOWED_ACTIONS[phase]) jouables.add(a);
    }
    for (const a of jouables) {
      if (SERVEUR.includes(a)) continue;
      expect(CLIENT_ACTIONS[a], a).toBe(true);
    }
    for (const a of SERVEUR) expect(CLIENT_ACTIONS[a], a).toBe(false);
  });
});
