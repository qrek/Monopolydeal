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

/**
 * Qui a le droit d'émettre quoi.
 *
 * Un client n'envoie que des intentions de JEU : le lancement, l'enchaînement
 * des tours et la présence appartiennent au serveur, qui les déclenche lui-même.
 *
 * C'est un `Record` exhaustif et non une liste, et ce n'est pas un détail de
 * style : une liste se maintient à la main, et quatre intentions ajoutées au
 * moteur y ont été oubliées — les cartes existaient, se jouaient en test, et le
 * serveur les refusait toutes les quatre en production. Ici, ajouter une
 * intention sans trancher ne compile pas.
 */
export const CLIENT_ACTIONS: Record<GameActionType, boolean> = {
  START_GAME: false,
  ADVANCE_TURN: false,
  // Passe par son propre message, pas par le canal des intentions.
  SET_CONNECTED: false,

  DRAW: true,
  PLAY_MONEY: true,
  PLAY_PROPERTY: true,
  MOVE_WILD: true,
  PLAY_BUILDING: true,
  PLAY_PASS_GO: true,
  PLAY_DEAL_BREAKER: true,
  PLAY_SLY_DEAL: true,
  PLAY_FORCED_DEAL: true,
  PLAY_DEBT_COLLECTOR: true,
  PLAY_BIRTHDAY: true,
  PLAY_RENT: true,
  PLAY_FINE: true,
  PLAY_RATP_CHECK: true,
  PLAY_TAIL: true,
  RESPOND_JUST_SAY_NO: true,
  RESPOND_REFLECT: true,
  RESPOND_ACCEPT: true,
  PAY: true,
  DISCARD: true,
  END_TURN: true,
};

/** Durée de la fenêtre de Refus catégorique, côté UI. Timeout = acceptation. */
export const JUST_SAY_NO_WINDOW_MS = 8000;
