/**
 * Lotissime — types du moteur de jeu.
 *
 * Ce fichier est du TypeScript pur : aucune dépendance à React, Supabase, ou
 * quoi que ce soit d'autre. Le moteur est un réducteur déterministe
 * `reduce(state, action) => state`.
 */

// ---------------------------------------------------------------------------
// Couleurs & cartes
// ---------------------------------------------------------------------------

export type Color =
  | 'brown' // Marron
  | 'lightblue' // Bleu ciel
  | 'pink' // Rose
  | 'orange' // Orange
  | 'red' // Rouge
  | 'yellow' // Jaune
  | 'green' // Vert
  | 'darkblue' // Bleu nuit
  | 'black' // Noir — transports
  | 'turquoise' // Turquoise — services
  // Deux familles réservées aux modes qui les incluent : elles existent dans
  // le catalogue, mais un deck classique n'en distribue aucune carte.
  | 'airport' // Ardoise — aéroports
  | 'metro'; // Violet — métro

/**
 * Le mode fixe la composition du deck et le profil de règles. Il est choisi à
 * la création de la partie et vit dans l'état serveur : un réglage client
 * laisserait deux joueurs jouer à des règles différentes.
 */
export type GameMode = 'CLASSIC' | 'DUEL';

export type CardId = string;

export type CardKind =
  | 'MONEY' // carte Argent
  | 'PROPERTY' // carte Propriété classique
  | 'WILD' // Joker bicolore
  | 'WILD_ANY' // Joker universel
  | 'ACTION' // carte Action
  | 'RENT'; // carte Loyer

export type ActionKind =
  | 'DEAL_BREAKER' // Coup de filet
  | 'SLY_DEAL' // Affaire douteuse
  | 'FORCED_DEAL' // Échange forcé
  | 'DEBT_COLLECTOR' // Recouvrement
  | 'BIRTHDAY' // Anniversaire
  | 'PASS_GO' // Passe départ
  | 'HOUSE' // Maison
  | 'HOTEL' // Hôtel
  | 'JUST_SAY_NO' // Refus catégorique
  | 'DOUBLE_RENT' // Double loyer
  // Réservées aux modes étendus : le tête-à-tête a besoin de coups qui se
  // rendent, sans quoi une attaque ne se subit que d'une seule façon.
  | 'REFLECT' // Renvoi
  | 'FINE' // Contravention
  | 'RATP_CHECK' // Contrôle RATP
  | 'TAIL'; // Filature

interface CardBase {
  id: CardId;
  /** Valeur banque en M. */
  value: number;
  label: string;
}

export interface MoneyCard extends CardBase {
  kind: 'MONEY';
}

export interface PropertyCard extends CardBase {
  kind: 'PROPERTY';
  color: Color;
}

/** Joker bicolore : appartient à l'une des deux couleurs imprimées. */
export interface WildCard extends CardBase {
  kind: 'WILD';
  colors: [Color, Color];
}

/** Joker universel : n'importe quelle couleur, 0M, jamais jouable en argent. */
export interface WildAnyCard extends CardBase {
  kind: 'WILD_ANY';
}

export interface ActionCard extends CardBase {
  kind: 'ACTION';
  action: ActionKind;
}

/** Carte Loyer : `colors` vaut les 2 couleurs imprimées, ou les 10 pour le loyer universel. */
export interface RentCard extends CardBase {
  kind: 'RENT';
  colors: Color[];
  universal: boolean;
}

export type Card =
  | MoneyCard
  | PropertyCard
  | WildCard
  | WildAnyCard
  | ActionCard
  | RentCard;

// ---------------------------------------------------------------------------
// État
// ---------------------------------------------------------------------------

/**
 * Un lot est un groupe *distinct* de cartes d'une même couleur.
 * Un joueur peut posséder plusieurs lots de la même couleur (cf. cas limite 3) :
 * on ne modélise donc jamais les propriétés comme un compteur par couleur.
 */
export interface PropertyGroup {
  id: string;
  color: Color;
  cards: CardId[];
  /** id de la carte Maison posée, ou null. */
  house: CardId | null;
  /** id de la carte Hôtel posée, ou null. */
  hotel: CardId | null;
}

export interface PlayerState {
  id: string;
  name: string;
  connected: boolean;
  hand: CardId[];
  bank: CardId[];
  groups: PropertyGroup[];
  /**
   * Contraventions à purger : autant d'actions en moins au prochain tour de ce
   * joueur, puis remise à zéro. Absent sur les parties commencées avant.
   */
  penalty?: number;
}

export type Phase =
  | 'LOBBY'
  | 'DRAW'
  | 'PLAY'
  | 'RESOLVING_ACTION'
  | 'AWAITING_PAYMENT'
  | 'DISCARD'
  | 'END_TURN'
  | 'GAME_OVER';

export type PendingKind =
  | 'DEAL_BREAKER'
  | 'SLY_DEAL'
  | 'FORCED_DEAL'
  | 'DEBT_COLLECTOR'
  | 'BIRTHDAY'
  | 'RENT'
  | 'FINE'
  | 'RATP_CHECK'
  | 'TAIL';

export type TargetStatus =
  | 'AWAITING_RESPONSE'
  | 'CANCELLED'
  | 'AWAITING_PAYMENT'
  | 'DONE';

/**
 * Un adversaire visé par une action. Chaque cible a sa propre chaîne de Refus
 * et sa propre dette : sur Anniversaire, chacun répond et paie indépendamment.
 */
export interface PendingTarget {
  playerId: string;
  status: TargetStatus;
  /**
   * Cartes Refus catégorique jouées, dans l'ordre. Longueur impaire ⇒ action
   * annulée. Plafonnée à MAX_JSN_CHAIN (2) : Refus puis contre-Refus, terminé.
   */
  jsnChain: CardId[];
  /** Joueur à qui c'est le tour de répondre (jouer un Refus ou accepter). */
  responderId: string;
  /** Montant dû, une fois l'action résolue (0 pour les actions de vol). */
  debt: number;
  /** Montant déjà versé. */
  paid: number;
}

export interface PendingAction {
  kind: PendingKind;
  sourcePlayerId: string;
  targets: PendingTarget[];
  /** Coup de filet : lot visé. */
  groupId?: string;
  /** Affaire douteuse / Échange forcé : carte visée chez l'adversaire. */
  targetCardId?: CardId;
  /** Échange forcé : ma carte donnée en échange. */
  ownCardId?: CardId;
  /** Loyer : couleur réclamée. */
  color?: Color;
  /** Loyer : montant unitaire calculé au moment où la carte est jouée. */
  amount?: number;
  /**
   * Renvoi déjà joué sur cette demande. Un seul aller-retour : sans ce
   * drapeau, deux joueurs bien pourvus se renverraient la même dette jusqu'à
   * épuisement des cartes, ce qui n'amuse personne.
   */
  reflected?: boolean;
}

export interface GameState {
  id: string;
  /** Règles et composition du deck. Figé à la création. */
  mode: GameMode;
  phase: Phase;
  players: PlayerState[];
  /** Index dans `players` du joueur dont c'est le tour. */
  turnIndex: number;
  /** Nombre d'actions consommées dans le tour courant. */
  actionsPlayed: number;
  /**
   * Actions permises dans le tour courant. Vaut MAX_ACTIONS_PER_TURN sauf
   * contravention en cours. Absent sur les parties commencées avant : les
   * lecteurs retombent alors sur le maximum.
   */
  actionsAllowed?: number;
  /** Pioche, face cachée. Le sommet est l'index 0. */
  deck: CardId[];
  discard: CardId[];
  seed: string;
  /** Nombre de mélanges déjà effectués — rend les remélanges déterministes. */
  shuffleCount: number;
  pending: PendingAction | null;
  winnerId: string | null;
  /** Journal append-only, alimente l'UI et le debug. */
  events: GameEvent[];
  /** Compteur monotone servant à générer les ids de lots. */
  nextGroupId: number;
}

// ---------------------------------------------------------------------------
// Intentions (actions envoyées par le client)
// ---------------------------------------------------------------------------

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'DRAW'; playerId: string }
  | { type: 'PLAY_MONEY'; playerId: string; cardId: CardId }
  | {
      type: 'PLAY_PROPERTY';
      playerId: string;
      cardId: CardId;
      /** Lot cible existant. Sinon `color` + éventuellement `newGroup`. */
      groupId?: string;
      color?: Color;
      newGroup?: boolean;
    }
  | {
      /** Permutation d'un joker déjà posé — gratuite, ne consomme pas d'action. */
      type: 'MOVE_WILD';
      playerId: string;
      cardId: CardId;
      groupId?: string;
      color?: Color;
      newGroup?: boolean;
    }
  | { type: 'PLAY_BUILDING'; playerId: string; cardId: CardId; groupId: string }
  | { type: 'PLAY_PASS_GO'; playerId: string; cardId: CardId }
  | {
      type: 'PLAY_DEAL_BREAKER';
      playerId: string;
      cardId: CardId;
      targetPlayerId: string;
      targetGroupId: string;
    }
  | {
      type: 'PLAY_SLY_DEAL';
      playerId: string;
      cardId: CardId;
      targetPlayerId: string;
      targetCardId: CardId;
    }
  | {
      type: 'PLAY_FORCED_DEAL';
      playerId: string;
      cardId: CardId;
      targetPlayerId: string;
      targetCardId: CardId;
      ownCardId: CardId;
    }
  | {
      type: 'PLAY_DEBT_COLLECTOR';
      playerId: string;
      cardId: CardId;
      targetPlayerId: string;
    }
  | { type: 'PLAY_BIRTHDAY'; playerId: string; cardId: CardId }
  | {
      /** Contravention : une action de moins au prochain tour de la cible. */
      type: 'PLAY_FINE';
      playerId: string;
      cardId: CardId;
      targetPlayerId: string;
    }
  | {
      /** Contrôle RATP : celui qui mène paie. Illégal si c'est moi qui mène. */
      type: 'PLAY_RATP_CHECK';
      playerId: string;
      cardId: CardId;
      targetPlayerId: string;
    }
  | {
      /** Filature : la cible défausse sa carte la plus chère. */
      type: 'PLAY_TAIL';
      playerId: string;
      cardId: CardId;
      targetPlayerId: string;
    }
  | {
      type: 'PLAY_RENT';
      playerId: string;
      cardId: CardId;
      color: Color;
      /**
       * Une quittance bicolore frappe TOUS les adversaires : la cible n'a pas
       * à être désignée, et l'indiquer ne change rien. Seule la quittance
       * universelle vise un joueur, et l'exige.
       */
      targetPlayerId?: string;
      /** Cartes Double loyer jouées avec le loyer. Chacune coûte une action de plus. */
      doubleCardIds?: CardId[];
    }
  | {
      type: 'RESPOND_JUST_SAY_NO';
      playerId: string;
      cardId: CardId;
      /** Désambiguïse quand plusieurs cibles attendent ma réponse (Anniversaire). */
      againstPlayerId?: string;
    }
  | {
      /**
       * Renvoi : la demande d'argent repart chez son auteur, même montant.
       * Se joue à la place d'un Refus, et une seule fois par demande.
       */
      type: 'RESPOND_REFLECT';
      playerId: string;
      cardId: CardId;
      againstPlayerId?: string;
    }
  | { type: 'RESPOND_ACCEPT'; playerId: string; againstPlayerId?: string }
  | { type: 'PAY'; playerId: string; cardIds: CardId[] }
  | { type: 'DISCARD'; playerId: string; cardIds: CardId[] }
  | { type: 'END_TURN'; playerId: string }
  | { type: 'ADVANCE_TURN' }
  | { type: 'SET_CONNECTED'; playerId: string; connected: boolean };

export type GameActionType = GameAction['type'];

// ---------------------------------------------------------------------------
// Événements (journal de partie)
// ---------------------------------------------------------------------------

export type GameEvent =
  | { seq: number; t: 'GAME_STARTED'; seed: string; playerIds: string[] }
  | { seq: number; t: 'DREW'; playerId: string; count: number }
  | { seq: number; t: 'DECK_RESHUFFLED'; count: number }
  | { seq: number; t: 'BANKED'; playerId: string; cardId: CardId }
  | {
      seq: number;
      t: 'PROPERTY_PLACED';
      playerId: string;
      cardId: CardId;
      groupId: string;
      color: Color;
    }
  | {
      seq: number;
      t: 'WILD_MOVED';
      playerId: string;
      cardId: CardId;
      groupId: string;
      color: Color;
    }
  | {
      seq: number;
      t: 'BUILDING_PLACED';
      playerId: string;
      cardId: CardId;
      groupId: string;
      building: 'HOUSE' | 'HOTEL';
    }
  | {
      seq: number;
      t: 'BUILDING_RETURNED';
      playerId: string;
      cardId: CardId;
      reason: 'SET_BROKEN';
    }
  | {
      seq: number;
      t: 'ACTION_PLAYED';
      playerId: string;
      cardId: CardId;
      kind: PendingKind | 'PASS_GO';
      targetIds: string[];
      amount?: number;
      color?: Color;
    }
  | {
      seq: number;
      t: 'JUST_SAY_NO';
      playerId: string;
      cardId: CardId;
      againstId: string;
    }
  | { seq: number; t: 'ACTION_CANCELLED'; targetId: string }
  | {
      seq: number;
      t: 'REFLECTED';
      playerId: string;
      cardId: CardId;
      againstId: string;
      amount: number;
    }
  | { seq: number; t: 'FINED'; playerId: string; targetId: string; actions: number }
  | {
      seq: number;
      t: 'DEBT_CREATED';
      fromId: string;
      toId: string;
      amount: number;
    }
  | {
      seq: number;
      t: 'PAID';
      fromId: string;
      toId: string;
      cardIds: CardId[];
      amount: number;
    }
  | { seq: number; t: 'DEBT_FORGIVEN'; fromId: string; toId: string }
  | {
      seq: number;
      t: 'CARDS_STOLEN';
      fromId: string;
      toId: string;
      cardIds: CardId[];
    }
  | {
      seq: number;
      t: 'CARDS_SWAPPED';
      aId: string;
      bId: string;
      aCardId: CardId;
      bCardId: CardId;
    }
  | { seq: number; t: 'DISCARDED'; playerId: string; cardIds: CardId[] }
  | { seq: number; t: 'TURN_ENDED'; playerId: string }
  | { seq: number; t: 'TURN_STARTED'; playerId: string }
  | { seq: number; t: 'GAME_OVER'; winnerId: string }
  | { seq: number; t: 'CONNECTION'; playerId: string; connected: boolean };

// ---------------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------------

export type RuleErrorCode =
  | 'WRONG_PHASE'
  | 'NOT_YOUR_TURN'
  | 'NO_ACTIONS_LEFT'
  | 'CARD_NOT_IN_HAND'
  | 'CARD_NOT_FOUND'
  | 'ILLEGAL_CARD'
  | 'ILLEGAL_TARGET'
  | 'ILLEGAL_GROUP'
  | 'SET_COMPLETE'
  | 'SET_INCOMPLETE'
  | 'GROUP_FULL'
  | 'NO_SUCH_PLAYER'
  | 'INSUFFICIENT_PAYMENT'
  | 'NOT_A_RESPONDER'
  | 'BAD_PLAYER_COUNT'
  | 'GAME_OVER'
  | 'MUST_DISCARD'
  | 'BREAKS_BUILT_SET'
  | 'NO_RENT_FOR_COLOR';

export class RuleError extends Error {
  code: RuleErrorCode;
  constructor(code: RuleErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'RuleError';
    this.code = code;
  }
}
