/**
 * Les quatre cartes du tête-à-tête. Elles n'existent que dans ce mode, et
 * chacune touche à une mécanique différente : la réponse (Renvoi), le tempo
 * (Contravention), l'écart de score (Contrôle RATP) et la main (Filature).
 */

import { describe, expect, it } from 'vitest';

import { FINE_PENALTY, RATP_CHECK_AMOUNT } from './cards.ts';
import { reduce } from './reduce.ts';
import { MAX_ACTIONS_PER_TURN, actionsAllowed } from './selectors.ts';
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
import type { GameState } from './types.ts';

/** Table de duel prête à jouer, p1 au trait. */
function duel(): GameState {
  const s = newTable(2, 'DUEL');
  s.actionsAllowed = MAX_ACTIONS_PER_TURN;
  return s;
}

describe('Renvoi', () => {
  it('retourne la demande à son auteur, au même montant', () => {
    let s = duel();
    hand(s, 'p1', [act('DEBT_COLLECTOR')]);
    hand(s, 'p2', [act('REFLECT')]);
    bank(s, 'p1', [money(5, 0)]);
    bank(s, 'p2', [money(5, 1)]);

    s = reduce(s, {
      type: 'PLAY_DEBT_COLLECTOR',
      playerId: 'p1',
      cardId: act('DEBT_COLLECTOR'),
      targetPlayerId: 'p2',
    });
    s = reduce(s, {
      type: 'RESPOND_REFLECT',
      playerId: 'p2',
      cardId: act('REFLECT'),
    });

    expect(s.pending?.sourcePlayerId).toBe('p2');
    expect(s.pending?.targets[0]?.playerId).toBe('p1');
    expect(s.events.some((e) => e.t === 'REFLECTED')).toBe(true);

    // C'est bien p1 qui paie, maintenant.
    s = reduce(s, { type: 'RESPOND_ACCEPT', playerId: 'p1', againstPlayerId: 'p1' });
    expect(s.pending?.targets[0]?.debt).toBe(5);
  });

  it('se laisse annuler par un Refus de l’auteur', () => {
    let s = duel();
    hand(s, 'p1', [act('DEBT_COLLECTOR'), act('JUST_SAY_NO')]);
    hand(s, 'p2', [act('REFLECT')]);
    bank(s, 'p1', [money(5, 0)]);
    bank(s, 'p2', [money(5, 1)]);

    s = reduce(s, {
      type: 'PLAY_DEBT_COLLECTOR',
      playerId: 'p1',
      cardId: act('DEBT_COLLECTOR'),
      targetPlayerId: 'p2',
    });
    s = reduce(s, { type: 'RESPOND_REFLECT', playerId: 'p2', cardId: act('REFLECT') });
    s = reduce(s, {
      type: 'RESPOND_JUST_SAY_NO',
      playerId: 'p1',
      cardId: act('JUST_SAY_NO'),
    });
    s = reduce(s, { type: 'RESPOND_ACCEPT', playerId: 'p2', againstPlayerId: 'p1' });

    // Personne ne paie : le renvoi a été refusé.
    expect(s.phase).toBe('PLAY');
    expect(player(s, 'p1').bank).toHaveLength(1);
    expect(player(s, 'p2').bank).toHaveLength(1);
  });

  it('ne se joue qu’une fois par demande', () => {
    let s = duel();
    hand(s, 'p1', [act('DEBT_COLLECTOR'), act('REFLECT', 1)]);
    hand(s, 'p2', [act('REFLECT')]);
    bank(s, 'p1', [money(5, 0)]);
    bank(s, 'p2', [money(5, 1)]);

    s = reduce(s, {
      type: 'PLAY_DEBT_COLLECTOR',
      playerId: 'p1',
      cardId: act('DEBT_COLLECTOR'),
      targetPlayerId: 'p2',
    });
    s = reduce(s, { type: 'RESPOND_REFLECT', playerId: 'p2', cardId: act('REFLECT') });
    expect(() =>
      reduce(s, { type: 'RESPOND_REFLECT', playerId: 'p1', cardId: act('REFLECT', 1) }),
    ).toThrow('déjà été renvoyée');
  });

  it('ne renvoie pas un vol', () => {
    let s = duel();
    hand(s, 'p1', [act('SLY_DEAL')]);
    hand(s, 'p2', [act('REFLECT')]);
    group(s, 'p2', 'brown', [prop('brown', 0)]);

    s = reduce(s, {
      type: 'PLAY_SLY_DEAL',
      playerId: 'p1',
      cardId: act('SLY_DEAL'),
      targetPlayerId: 'p2',
      targetCardId: prop('brown', 0),
    });
    expect(() =>
      reduce(s, { type: 'RESPOND_REFLECT', playerId: 'p2', cardId: act('REFLECT') }),
    ).toThrow('demandes d’argent');
  });

  it('ne se joue pas depuis le camp de l’auteur', () => {
    // L'auteur d'une demande ne la renvoie pas à sa propre cible : le Renvoi
    // est une réponse, pas une relance.
    let s = duel();
    hand(s, 'p1', [act('DEBT_COLLECTOR'), act('REFLECT', 1)]);
    hand(s, 'p2', [act('JUST_SAY_NO')]);
    bank(s, 'p2', [money(5, 1)]);

    s = reduce(s, {
      type: 'PLAY_DEBT_COLLECTOR',
      playerId: 'p1',
      cardId: act('DEBT_COLLECTOR'),
      targetPlayerId: 'p2',
    });
    s = reduce(s, {
      type: 'RESPOND_JUST_SAY_NO',
      playerId: 'p2',
      cardId: act('JUST_SAY_NO'),
    });
    expect(() =>
      reduce(s, { type: 'RESPOND_REFLECT', playerId: 'p1', cardId: act('REFLECT', 1) }),
    ).toThrow('Seule la cible');
  });
});

describe('Contravention', () => {
  it('retire une action au prochain tour de la cible', () => {
    let s = duel();
    hand(s, 'p1', [act('FINE')]);
    hand(s, 'p2', [money(1, 0)]);

    s = reduce(s, {
      type: 'PLAY_FINE',
      playerId: 'p1',
      cardId: act('FINE'),
      targetPlayerId: 'p2',
    });
    s = reduce(s, { type: 'RESPOND_ACCEPT', playerId: 'p2', againstPlayerId: 'p2' });
    expect(player(s, 'p2').penalty).toBe(FINE_PENALTY);
    expect(s.events.some((e) => e.t === 'FINED')).toBe(true);

    // Mon tour à moi n'est pas touché.
    expect(actionsAllowed(s)).toBe(MAX_ACTIONS_PER_TURN);

    s = reduce(s, { type: 'END_TURN', playerId: 'p1' });
    s = reduce(s, { type: 'ADVANCE_TURN' });
    expect(actionsAllowed(s)).toBe(MAX_ACTIONS_PER_TURN - FINE_PENALTY);
    // Et elle ne se purge qu'une fois.
    expect(player(s, 'p2').penalty).toBe(0);
  });

  it('laisse toujours au moins une action', () => {
    let s = duel();
    hand(s, 'p1', [act('FINE'), act('FINE', 1)]);
    for (const carte of [act('FINE'), act('FINE', 1)]) {
      s = reduce(s, {
        type: 'PLAY_FINE',
        playerId: 'p1',
        cardId: carte,
        targetPlayerId: 'p2',
      });
      s = reduce(s, { type: 'RESPOND_ACCEPT', playerId: 'p2', againstPlayerId: 'p2' });
    }
    expect(player(s, 'p2').penalty).toBe(2 * FINE_PENALTY);
    s = reduce(s, { type: 'END_TURN', playerId: 'p1' });
    s = reduce(s, { type: 'ADVANCE_TURN' });
    expect(actionsAllowed(s)).toBe(1);
  });
});

describe('Contrôle RATP', () => {
  it('réclame au meneur', () => {
    let s = duel();
    hand(s, 'p1', [act('RATP_CHECK')]);
    // p2 mène : un lot complet contre rien.
    group(s, 'p2', 'brown', [prop('brown', 0), prop('brown', 1)]);
    bank(s, 'p2', [money(5, 0)]);

    s = reduce(s, {
      type: 'PLAY_RATP_CHECK',
      playerId: 'p1',
      cardId: act('RATP_CHECK'),
      targetPlayerId: 'p2',
    });
    s = reduce(s, { type: 'RESPOND_ACCEPT', playerId: 'p2', againstPlayerId: 'p2' });
    expect(s.pending?.targets[0]?.debt).toBe(RATP_CHECK_AMOUNT);
  });

  it('se refuse à celui qui mène', () => {
    const s = duel();
    hand(s, 'p1', [act('RATP_CHECK')]);
    group(s, 'p1', 'brown', [prop('brown', 0), prop('brown', 1)]);
    expect(() =>
      reduce(s, {
        type: 'PLAY_RATP_CHECK',
        playerId: 'p1',
        cardId: act('RATP_CHECK'),
        targetPlayerId: 'p2',
      }),
    ).toThrow('celui qui mène');
  });

  it('départage à la banque quand les lots sont à égalité', () => {
    const s = duel();
    hand(s, 'p1', [act('RATP_CHECK')]);
    bank(s, 'p1', [money(5, 0)]);
    bank(s, 'p2', [money(1, 0)]);
    // p1 a la plus grosse banque : c'est lui qui mène, donc pas de contrôle.
    expect(() =>
      reduce(s, {
        type: 'PLAY_RATP_CHECK',
        playerId: 'p1',
        cardId: act('RATP_CHECK'),
        targetPlayerId: 'p2',
      }),
    ).toThrow('celui qui mène');
  });
});

describe('Filature', () => {
  it('fait défausser la carte la plus chère de la main visée', () => {
    let s = duel();
    hand(s, 'p1', [act('TAIL')]);
    hand(s, 'p2', [money(1, 0), act('DEAL_BREAKER'), money(2, 0)]);

    s = reduce(s, {
      type: 'PLAY_TAIL',
      playerId: 'p1',
      cardId: act('TAIL'),
      targetPlayerId: 'p2',
    });
    s = reduce(s, { type: 'RESPOND_ACCEPT', playerId: 'p2', againstPlayerId: 'p2' });

    const main = player(s, 'p2').hand;
    expect(main).not.toContain(act('DEAL_BREAKER'));
    expect(main).toHaveLength(2);
    expect(s.discard).toContain(act('DEAL_BREAKER'));
  });

  it('ne prive de rien celui qui n’a rien : le coup est refusé', () => {
    const s = duel();
    hand(s, 'p1', [act('TAIL')]);
    hand(s, 'p2', []);
    expect(() =>
      reduce(s, {
        type: 'PLAY_TAIL',
        playerId: 'p1',
        cardId: act('TAIL'),
        targetPlayerId: 'p2',
      }),
    ).toThrow('main est vide');
  });

  it('se laisse refuser comme toute action visant quelqu’un', () => {
    let s = duel();
    hand(s, 'p1', [act('TAIL')]);
    hand(s, 'p2', [act('JUST_SAY_NO'), money(5, 0)]);

    s = reduce(s, {
      type: 'PLAY_TAIL',
      playerId: 'p1',
      cardId: act('TAIL'),
      targetPlayerId: 'p2',
    });
    s = reduce(s, {
      type: 'RESPOND_JUST_SAY_NO',
      playerId: 'p2',
      cardId: act('JUST_SAY_NO'),
    });
    s = reduce(s, { type: 'RESPOND_ACCEPT', playerId: 'p1', againstPlayerId: 'p2' });
    expect(player(s, 'p2').hand).toContain(money(5, 0));
  });
});
