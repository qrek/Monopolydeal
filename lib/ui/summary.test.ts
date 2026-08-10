/**
 * Le résumé s'affiche à un moment où plus personne ne peut corriger une erreur :
 * un classement faux ou un total qui ne tombe pas juste resterait le dernier
 * souvenir de la partie. D'où ces tests sur le calcul, pas sur l'affichage.
 */

import { describe, expect, it } from 'vitest';

import { createGame, reduce, redactFor, type GameState, type RedactedPlayer } from '@/lib/engine';
import { summarize } from '@/lib/ui/summary';

/** Table de deux joueurs, démarrée puis vidée de tout hasard. */
function table(): GameState {
  const s = createGame({
    id: 'g',
    seed: 'graine',
    players: [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ],
  });
  return reduce(s, { type: 'START_GAME' });
}

function playersOf(s: GameState): RedactedPlayer[] {
  return redactFor(s, 'a').players;
}

describe('Résumé de fin de partie', () => {
  it('classe le vainqueur en tête, même avec moins de fortune', () => {
    const s = table();
    const [a, b] = s.players;
    if (!a || !b) throw new Error('table incomplète');
    // Alice gagne avec trois lots, Bob croule sous l'argent.
    a.groups = [
      { id: 'g1', color: 'brown', cards: ['prop-brown-0', 'prop-brown-1'], house: null, hotel: null },
      { id: 'g2', color: 'darkblue', cards: ['prop-darkblue-0', 'prop-darkblue-1'], house: null, hotel: null },
      {
        id: 'g3',
        color: 'lightblue',
        cards: ['prop-lightblue-0', 'prop-lightblue-1', 'prop-lightblue-2'],
        house: null,
        hotel: null,
      },
    ];
    b.bank = ['money-10-0', 'money-5-0', 'money-5-1'];

    const out = summarize(playersOf(s), [], 'a');
    expect(out.players.map((p) => p.name)).toEqual(['Alice', 'Bob']);
    expect(out.players[0]?.sets).toBe(3);
    expect(out.players[0]?.winner).toBe(true);
    expect(out.players[1]?.bank).toBe(20);
  });

  it('départage à lots égaux sur la fortune posée', () => {
    const s = table();
    const [a, b] = s.players;
    if (!a || !b) throw new Error('table incomplète');
    a.bank = ['money-1-0'];
    b.bank = ['money-5-0'];

    const out = summarize(playersOf(s), [], null);
    expect(out.players.map((p) => p.name)).toEqual(['Bob', 'Alice']);
  });

  it('compte la fortune posée : banque plus valeur des propriétés', () => {
    const s = table();
    const a = s.players[0];
    if (!a) throw new Error('table incomplète');
    a.bank = ['money-2-0']; // 2 M
    a.groups = [
      // Bleu nuit vaut 4 M la carte.
      { id: 'g1', color: 'darkblue', cards: ['prop-darkblue-0'], house: null, hotel: null },
    ];

    const out = summarize(playersOf(s), [], null);
    const alice = out.players.find((p) => p.name === 'Alice');
    expect(alice?.bank).toBe(2);
    expect(alice?.properties).toBe(1);
    expect(alice?.worth).toBe(6);
  });

  it('tire les faits marquants du journal complet', () => {
    const s = table();
    const out = summarize(playersOf(s), [
      { seq: 1, t: 'TURN_ENDED', playerId: 'a' },
      { seq: 2, t: 'TURN_ENDED', playerId: 'b' },
      { seq: 3, t: 'PAID', fromId: 'b', toId: 'a', cardIds: ['money-5-0'], amount: 5 },
      { seq: 4, t: 'PAID', fromId: 'b', toId: 'a', cardIds: ['money-2-0'], amount: 2 },
      { seq: 5, t: 'CARDS_STOLEN', fromId: 'a', toId: 'b', cardIds: ['prop-red-0', 'prop-red-1'] },
      { seq: 6, t: 'DECK_RESHUFFLED', count: 40 },
    ], 'a');

    expect(out.turns).toBe(2);
    const trouve = (label: string) => out.highlights.find((h) => h.label === label);
    expect(trouve('Tours joués')?.value).toBe('2');
    expect(trouve('A le plus encaissé')).toMatchObject({ value: '7 M', who: 'Alice' });
    expect(trouve('A le plus versé')).toMatchObject({ value: '7 M', who: 'Bob' });
    expect(trouve('A le plus volé')).toMatchObject({ value: '2 cartes', who: 'Bob' });
    expect(trouve('Plus gros paiement')).toMatchObject({ value: '5 M', who: 'Bob → Alice' });
    expect(trouve('Pioche remélangée')?.value).toBe('1 fois');
  });

  it('ne fabrique aucun fait marquant sur un journal vide', () => {
    const s = table();
    const out = summarize(playersOf(s), [], null);
    // Seul le nombre de tours, qui vaut zéro et reste vrai.
    expect(out.highlights).toEqual([{ label: 'Tours joués', value: '0' }]);
  });
});
