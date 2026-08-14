/**
 * Machine à états explicite des phases.
 *
 *   LOBBY → DRAW → PLAY → RESOLVING_ACTION → AWAITING_PAYMENT
 *                    ↘                            ↙
 *                     DISCARD → END_TURN → DRAW (joueur suivant)
 *                                    ↘ GAME_OVER (à tout moment)
 *
 * Cette table sert de documentation exécutable : un test vérifie que toute
 * transition produite par le réducteur y figure.
 */

import type { GameActionType, Phase } from './types.ts';

export const PHASES: Phase[] = [
  'LOBBY',
  'DRAW',
  'PLAY',
  'RESOLVING_ACTION',
  'AWAITING_PAYMENT',
  'DISCARD',
  'END_TURN',
  'GAME_OVER',
];

/** Transitions autorisées. GAME_OVER est atteignable depuis toute phase de jeu. */
export const TRANSITIONS: Record<Phase, Phase[]> = {
  LOBBY: ['DRAW'],
  DRAW: ['PLAY', 'DISCARD', 'END_TURN'],
  PLAY: ['RESOLVING_ACTION', 'AWAITING_PAYMENT', 'DISCARD', 'END_TURN', 'GAME_OVER'],
  RESOLVING_ACTION: ['RESOLVING_ACTION', 'AWAITING_PAYMENT', 'PLAY', 'GAME_OVER'],
  AWAITING_PAYMENT: ['AWAITING_PAYMENT', 'RESOLVING_ACTION', 'PLAY', 'GAME_OVER'],
  DISCARD: ['END_TURN'],
  END_TURN: ['DRAW'],
  GAME_OVER: [],
};

export function isLegalTransition(from: Phase, to: Phase): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/** Intentions acceptées dans chaque phase (avant validation métier fine). */
export const ALLOWED_ACTIONS: Record<Phase, GameActionType[]> = {
  LOBBY: ['START_GAME', 'SET_CONNECTED'],
  DRAW: ['DRAW', 'END_TURN', 'SET_CONNECTED'],
  PLAY: [
    'PLAY_MONEY',
    'PLAY_PROPERTY',
    'MOVE_WILD',
    'PLAY_BUILDING',
    'PLAY_PASS_GO',
    'PLAY_DEAL_BREAKER',
    'PLAY_SLY_DEAL',
    'PLAY_FORCED_DEAL',
    'PLAY_DEBT_COLLECTOR',
    'PLAY_BIRTHDAY',
    'PLAY_RENT',
    'PLAY_FINE',
    'PLAY_RATP_CHECK',
    'PLAY_TAIL',
    'END_TURN',
    'SET_CONNECTED',
  ],
  RESOLVING_ACTION: [
    'RESPOND_JUST_SAY_NO',
    'RESPOND_REFLECT',
    'RESPOND_ACCEPT',
    'PAY',
    'SET_CONNECTED',
  ],
  AWAITING_PAYMENT: ['RESPOND_JUST_SAY_NO', 'RESPOND_ACCEPT', 'PAY', 'SET_CONNECTED'],
  DISCARD: ['DISCARD', 'SET_CONNECTED'],
  END_TURN: ['ADVANCE_TURN', 'SET_CONNECTED'],
  GAME_OVER: ['SET_CONNECTED'],
};

/** Durée de la fenêtre de Refus catégorique, côté UI. Timeout = acceptation. */
export const JUST_SAY_NO_WINDOW_MS = 8000;
