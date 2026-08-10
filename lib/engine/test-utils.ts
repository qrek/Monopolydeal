/**
 * Helpers de test : construction d'états de jeu déterministes.
 * Ce fichier n'est pas un fichier de test (pas de `.test.ts`) et n'est jamais
 * importé par l'application.
 */

import { freshDeckIds } from './cards.ts';
import { createGame } from './reduce.ts';
import type {
  ActionKind,
  CardId,
  Color,
  GameState,
  PlayerState,
  PropertyGroup,
} from './types.ts';

export const SEED = 'seed-de-test';

// --- raccourcis d'ids (le deck a des ids déterministes) ---------------------

export const money = (value: number, i = 0): CardId => `money-${value}-${i}`;
export const prop = (color: Color, i = 0): CardId => `prop-${color}-${i}`;
export const wild = (a: Color, b: Color, i = 0): CardId => `wild-${a}_${b}-${i}`;
export const wildAny = (i = 0): CardId => `wildany-${i}`;
export const act = (kind: ActionKind, i = 0): CardId =>
  `act-${kind.toLowerCase()}-${i}`;
export const rent = (a: Color, b: Color, i = 0): CardId =>
  `rent-${a}_${b}-${i}`;
export const rentAny = (i = 0): CardId => `rent-universal-${i}`;

// --- construction d'états ---------------------------------------------------

export function newLobby(playerCount = 2): GameState {
  return createGame({
    id: 'game-test',
    seed: SEED,
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Joueur ${i + 1}`,
    })),
  });
}

/** Table déjà lancée : phase PLAY, joueur 1 actif, mains et pioche vides. */
export function newTable(playerCount = 2): GameState {
  const s = newLobby(playerCount);
  s.phase = 'PLAY';
  s.deck = freshDeckIds();
  s.actionsPlayed = 0;
  return s;
}

function seat(s: GameState, playerId: string): PlayerState {
  const p = s.players.find((x) => x.id === playerId);
  if (!p) throw new Error(`Joueur inconnu dans le fixture : ${playerId}`);
  return p;
}

function pullFromDeck(s: GameState, ids: CardId[]): void {
  s.deck = s.deck.filter((id) => !ids.includes(id));
}

export function hand(s: GameState, playerId: string, ids: CardId[]): GameState {
  seat(s, playerId).hand = [...ids];
  pullFromDeck(s, ids);
  return s;
}

export function bank(s: GameState, playerId: string, ids: CardId[]): GameState {
  seat(s, playerId).bank = [...ids];
  pullFromDeck(s, ids);
  return s;
}

/** Ajoute un lot distinct au joueur et renvoie son id. */
export function group(
  s: GameState,
  playerId: string,
  color: Color,
  ids: CardId[],
  opts: { house?: CardId; hotel?: CardId } = {},
): string {
  const p = seat(s, playerId);
  const g: PropertyGroup = {
    id: `g${s.nextGroupId}`,
    color,
    cards: [...ids],
    house: opts.house ?? null,
    hotel: opts.hotel ?? null,
  };
  s.nextGroupId += 1;
  p.groups.push(g);
  pullFromDeck(s, ids);
  if (opts.house) pullFromDeck(s, [opts.house]);
  if (opts.hotel) pullFromDeck(s, [opts.hotel]);
  return g.id;
}

/** Empile des cartes précises au sommet de la pioche. */
export function stackDeck(s: GameState, ids: CardId[]): GameState {
  pullFromDeck(s, ids);
  s.deck = [...ids, ...s.deck];
  return s;
}

export function groupOf(s: GameState, playerId: string, id: string): PropertyGroup {
  const g = seat(s, playerId).groups.find((x) => x.id === id);
  if (!g) throw new Error(`Lot introuvable : ${id}`);
  return g;
}

export function player(s: GameState, playerId: string): PlayerState {
  return seat(s, playerId);
}

/** Trois lots complets de couleurs différentes, moins une carte : prêt à gagner. */
export function almostWinning(s: GameState, playerId: string): void {
  group(s, playerId, 'brown', [prop('brown', 0), prop('brown', 1)]);
  group(s, playerId, 'darkblue', [prop('darkblue', 0), prop('darkblue', 1)]);
  group(s, playerId, 'turquoise', [prop('turquoise', 0)]);
}
