/**
 * Lectures dérivées de l'état. Aucune mutation ici — le client comme le serveur
 * s'en servent pour afficher et pour valider.
 */

import {
  COLORS,
  getCard,
  groupRent,
  isGroupComplete,
  possibleColors,
} from './cards.ts';
import type {
  CardId,
  Color,
  GameMode,
  GameState,
  PlayerState,
  PropertyGroup,
} from './types.ts';

export const MAX_ACTIONS_PER_TURN = 3;
export const HAND_LIMIT = 7;
export const TURN_DRAW = 2;
export const EMPTY_HAND_DRAW = 5;
export const STARTING_HAND = 5;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;
/** Nombre de lots complets de couleurs distinctes requis pour gagner. */
export const SETS_TO_WIN = 3;

/**
 * Ce qui change d'un mode à l'autre. Tout le reste — trois cartes par tour,
 * sept en main, trois lots pour gagner — est commun, et c'est voulu : un mode
 * qui change tout n'est plus le même jeu.
 */
export interface RuleProfile {
  minPlayers: number;
  maxPlayers: number;
  /**
   * Cartes supplémentaires données au second joueur.
   *
   * À deux, l'ordre du tour vaut environ quatre points de victoire, et c'est
   * un défaut purement positionnel : le deck élargi du duel donne exactement
   * le même écart que le deck classique. Deux cartes le referment.
   *
   * Mesuré sur 6 000 parties simulées par valeur (banc `sim/`), avec le vrai
   * deck du mode : +1 laisse 52,5 % au premier joueur, +2 donne 49,5 % et +3
   * 49,4 %, à ±1,3 point près. Deux et trois sont indiscernables ; on prend
   * la plus sobre. Attention au piège : à 1 500 parties, la même mesure
   * donnait 46,7 % et laissait croire à une sur-correction.
   */
  secondPlayerBonus: number;
  label: string;
  tagline: string;
}

export const RULES: Record<GameMode, RuleProfile> = {
  CLASSIC: {
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    secondPlayerBonus: 0,
    label: 'Partie classique',
    tagline: '2 à 5 joueurs · les dix familles du plateau',
  },
  DUEL: {
    minPlayers: 2,
    maxPlayers: 2,
    secondPlayerBonus: 2,
    label: 'Tête-à-tête',
    tagline: '2 joueurs · métro et aéroports · second joueur compensé',
  },
};

export function rulesFor(mode: GameMode): RuleProfile {
  return RULES[mode];
}

export function getPlayer(state: GameState, playerId: string): PlayerState {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) throw new Error(`Joueur inconnu : ${playerId}`);
  return p;
}

export function findPlayer(
  state: GameState,
  playerId: string,
): PlayerState | undefined {
  return state.players.find((x) => x.id === playerId);
}

export function currentPlayer(state: GameState): PlayerState {
  const p = state.players[state.turnIndex];
  if (!p) throw new Error('Aucun joueur courant');
  return p;
}

export function findGroup(
  player: PlayerState,
  groupId: string,
): PropertyGroup | undefined {
  return player.groups.find((g) => g.id === groupId);
}

/** Lot contenant cette carte, chez ce joueur. */
export function groupOfCard(
  player: PlayerState,
  cardId: CardId,
): PropertyGroup | undefined {
  return player.groups.find((g) => g.cards.includes(cardId));
}

export function completeGroups(player: PlayerState): PropertyGroup[] {
  return player.groups.filter(isGroupComplete);
}

/** Couleurs distinctes pour lesquelles le joueur possède au moins un lot complet. */
export function completeColors(player: PlayerState): Color[] {
  const seen = new Set<Color>();
  for (const g of completeGroups(player)) seen.add(g.color);
  return [...seen];
}

export function hasWon(player: PlayerState): boolean {
  return completeColors(player).length >= SETS_TO_WIN;
}

/** Premier joueur remplissant la condition de victoire, ou null. */
export function findWinner(state: GameState): string | null {
  for (const p of state.players) {
    if (hasWon(p)) return p.id;
  }
  return null;
}

/** Total en banque, en M. */
export function bankTotal(player: PlayerState): number {
  return player.bank.reduce((sum, id) => sum + getCard(id).value, 0);
}

/**
 * Toutes les cartes qu'un joueur peut donner en paiement : banque, propriétés
 * et constructions. Jamais la main.
 */
export function payableCards(player: PlayerState): CardId[] {
  const out: CardId[] = [...player.bank];
  for (const g of player.groups) {
    out.push(...g.cards);
    if (g.house) out.push(g.house);
    if (g.hotel) out.push(g.hotel);
  }
  return out;
}

export function payableTotal(player: PlayerState): number {
  return payableCards(player).reduce((sum, id) => sum + getCard(id).value, 0);
}

/** Le joueur n'a strictement rien à donner : la dette s'éteint. */
export function isBroke(player: PlayerState): boolean {
  return payableCards(player).length === 0;
}

export function actionsRemaining(state: GameState): number {
  return Math.max(0, MAX_ACTIONS_PER_TURN - state.actionsPlayed);
}

/** Meilleur loyer réclamable par ce joueur pour une couleur donnée. */
export function bestRentForColor(player: PlayerState, color: Color): number {
  let best = 0;
  for (const g of player.groups) {
    if (g.color !== color) continue;
    best = Math.max(best, groupRent(g));
  }
  return best;
}

export function ownsColor(player: PlayerState, color: Color): boolean {
  return player.groups.some((g) => g.color === color && g.cards.length > 0);
}

/** Le lot peut-il encore accueillir une carte ? */
export function groupHasRoom(group: PropertyGroup): boolean {
  return group.cards.length < COLORS[group.color].size;
}

/** Une carte propriété peut-elle rejoindre ce lot ? */
export function canJoinGroup(cardId: CardId, group: PropertyGroup): boolean {
  return (
    groupHasRoom(group) && possibleColors(cardId).includes(group.color)
  );
}

export function opponentsOf(state: GameState, playerId: string): PlayerState[] {
  return state.players.filter((p) => p.id !== playerId);
}

/**
 * Vue redacted destinée à un joueur : les mains adverses deviennent des
 * compteurs. La source de vérité reste le serveur.
 */
export interface RedactedPlayer extends Omit<PlayerState, 'hand'> {
  hand: CardId[];
  handCount: number;
}

export interface RedactedState extends Omit<GameState, 'players' | 'deck'> {
  players: RedactedPlayer[];
  deckCount: number;
}

export function redactFor(state: GameState, viewerId: string): RedactedState {
  const { deck, players, ...rest } = state;
  return {
    ...rest,
    deckCount: deck.length,
    players: players.map((p) => ({
      ...p,
      hand: p.id === viewerId ? [...p.hand] : [],
      handCount: p.hand.length,
    })),
  };
}
