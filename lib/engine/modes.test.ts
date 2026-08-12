import { describe, expect, it } from 'vitest';

import { COLORS, getCard } from './cards.ts';
import { reduce } from './reduce.ts';
import { rulesFor, STARTING_HAND } from './selectors.ts';
import { newLobby, player } from './test-utils.ts';

describe('Modes de jeu', () => {
  it('la partie classique distribue 5 cartes à chacun', () => {
    const s = reduce(newLobby(3), { type: 'START_GAME' });
    for (const p of s.players) expect(p.hand).toHaveLength(STARTING_HAND);
  });

  it('le duel compense celui qui ne commence pas', () => {
    // Le premier joueur est tiré au sort : la compensation se lit donc par
    // rapport au tirage, jamais par rapport à l'ordre d'arrivée dans le salon.
    for (const seed of ['seed-de-test', 'un-autre-seed', 'troisieme']) {
      const s = reduce({ ...newLobby(2, 'DUEL'), seed }, { type: 'START_GAME' });
      const ouvreur = s.players[s.turnIndex];
      const autre = s.players[(s.turnIndex + 1) % 2];
      expect(ouvreur?.hand).toHaveLength(STARTING_HAND);
      expect(autre?.hand).toHaveLength(
        STARTING_HAND + rulesFor('DUEL').secondPlayerBonus,
      );
    }
  });

  it('le duel refuse trois joueurs', () => {
    expect(() => reduce(newLobby(3, 'DUEL'), { type: 'START_GAME' })).toThrow(
      'Ce mode se joue à 2 joueurs',
    );
  });

  it('le duel distribue métro et aéroports, le classique non', () => {
    const duel = reduce(newLobby(2, 'DUEL'), { type: 'START_GAME' });
    const cartes = [...duel.deck, ...duel.players.flatMap((p) => p.hand)].map(getCard);
    const etendues = cartes.filter(
      (c) => c.kind === 'PROPERTY' && (c.color === 'airport' || c.color === 'metro'),
    );
    expect(etendues).toHaveLength(COLORS.airport.size + COLORS.metro.size);

    const classique = reduce(newLobby(2), { type: 'START_GAME' });
    const rien = [...classique.deck, ...classique.players.flatMap((p) => p.hand)]
      .map(getCard)
      .filter((c) => c.kind === 'PROPERTY' && (c.color === 'airport' || c.color === 'metro'));
    expect(rien).toHaveLength(0);
  });

  it('le mode voyage avec l’état', () => {
    const s = reduce(newLobby(2, 'DUEL'), { type: 'START_GAME' });
    expect(s.mode).toBe('DUEL');
    expect(newLobby(2).mode).toBe('CLASSIC');
  });
});
