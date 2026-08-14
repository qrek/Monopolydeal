/**
 * Le réducteur. `reduce(state, action) => state` : pur, déterministe, sans
 * dépendance externe. Toute règle du jeu vit ici ; le client n'envoie que des
 * intentions et n'a jamais autorité sur l'état.
 */

import {
  ACTIONS,
  BIRTHDAY_AMOUNT,
  COLORS,
  DEBT_COLLECTOR_AMOUNT,
  FINE_PENALTY,
  MIN_ACTIONS_PER_TURN,
  PASS_GO_DRAW,
  RATP_CHECK_AMOUNT,
  canBank,
  freshDeckIds,
  getCard,
  isGroupComplete,
  isPropertyLike,
  possibleColors,
} from './cards.ts';
import { hashSeed, mulberry32, shuffle } from './rng.ts';
import {
  EMPTY_HAND_DRAW,
  HAND_LIMIT,
  MAX_ACTIONS_PER_TURN,
  STARTING_HAND,
  TURN_DRAW,
  actionsAllowed,
  bestRentForColor,
  findWinner,
  groupHasRoom,
  leadsOver,
  payableCards,
  rulesFor,
} from './selectors.ts';
import type {
  ActionKind,
  CardId,
  Color,
  GameAction,
  GameMode,
  GameEvent,
  GameState,
  PendingAction,
  PendingTarget,
  PlayerState,
  PropertyGroup,
} from './types.ts';
import { RuleError } from './types.ts';

// ---------------------------------------------------------------------------
// Création de partie
// ---------------------------------------------------------------------------

export interface CreateGameOptions {
  id: string;
  seed: string;
  players: Array<{ id: string; name: string }>;
  /** Défaut : la partie classique, celle d'avant les modes. */
  mode?: GameMode;
}

export function createGame(opts: CreateGameOptions): GameState {
  return {
    id: opts.id,
    mode: opts.mode ?? 'CLASSIC',
    phase: 'LOBBY',
    players: opts.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: true,
      hand: [],
      bank: [],
      groups: [],
    })),
    turnIndex: 0,
    actionsPlayed: 0,
    deck: [],
    discard: [],
    seed: opts.seed,
    shuffleCount: 0,
    pending: null,
    winnerId: null,
    events: [],
    nextGroupId: 1,
  };
}

// ---------------------------------------------------------------------------
// Utilitaires internes
// ---------------------------------------------------------------------------

function clone<T>(value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);
}

/** Omit distributif : `Omit` sur une union effondrerait les variantes. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;
type Emitted = DistributiveOmit<GameEvent, 'seq'>;

function emit(d: GameState, ev: Emitted): void {
  d.events.push({ ...ev, seq: d.events.length } as GameEvent);
}

function player(d: GameState, id: string): PlayerState {
  const p = d.players.find((x) => x.id === id);
  if (!p) throw new RuleError('NO_SUCH_PLAYER', `Joueur inconnu : ${id}`);
  return p;
}

function requireTurn(d: GameState, playerId: string): PlayerState {
  const cur = d.players[d.turnIndex];
  if (!cur || cur.id !== playerId) {
    throw new RuleError('NOT_YOUR_TURN', "Ce n'est pas votre tour");
  }
  return cur;
}

function requirePhase(d: GameState, ...phases: GameState['phase'][]): void {
  if (!phases.includes(d.phase)) {
    throw new RuleError('WRONG_PHASE', `Phase ${d.phase} inattendue`);
  }
}

function requireInHand(p: PlayerState, cardId: CardId): void {
  if (!p.hand.includes(cardId)) {
    throw new RuleError('CARD_NOT_IN_HAND', `${cardId} n'est pas en main`);
  }
}

function takeFromHand(p: PlayerState, cardId: CardId): void {
  const i = p.hand.indexOf(cardId);
  if (i < 0) throw new RuleError('CARD_NOT_IN_HAND');
  p.hand.splice(i, 1);
}

function spendActions(d: GameState, count: number): void {
  const permis = actionsAllowed(d);
  if (d.actionsPlayed + count > permis) {
    throw new RuleError(
      'NO_ACTIONS_LEFT',
      `Il faut ${count} action(s), il en reste ${permis - d.actionsPlayed}`,
    );
  }
  d.actionsPlayed += count;
}

/**
 * Ouvre le tour d'un joueur : il purge la contravention qu'il a prise, s'il en
 * a pris une. Le plafond ne descend jamais sous une action — un tour qu'on
 * regarde passer n'est pas un tour.
 */
function openTurn(d: GameState, p: PlayerState): void {
  const penalite = p.penalty ?? 0;
  d.actionsAllowed = Math.max(MIN_ACTIONS_PER_TURN, MAX_ACTIONS_PER_TURN - penalite);
  p.penalty = 0;
  d.actionsPlayed = 0;
}

function newGroupId(d: GameState): string {
  const id = `g${d.nextGroupId}`;
  d.nextGroupId += 1;
  return id;
}

function makeGroup(d: GameState, color: Color): PropertyGroup {
  return { id: newGroupId(d), color, cards: [], house: null, hotel: null };
}

// ---------------------------------------------------------------------------
// Pioche
// ---------------------------------------------------------------------------

function drawCards(d: GameState, p: PlayerState, count: number): number {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (d.deck.length === 0) {
      if (d.discard.length === 0) break;
      d.shuffleCount += 1;
      d.deck = shuffle(d.discard, d.seed, d.shuffleCount);
      d.discard = [];
      emit(d, { t: 'DECK_RESHUFFLED', count: d.deck.length });
    }
    const card = d.deck.shift();
    if (card === undefined) break;
    p.hand.push(card);
    drawn += 1;
  }
  if (drawn > 0) emit(d, { t: 'DREW', playerId: p.id, count: drawn });
  return drawn;
}

// ---------------------------------------------------------------------------
// Manipulation des lots
// ---------------------------------------------------------------------------

function returnBuildings(d: GameState, p: PlayerState, g: PropertyGroup): void {
  for (const key of ['hotel', 'house'] as const) {
    const cardId = g[key];
    if (cardId) {
      p.bank.push(cardId);
      g[key] = null;
      emit(d, {
        t: 'BUILDING_RETURNED',
        playerId: p.id,
        cardId,
        reason: 'SET_BROKEN',
      });
    }
  }
}

/**
 * Après tout retrait de carte : supprime les lots vides et renvoie en banque les
 * constructions dont le lot n'est plus complet.
 */
function normalizeGroups(d: GameState, p: PlayerState): void {
  for (const g of [...p.groups]) {
    if (g.cards.length === 0) {
      returnBuildings(d, p, g);
      p.groups = p.groups.filter((x) => x.id !== g.id);
    } else if (!isGroupComplete(g)) {
      returnBuildings(d, p, g);
    }
  }
}

/**
 * Place une carte propriété chez un joueur : dans un lot compatible non plein,
 * sinon dans un nouveau lot.
 */
function receiveProperty(
  d: GameState,
  p: PlayerState,
  cardId: CardId,
  preferredColor?: Color,
): PropertyGroup {
  const colors = possibleColors(cardId);
  const color =
    preferredColor && colors.includes(preferredColor)
      ? preferredColor
      : (colors[0] as Color);
  const existing = p.groups.find((g) => g.color === color && groupHasRoom(g));
  const group = existing ?? makeGroup(d, color);
  if (!existing) p.groups.push(group);
  group.cards.push(cardId);
  return group;
}

type RemovalOrigin =
  | { where: 'bank' }
  | { where: 'group'; color: Color }
  | { where: 'building' };

function removeOwnedCard(p: PlayerState, cardId: CardId): RemovalOrigin {
  const bankIdx = p.bank.indexOf(cardId);
  if (bankIdx >= 0) {
    p.bank.splice(bankIdx, 1);
    return { where: 'bank' };
  }
  for (const g of p.groups) {
    const idx = g.cards.indexOf(cardId);
    if (idx >= 0) {
      g.cards.splice(idx, 1);
      return { where: 'group', color: g.color };
    }
    if (g.house === cardId) {
      g.house = null;
      return { where: 'building' };
    }
    if (g.hotel === cardId) {
      g.hotel = null;
      return { where: 'building' };
    }
  }
  throw new RuleError('CARD_NOT_FOUND', `${cardId} n'appartient pas au joueur`);
}

// ---------------------------------------------------------------------------
// Victoire & phases
// ---------------------------------------------------------------------------

function checkVictory(d: GameState): void {
  if (d.winnerId) return;
  const w = findWinner(d);
  if (w) {
    d.winnerId = w;
    d.phase = 'GAME_OVER';
    emit(d, { t: 'GAME_OVER', winnerId: w });
  }
}

/** Recalcule la phase après une réponse ou un paiement. */
function settle(d: GameState): void {
  if (d.winnerId) {
    d.phase = 'GAME_OVER';
    return;
  }
  const pending = d.pending;
  if (!pending) return;
  if (pending.targets.some((t) => t.status === 'AWAITING_RESPONSE')) {
    d.phase = 'RESOLVING_ACTION';
    return;
  }
  if (pending.targets.some((t) => t.status === 'AWAITING_PAYMENT')) {
    d.phase = 'AWAITING_PAYMENT';
    return;
  }
  d.pending = null;
  d.phase = 'PLAY';
}

/**
 * Chaîne de Refus catégorique, plafonnée à 2 : la cible peut jouer un Refus
 * (action annulée), la source peut le contrer (action rétablie), et ça s'arrête
 * là — un 3e Refus est illégal.
 */
export const MAX_JSN_CHAIN = 2;

/** Parité de la chaîne : 1 Refus ⇒ action annulée, 2 ⇒ elle passe. */
export function isCancelledByChain(chainLength: number): boolean {
  return chainLength % 2 === 1;
}

// ---------------------------------------------------------------------------
// Actions ciblées
// ---------------------------------------------------------------------------

function makeTarget(targetId: string): PendingTarget {
  return {
    playerId: targetId,
    status: 'AWAITING_RESPONSE',
    jsnChain: [],
    responderId: targetId,
    debt: 0,
    paid: 0,
  };
}

function beginPending(
  d: GameState,
  cardIds: CardId[],
  pending: PendingAction,
  amount?: number,
  color?: Color,
): void {
  const src = player(d, pending.sourcePlayerId);
  for (const id of cardIds) {
    takeFromHand(src, id);
    d.discard.push(id);
  }
  d.pending = pending;
  d.phase = 'RESOLVING_ACTION';
  emit(d, {
    t: 'ACTION_PLAYED',
    playerId: pending.sourcePlayerId,
    cardId: cardIds[0] as CardId,
    kind: pending.kind,
    targetIds: pending.targets.map((t) => t.playerId),
    ...(amount === undefined ? {} : { amount }),
    ...(color === undefined ? {} : { color }),
  });
}

function createDebt(d: GameState, t: PendingTarget, amount: number): void {
  const pending = d.pending as PendingAction;
  const debtor = player(d, t.playerId);
  t.debt = amount;
  if (payableCards(debtor).length === 0) {
    // Rien en banque ni en propriétés : la dette s'éteint, sans perte.
    t.status = 'DONE';
    emit(d, {
      t: 'DEBT_FORGIVEN',
      fromId: t.playerId,
      toId: pending.sourcePlayerId,
    });
    return;
  }
  t.status = 'AWAITING_PAYMENT';
  emit(d, {
    t: 'DEBT_CREATED',
    fromId: t.playerId,
    toId: pending.sourcePlayerId,
    amount,
  });
}

/** Applique l'effet d'une action ciblée sur une cible qui ne l'a pas annulée. */
function resolveTarget(d: GameState, t: PendingTarget): void {
  const pending = d.pending as PendingAction;
  const src = player(d, pending.sourcePlayerId);
  const victim = player(d, t.playerId);

  switch (pending.kind) {
    case 'DEAL_BREAKER': {
      const g = victim.groups.find((x) => x.id === pending.groupId);
      if (!g) {
        t.status = 'DONE';
        break;
      }
      const moved: PropertyGroup = {
        id: newGroupId(d),
        color: g.color,
        cards: [...g.cards],
        house: g.house,
        hotel: g.hotel,
      };
      victim.groups = victim.groups.filter((x) => x.id !== g.id);
      src.groups.push(moved);
      emit(d, {
        t: 'CARDS_STOLEN',
        fromId: victim.id,
        toId: src.id,
        cardIds: [...moved.cards],
      });
      t.status = 'DONE';
      normalizeGroups(d, victim);
      checkVictory(d);
      break;
    }
    case 'SLY_DEAL': {
      const cardId = pending.targetCardId as CardId;
      const origin = removeOwnedCard(victim, cardId);
      const color = origin.where === 'group' ? origin.color : undefined;
      receiveProperty(d, src, cardId, color);
      emit(d, {
        t: 'CARDS_STOLEN',
        fromId: victim.id,
        toId: src.id,
        cardIds: [cardId],
      });
      t.status = 'DONE';
      normalizeGroups(d, victim);
      checkVictory(d);
      break;
    }
    case 'FORCED_DEAL': {
      const theirs = pending.targetCardId as CardId;
      const mine = pending.ownCardId as CardId;
      const theirOrigin = removeOwnedCard(victim, theirs);
      const myOrigin = removeOwnedCard(src, mine);
      receiveProperty(
        d,
        src,
        theirs,
        theirOrigin.where === 'group' ? theirOrigin.color : undefined,
      );
      receiveProperty(
        d,
        victim,
        mine,
        myOrigin.where === 'group' ? myOrigin.color : undefined,
      );
      emit(d, {
        t: 'CARDS_SWAPPED',
        aId: src.id,
        bId: victim.id,
        aCardId: mine,
        bCardId: theirs,
      });
      t.status = 'DONE';
      normalizeGroups(d, victim);
      normalizeGroups(d, src);
      checkVictory(d);
      break;
    }
    case 'DEBT_COLLECTOR':
      createDebt(d, t, DEBT_COLLECTOR_AMOUNT);
      break;
    case 'BIRTHDAY':
      createDebt(d, t, BIRTHDAY_AMOUNT);
      break;
    case 'RENT':
      createDebt(d, t, pending.amount ?? 0);
      break;
    case 'RATP_CHECK':
      createDebt(d, t, RATP_CHECK_AMOUNT);
      break;
    case 'FINE': {
      victim.penalty = (victim.penalty ?? 0) + FINE_PENALTY;
      emit(d, {
        t: 'FINED',
        playerId: src.id,
        targetId: victim.id,
        actions: FINE_PENALTY,
      });
      t.status = 'DONE';
      break;
    }
    case 'TAIL': {
      // La plus chère de sa main, et rien d'autre : la Filature prive, elle
      // n'enrichit pas. À deux, une carte volée compte double — une carte
      // détruite ne compte qu'une fois, et c'est ce qui la rend jouable.
      const proie = plusChere(victim.hand);
      if (proie) {
        takeFromHand(victim, proie);
        d.discard.push(proie);
        emit(d, { t: 'DISCARDED', playerId: victim.id, cardIds: [proie] });
      }
      t.status = 'DONE';
      break;
    }
  }
}

/** La carte de plus forte valeur bancaire ; à égalité, la première en main. */
function plusChere(hand: CardId[]): CardId | null {
  let best: CardId | null = null;
  let bestValue = -1;
  for (const id of hand) {
    const v = getCard(id).value;
    if (v > bestValue) {
      bestValue = v;
      best = id;
    }
  }
  return best;
}

function finishResponse(d: GameState, t: PendingTarget): void {
  if (isCancelledByChain(t.jsnChain.length)) {
    t.status = 'CANCELLED';
    emit(d, { t: 'ACTION_CANCELLED', targetId: t.playerId });
  } else {
    resolveTarget(d, t);
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Qui ouvre la partie. Dérivé du seed, comme le mélange : deux serveurs qui
 * rejouent le même journal doivent tomber sur le même joueur.
 */
function pickStarter(count: number, seed: string): number {
  return Math.floor(mulberry32(hashSeed(`start:${seed}`))() * count);
}

function handleStartGame(d: GameState): void {
  requirePhase(d, 'LOBBY');
  const rules = rulesFor(d.mode);
  if (d.players.length < rules.minPlayers || d.players.length > rules.maxPlayers) {
    throw new RuleError(
      'BAD_PLAYER_COUNT',
      rules.minPlayers === rules.maxPlayers
        ? `Ce mode se joue à ${rules.minPlayers} joueurs`
        : `Il faut ${rules.minPlayers} à ${rules.maxPlayers} joueurs`,
    );
  }
  d.deck = shuffle(freshDeckIds(d.mode), d.seed, 0);
  emit(d, {
    t: 'GAME_STARTED',
    seed: d.seed,
    playerIds: d.players.map((p) => p.id),
  });
  for (let i = 0; i < STARTING_HAND; i++) {
    for (const p of d.players) {
      const card = d.deck.shift();
      if (card !== undefined) p.hand.push(card);
    }
  }
  // Qui commence est tiré au sort. C'était l'hôte, c'est-à-dire celui qui a
  // créé la partie : à deux, commencer vaut plusieurs points de victoire, et
  // personne n'a envie que ça se décide au moment de cliquer sur « Créer ».
  // Le tirage vient du seed, donc il reste rejouable comme le mélange.
  const start = pickStarter(d.players.length, d.seed);
  // Compensation du second joueur : celui qui ne commence pas entre en jeu
  // avec un peu plus en main. Sans cela, à deux, la place décide de la partie
  // presque aussi souvent que le jeu. Elle suit le tirage — le compensé est
  // celui qui joue APRÈS, pas le deuxième arrivé dans le salon.
  const second = d.players[(start + 1) % d.players.length];
  if (second) {
    for (let i = 0; i < rules.secondPlayerBonus; i++) {
      const card = d.deck.shift();
      if (card !== undefined) second.hand.push(card);
    }
  }
  d.turnIndex = start;
  d.phase = 'DRAW';
  const first = d.players[start] as PlayerState;
  openTurn(d, first);
  emit(d, { t: 'TURN_STARTED', playerId: first.id });
}

function handleDraw(d: GameState, playerId: string): void {
  requirePhase(d, 'DRAW');
  const p = requireTurn(d, playerId);
  // Main vide en début de tour ⇒ 5 cartes au lieu de 2.
  drawCards(d, p, p.hand.length === 0 ? EMPTY_HAND_DRAW : TURN_DRAW);
  d.actionsPlayed = 0;
  d.phase = 'PLAY';
}

function handlePlayMoney(d: GameState, playerId: string, cardId: CardId): void {
  requirePhase(d, 'PLAY');
  const p = requireTurn(d, playerId);
  requireInHand(p, cardId);
  if (!canBank(cardId)) {
    throw new RuleError(
      'ILLEGAL_CARD',
      'Un joker universel ne peut pas être joué comme argent',
    );
  }
  spendActions(d, 1);
  takeFromHand(p, cardId);
  p.bank.push(cardId);
  emit(d, { t: 'BANKED', playerId, cardId });
}

function resolveTargetGroup(
  d: GameState,
  p: PlayerState,
  cardId: CardId,
  opts: { groupId?: string; color?: Color; newGroup?: boolean },
): PropertyGroup {
  const colors = possibleColors(cardId);
  if (opts.groupId) {
    const g = p.groups.find((x) => x.id === opts.groupId);
    if (!g) throw new RuleError('ILLEGAL_GROUP', 'Lot introuvable');
    if (!colors.includes(g.color)) {
      throw new RuleError(
        'ILLEGAL_GROUP',
        'Cette carte ne peut pas prendre cette couleur',
      );
    }
    if (!groupHasRoom(g)) throw new RuleError('GROUP_FULL', 'Lot déjà plein');
    return g;
  }
  const color = opts.color ?? (colors.length === 1 ? colors[0] : undefined);
  if (!color) {
    throw new RuleError('ILLEGAL_GROUP', 'Couleur à préciser pour un joker');
  }
  if (!colors.includes(color)) {
    throw new RuleError(
      'ILLEGAL_GROUP',
      'Cette carte ne peut pas prendre cette couleur',
    );
  }
  if (!opts.newGroup) {
    const existing = p.groups.find((g) => g.color === color && groupHasRoom(g));
    if (existing) return existing;
  }
  const g = makeGroup(d, color);
  p.groups.push(g);
  return g;
}

function handlePlayProperty(
  d: GameState,
  a: Extract<GameAction, { type: 'PLAY_PROPERTY' }>,
): void {
  requirePhase(d, 'PLAY');
  const p = requireTurn(d, a.playerId);
  requireInHand(p, a.cardId);
  if (!isPropertyLike(a.cardId)) {
    throw new RuleError('ILLEGAL_CARD', "Cette carte n'est pas une propriété");
  }
  const g = resolveTargetGroup(d, p, a.cardId, a);
  spendActions(d, 1);
  takeFromHand(p, a.cardId);
  g.cards.push(a.cardId);
  emit(d, {
    t: 'PROPERTY_PLACED',
    playerId: p.id,
    cardId: a.cardId,
    groupId: g.id,
    color: g.color,
  });
  checkVictory(d);
}

function handleMoveWild(
  d: GameState,
  a: Extract<GameAction, { type: 'MOVE_WILD' }>,
): void {
  requirePhase(d, 'PLAY');
  const p = requireTurn(d, a.playerId);
  const kind = getCard(a.cardId).kind;
  if (kind !== 'WILD' && kind !== 'WILD_ANY') {
    throw new RuleError('ILLEGAL_CARD', "Cette carte n'est pas un joker");
  }
  const from = p.groups.find((g) => g.cards.includes(a.cardId));
  if (!from) throw new RuleError('CARD_NOT_FOUND', "Ce joker n'est pas posé");

  // Cas limite 4 : on interdit la permutation si elle casse un lot complet
  // portant une Maison ou un Hôtel — la construction n'aurait nulle part où aller.
  if (isGroupComplete(from) && (from.house || from.hotel)) {
    throw new RuleError(
      'BREAKS_BUILT_SET',
      'Ce lot porte une construction : la permutation le casserait',
    );
  }

  const to = resolveTargetGroup(d, p, a.cardId, a);
  if (to.id === from.id) {
    throw new RuleError('ILLEGAL_GROUP', 'Le joker est déjà dans ce lot');
  }
  from.cards.splice(from.cards.indexOf(a.cardId), 1);
  to.cards.push(a.cardId);
  normalizeGroups(d, p);
  emit(d, {
    t: 'WILD_MOVED',
    playerId: p.id,
    cardId: a.cardId,
    groupId: to.id,
    color: to.color,
  });
  checkVictory(d);
}

function handlePlayBuilding(
  d: GameState,
  a: Extract<GameAction, { type: 'PLAY_BUILDING' }>,
): void {
  requirePhase(d, 'PLAY');
  const p = requireTurn(d, a.playerId);
  requireInHand(p, a.cardId);
  const card = getCard(a.cardId);
  if (card.kind !== 'ACTION' || (card.action !== 'HOUSE' && card.action !== 'HOTEL')) {
    throw new RuleError('ILLEGAL_CARD', 'Ni Maison ni Hôtel');
  }
  const g = p.groups.find((x) => x.id === a.groupId);
  if (!g) throw new RuleError('ILLEGAL_GROUP', 'Lot introuvable');
  if (!isGroupComplete(g)) {
    throw new RuleError('SET_INCOMPLETE', 'Le lot doit être complet');
  }
  if (!COLORS[g.color].buildable) {
    throw new RuleError(
      'ILLEGAL_GROUP',
      'Les lots Transports et Services ne se construisent pas',
    );
  }
  if (card.action === 'HOUSE') {
    if (g.house) throw new RuleError('ILLEGAL_GROUP', 'Maison déjà posée');
  } else {
    if (!g.house) {
      throw new RuleError('ILLEGAL_GROUP', "Il faut une Maison avant l'Hôtel");
    }
    if (g.hotel) throw new RuleError('ILLEGAL_GROUP', 'Hôtel déjà posé');
  }
  spendActions(d, 1);
  takeFromHand(p, a.cardId);
  if (card.action === 'HOUSE') g.house = a.cardId;
  else g.hotel = a.cardId;
  emit(d, {
    t: 'BUILDING_PLACED',
    playerId: p.id,
    cardId: a.cardId,
    groupId: g.id,
    building: card.action,
  });
}

function requireActionCard(
  p: PlayerState,
  cardId: CardId,
  kind: ActionKind,
): void {
  requireInHand(p, cardId);
  const card = getCard(cardId);
  if (card.kind !== 'ACTION' || card.action !== kind) {
    throw new RuleError('ILLEGAL_CARD', `Attendu : ${ACTIONS[kind].label}`);
  }
}

function handlePassGo(d: GameState, playerId: string, cardId: CardId): void {
  requirePhase(d, 'PLAY');
  const p = requireTurn(d, playerId);
  requireActionCard(p, cardId, 'PASS_GO');
  spendActions(d, 1);
  takeFromHand(p, cardId);
  d.discard.push(cardId);
  emit(d, {
    t: 'ACTION_PLAYED',
    playerId,
    cardId,
    kind: 'PASS_GO',
    targetIds: [],
  });
  drawCards(d, p, PASS_GO_DRAW);
}

function requireOpponent(
  d: GameState,
  playerId: string,
  targetId: string,
): PlayerState {
  if (targetId === playerId) {
    throw new RuleError('ILLEGAL_TARGET', 'Il faut viser un adversaire');
  }
  return player(d, targetId);
}

function handleDealBreaker(
  d: GameState,
  a: Extract<GameAction, { type: 'PLAY_DEAL_BREAKER' }>,
): void {
  requirePhase(d, 'PLAY');
  const p = requireTurn(d, a.playerId);
  requireActionCard(p, a.cardId, 'DEAL_BREAKER');
  const victim = requireOpponent(d, a.playerId, a.targetPlayerId);
  const g = victim.groups.find((x) => x.id === a.targetGroupId);
  if (!g) throw new RuleError('ILLEGAL_GROUP', 'Lot introuvable');
  if (!isGroupComplete(g)) {
    throw new RuleError(
      'SET_INCOMPLETE',
      'Coup de filet ne prend que des lots complets',
    );
  }
  spendActions(d, 1);
  beginPending(d, [a.cardId], {
    kind: 'DEAL_BREAKER',
    sourcePlayerId: a.playerId,
    targets: [makeTarget(victim.id)],
    groupId: g.id,
  });
}

/** Une carte visée par Affaire douteuse / Échange forcé ne doit pas être dans un lot complet. */
function requireStealableCard(p: PlayerState, cardId: CardId): void {
  const g = p.groups.find((x) => x.cards.includes(cardId));
  if (!g) {
    throw new RuleError('ILLEGAL_TARGET', "Cette propriété n'est pas posée");
  }
  if (isGroupComplete(g)) {
    throw new RuleError(
      'SET_COMPLETE',
      "On ne pioche pas dans un lot complet",
    );
  }
}

function handleSlyDeal(
  d: GameState,
  a: Extract<GameAction, { type: 'PLAY_SLY_DEAL' }>,
): void {
  requirePhase(d, 'PLAY');
  const p = requireTurn(d, a.playerId);
  requireActionCard(p, a.cardId, 'SLY_DEAL');
  const victim = requireOpponent(d, a.playerId, a.targetPlayerId);
  requireStealableCard(victim, a.targetCardId);
  spendActions(d, 1);
  beginPending(d, [a.cardId], {
    kind: 'SLY_DEAL',
    sourcePlayerId: a.playerId,
    targets: [makeTarget(victim.id)],
    targetCardId: a.targetCardId,
  });
}

function handleForcedDeal(
  d: GameState,
  a: Extract<GameAction, { type: 'PLAY_FORCED_DEAL' }>,
): void {
  requirePhase(d, 'PLAY');
  const p = requireTurn(d, a.playerId);
  requireActionCard(p, a.cardId, 'FORCED_DEAL');
  const victim = requireOpponent(d, a.playerId, a.targetPlayerId);
  requireStealableCard(victim, a.targetCardId);
  requireStealableCard(p, a.ownCardId);
  spendActions(d, 1);
  beginPending(d, [a.cardId], {
    kind: 'FORCED_DEAL',
    sourcePlayerId: a.playerId,
    targets: [makeTarget(victim.id)],
    targetCardId: a.targetCardId,
    ownCardId: a.ownCardId,
  });
}

function handleDebtCollector(
  d: GameState,
  a: Extract<GameAction, { type: 'PLAY_DEBT_COLLECTOR' }>,
): void {
  requirePhase(d, 'PLAY');
  const p = requireTurn(d, a.playerId);
  requireActionCard(p, a.cardId, 'DEBT_COLLECTOR');
  const victim = requireOpponent(d, a.playerId, a.targetPlayerId);
  spendActions(d, 1);
  beginPending(
    d,
    [a.cardId],
    {
      kind: 'DEBT_COLLECTOR',
      sourcePlayerId: a.playerId,
      targets: [makeTarget(victim.id)],
    },
    DEBT_COLLECTOR_AMOUNT,
  );
}

/**
 * Contravention : une action de moins au prochain tour de la cible. Elle passe
 * par la fenêtre de Refus comme toute action visant quelqu'un, et ne réclame
 * rien — c'est du tempo, pas de l'argent.
 */
function handleFine(
  d: GameState,
  a: Extract<GameAction, { type: 'PLAY_FINE' }>,
): void {
  requirePhase(d, 'PLAY');
  const p = requireTurn(d, a.playerId);
  requireActionCard(p, a.cardId, 'FINE');
  const victim = requireOpponent(d, a.playerId, a.targetPlayerId);
  spendActions(d, 1);
  beginPending(d, [a.cardId], {
    kind: 'FINE',
    sourcePlayerId: a.playerId,
    targets: [makeTarget(victim.id)],
  });
}

/**
 * Contrôle RATP : celui qui mène paie. On refuse le coup à celui qui mène —
 * c'est tout l'intérêt de la carte, elle dort en main tant qu'on est devant, et
 * elle vaut son pesant de billets à celui qui court après.
 */
function handleRatpCheck(
  d: GameState,
  a: Extract<GameAction, { type: 'PLAY_RATP_CHECK' }>,
): void {
  requirePhase(d, 'PLAY');
  const p = requireTurn(d, a.playerId);
  requireActionCard(p, a.cardId, 'RATP_CHECK');
  const victim = requireOpponent(d, a.playerId, a.targetPlayerId);
  if (!leadsOver(victim, p)) {
    throw new RuleError(
      'ILLEGAL_TARGET',
      'Le Contrôle ne vise que celui qui mène : lots complets, puis banque',
    );
  }
  spendActions(d, 1);
  beginPending(
    d,
    [a.cardId],
    {
      kind: 'RATP_CHECK',
      sourcePlayerId: a.playerId,
      targets: [makeTarget(victim.id)],
    },
    RATP_CHECK_AMOUNT,
  );
}

/** Filature : la cible défausse sa carte la plus chère. */
function handleTail(
  d: GameState,
  a: Extract<GameAction, { type: 'PLAY_TAIL' }>,
): void {
  requirePhase(d, 'PLAY');
  const p = requireTurn(d, a.playerId);
  requireActionCard(p, a.cardId, 'TAIL');
  const victim = requireOpponent(d, a.playerId, a.targetPlayerId);
  if (victim.hand.length === 0) {
    throw new RuleError('ILLEGAL_TARGET', "Sa main est vide : il n'y a rien à filer");
  }
  spendActions(d, 1);
  beginPending(d, [a.cardId], {
    kind: 'TAIL',
    sourcePlayerId: a.playerId,
    targets: [makeTarget(victim.id)],
  });
}

function handleBirthday(
  d: GameState,
  a: Extract<GameAction, { type: 'PLAY_BIRTHDAY' }>,
): void {
  requirePhase(d, 'PLAY');
  const p = requireTurn(d, a.playerId);
  requireActionCard(p, a.cardId, 'BIRTHDAY');
  spendActions(d, 1);
  beginPending(
    d,
    [a.cardId],
    {
      kind: 'BIRTHDAY',
      sourcePlayerId: a.playerId,
      // Chaque adversaire est une cible indépendante : réponse et paiement séparés.
      targets: d.players
        .filter((x) => x.id !== a.playerId)
        .map((x) => makeTarget(x.id)),
    },
    BIRTHDAY_AMOUNT,
  );
}

function handleRent(
  d: GameState,
  a: Extract<GameAction, { type: 'PLAY_RENT' }>,
): void {
  requirePhase(d, 'PLAY');
  const p = requireTurn(d, a.playerId);
  requireInHand(p, a.cardId);
  const card = getCard(a.cardId);
  if (card.kind !== 'RENT') {
    throw new RuleError('ILLEGAL_CARD', "Ce n'est pas une carte Loyer");
  }
  if (!card.colors.includes(a.color)) {
    throw new RuleError(
      'ILLEGAL_CARD',
      'Cette carte Loyer ne couvre pas cette couleur',
    );
  }
  const doubles = a.doubleCardIds ?? [];
  if (new Set(doubles).size !== doubles.length) {
    throw new RuleError('ILLEGAL_CARD', 'Double loyer dupliqué');
  }
  for (const id of doubles) requireActionCard(p, id, 'DOUBLE_RENT');

  // C'est la différence entre les deux quittances, et tout leur équilibre : la
  // bicolore ne couvre que deux couleurs mais encaisse auprès de la table
  // entière, l'universelle couvre tout mais ne vise qu'un joueur.
  let victims: PlayerState[];
  if (card.universal) {
    if (!a.targetPlayerId) {
      throw new RuleError('ILLEGAL_TARGET', 'Il faut viser un adversaire');
    }
    victims = [requireOpponent(d, a.playerId, a.targetPlayerId)];
  } else {
    victims = d.players.filter((x) => x.id !== a.playerId);
  }

  const base = bestRentForColor(p, a.color);
  if (base === 0) {
    throw new RuleError(
      'NO_RENT_FOR_COLOR',
      'Aucune carte possédée dans cette couleur',
    );
  }
  // Le loyer coûte 1 action, chaque Double loyer une action supplémentaire.
  spendActions(d, 1 + doubles.length);
  const amount = base * Math.pow(2, doubles.length);
  beginPending(
    d,
    [a.cardId, ...doubles],
    {
      kind: 'RENT',
      sourcePlayerId: a.playerId,
      // Une cible par adversaire : chacun répond et paie pour son compte,
      // exactement comme sur Anniversaire.
      targets: victims.map((v) => makeTarget(v.id)),
      color: a.color,
      amount,
    },
    amount,
    a.color,
  );
}

// ---------------------------------------------------------------------------
// Réponses
// ---------------------------------------------------------------------------

function findRespondingTarget(
  d: GameState,
  playerId: string,
  againstPlayerId?: string,
): PendingTarget {
  const pending = d.pending;
  if (!pending) throw new RuleError('WRONG_PHASE', 'Aucune action en cours');
  const matches = pending.targets.filter(
    (t) => t.status === 'AWAITING_RESPONSE' && t.responderId === playerId,
  );
  const t = againstPlayerId
    ? matches.find((x) => x.playerId === againstPlayerId)
    : matches[0];
  if (!t) {
    throw new RuleError('NOT_A_RESPONDER', "Ce n'est pas à vous de répondre");
  }
  return t;
}

/** Les demandes qui se renvoient : celles qui réclament de l'argent. */
const RENVOYABLES: ReadonlySet<PendingAction['kind']> = new Set([
  'DEBT_COLLECTOR',
  'BIRTHDAY',
  'RENT',
  'RATP_CHECK',
]);

/**
 * Renvoi : la demande repart chez son auteur, au même montant.
 *
 * Il se joue à la place d'un Refus, et avant lui : une fois la chaîne de Refus
 * entamée, la question posée n'est plus « qui paie » mais « qui a le dernier
 * Refus », et intercaler un renvoi là-dedans ne se raconte plus. Un seul
 * aller-retour par demande, sans quoi deux joueurs bien pourvus se la
 * renverraient jusqu'à épuisement.
 */
function handleReflect(
  d: GameState,
  a: Extract<GameAction, { type: 'RESPOND_REFLECT' }>,
): void {
  requirePhase(d, 'RESOLVING_ACTION');
  const pending = d.pending as PendingAction;
  const t = findRespondingTarget(d, a.playerId, a.againstPlayerId);
  if (!RENVOYABLES.has(pending.kind)) {
    throw new RuleError('ILLEGAL_CARD', 'Un Renvoi ne renvoie que les demandes d’argent');
  }
  if (pending.reflected) {
    throw new RuleError('ILLEGAL_CARD', 'Cette demande a déjà été renvoyée une fois');
  }
  if (a.playerId !== t.playerId) {
    throw new RuleError('ILLEGAL_CARD', 'Seule la cible peut renvoyer');
  }
  // Garde-fou : avec une chaîne plafonnée à deux Refus, la cible ne reprend
  // jamais la parole après en avoir joué un — la demande est déjà résolue. Le
  // jour où le plafond bouge, la règle, elle, ne bouge pas.
  if (t.jsnChain.length > 0) {
    throw new RuleError('ILLEGAL_CARD', 'Trop tard : un Refus a déjà été joué');
  }
  const p = player(d, a.playerId);
  requireActionCard(p, a.cardId, 'REFLECT');
  takeFromHand(p, a.cardId);
  d.discard.push(a.cardId);

  const auteur = pending.sourcePlayerId;
  const montant =
    pending.kind === 'RENT'
      ? (pending.amount ?? 0)
      : pending.kind === 'BIRTHDAY'
        ? BIRTHDAY_AMOUNT
        : pending.kind === 'RATP_CHECK'
          ? RATP_CHECK_AMOUNT
          : DEBT_COLLECTOR_AMOUNT;

  // La demande change de camp : l'ancienne cible en devient l'auteur, et
  // l'auteur la cible. Le montant, lui, ne bouge pas.
  d.pending = {
    ...pending,
    sourcePlayerId: a.playerId,
    reflected: true,
    amount: montant,
    targets: [makeTarget(auteur)],
  };
  emit(d, {
    t: 'REFLECTED',
    playerId: a.playerId,
    cardId: a.cardId,
    againstId: auteur,
    amount: montant,
  });
  settle(d);
}

function handleJustSayNo(
  d: GameState,
  a: Extract<GameAction, { type: 'RESPOND_JUST_SAY_NO' }>,
): void {
  requirePhase(d, 'RESOLVING_ACTION', 'AWAITING_PAYMENT');
  const pending = d.pending as PendingAction;
  const t = findRespondingTarget(d, a.playerId, a.againstPlayerId);
  if (t.jsnChain.length >= MAX_JSN_CHAIN) {
    throw new RuleError(
      'ILLEGAL_CARD',
      `La chaîne de Refus est limitée à ${MAX_JSN_CHAIN}`,
    );
  }
  const p = player(d, a.playerId);
  requireActionCard(p, a.cardId, 'JUST_SAY_NO');
  takeFromHand(p, a.cardId);
  d.discard.push(a.cardId);
  t.jsnChain.push(a.cardId);
  // La cible du Refus est le joueur qui vient de jouer : on alterne.
  const against =
    a.playerId === t.playerId ? pending.sourcePlayerId : t.playerId;
  t.responderId = against;
  emit(d, {
    t: 'JUST_SAY_NO',
    playerId: a.playerId,
    cardId: a.cardId,
    againstId: against,
  });
  // Chaîne au plafond : plus personne ne peut contrer, on résout tout de suite.
  if (t.jsnChain.length >= MAX_JSN_CHAIN) finishResponse(d, t);
  settle(d);
}

function handleAccept(
  d: GameState,
  a: Extract<GameAction, { type: 'RESPOND_ACCEPT' }>,
): void {
  requirePhase(d, 'RESOLVING_ACTION', 'AWAITING_PAYMENT');
  const t = findRespondingTarget(d, a.playerId, a.againstPlayerId);
  finishResponse(d, t);
  settle(d);
}

// ---------------------------------------------------------------------------
// Paiement
// ---------------------------------------------------------------------------

function handlePay(
  d: GameState,
  a: Extract<GameAction, { type: 'PAY' }>,
): void {
  requirePhase(d, 'RESOLVING_ACTION', 'AWAITING_PAYMENT');
  const pending = d.pending;
  if (!pending) throw new RuleError('WRONG_PHASE', 'Aucune dette en cours');
  const t = pending.targets.find(
    (x) => x.playerId === a.playerId && x.status === 'AWAITING_PAYMENT',
  );
  if (!t) throw new RuleError('NOT_A_RESPONDER', "Vous n'avez rien à payer");

  const payer = player(d, a.playerId);
  const receiver = player(d, pending.sourcePlayerId);
  const owned = payableCards(payer);
  if (new Set(a.cardIds).size !== a.cardIds.length) {
    throw new RuleError('ILLEGAL_CARD', 'Carte dupliquée dans le paiement');
  }
  for (const id of a.cardIds) {
    if (!owned.includes(id)) {
      throw new RuleError('CARD_NOT_FOUND', `${id} n'est pas payable`);
    }
  }
  const total = a.cardIds.reduce((s, id) => s + getCard(id).value, 0);
  // On ne rend pas la monnaie : payer plus que dû est permis. En revanche il faut
  // soit couvrir la dette, soit donner littéralement tout ce qu'on possède.
  const givesEverything = a.cardIds.length === owned.length;
  if (total < t.debt && !givesEverything) {
    throw new RuleError(
      'INSUFFICIENT_PAYMENT',
      `Il manque ${t.debt - total}M`,
    );
  }

  for (const id of a.cardIds) {
    removeOwnedCard(payer, id);
    if (isPropertyLike(id)) {
      receiveProperty(d, receiver, id);
    } else {
      // Argent, actions… et Maison/Hôtel donnés en paiement : tout va en banque.
      receiver.bank.push(id);
    }
  }
  t.paid = total;
  t.status = 'DONE';
  normalizeGroups(d, payer);
  emit(d, {
    t: 'PAID',
    fromId: payer.id,
    toId: receiver.id,
    cardIds: [...a.cardIds],
    amount: total,
  });
  checkVictory(d);
  settle(d);
}

// ---------------------------------------------------------------------------
// Fin de tour
// ---------------------------------------------------------------------------

function handleEndTurn(d: GameState, playerId: string): void {
  requirePhase(d, 'PLAY', 'DRAW');
  const p = requireTurn(d, playerId);
  if (p.hand.length > HAND_LIMIT) {
    d.phase = 'DISCARD';
    return;
  }
  d.phase = 'END_TURN';
  emit(d, { t: 'TURN_ENDED', playerId });
}

function handleDiscard(
  d: GameState,
  a: Extract<GameAction, { type: 'DISCARD' }>,
): void {
  requirePhase(d, 'DISCARD');
  const p = requireTurn(d, a.playerId);
  if (new Set(a.cardIds).size !== a.cardIds.length) {
    throw new RuleError('ILLEGAL_CARD', 'Carte dupliquée dans la défausse');
  }
  for (const id of a.cardIds) requireInHand(p, id);
  if (p.hand.length - a.cardIds.length !== HAND_LIMIT) {
    throw new RuleError(
      'MUST_DISCARD',
      `Il faut défausser exactement ${p.hand.length - HAND_LIMIT} carte(s)`,
    );
  }
  for (const id of a.cardIds) {
    takeFromHand(p, id);
    d.discard.push(id);
  }
  emit(d, { t: 'DISCARDED', playerId: p.id, cardIds: [...a.cardIds] });
  d.phase = 'END_TURN';
  emit(d, { t: 'TURN_ENDED', playerId: p.id });
}

function handleAdvanceTurn(d: GameState): void {
  requirePhase(d, 'END_TURN');
  d.turnIndex = (d.turnIndex + 1) % d.players.length;
  d.pending = null;
  d.phase = 'DRAW';
  const next = d.players[d.turnIndex] as PlayerState;
  openTurn(d, next);
  emit(d, { t: 'TURN_STARTED', playerId: next.id });
}

// ---------------------------------------------------------------------------
// reduce
// ---------------------------------------------------------------------------

function apply(d: GameState, a: GameAction): void {
  if (d.phase === 'GAME_OVER' && a.type !== 'SET_CONNECTED') {
    throw new RuleError('GAME_OVER', 'La partie est terminée');
  }
  switch (a.type) {
    case 'START_GAME':
      return handleStartGame(d);
    case 'DRAW':
      return handleDraw(d, a.playerId);
    case 'PLAY_MONEY':
      return handlePlayMoney(d, a.playerId, a.cardId);
    case 'PLAY_PROPERTY':
      return handlePlayProperty(d, a);
    case 'MOVE_WILD':
      return handleMoveWild(d, a);
    case 'PLAY_BUILDING':
      return handlePlayBuilding(d, a);
    case 'PLAY_PASS_GO':
      return handlePassGo(d, a.playerId, a.cardId);
    case 'PLAY_DEAL_BREAKER':
      return handleDealBreaker(d, a);
    case 'PLAY_SLY_DEAL':
      return handleSlyDeal(d, a);
    case 'PLAY_FORCED_DEAL':
      return handleForcedDeal(d, a);
    case 'PLAY_DEBT_COLLECTOR':
      return handleDebtCollector(d, a);
    case 'PLAY_FINE':
      return handleFine(d, a);
    case 'PLAY_RATP_CHECK':
      return handleRatpCheck(d, a);
    case 'PLAY_TAIL':
      return handleTail(d, a);
    case 'PLAY_BIRTHDAY':
      return handleBirthday(d, a);
    case 'PLAY_RENT':
      return handleRent(d, a);
    case 'RESPOND_JUST_SAY_NO':
      return handleJustSayNo(d, a);
    case 'RESPOND_REFLECT':
      return handleReflect(d, a);
    case 'RESPOND_ACCEPT':
      return handleAccept(d, a);
    case 'PAY':
      return handlePay(d, a);
    case 'DISCARD':
      return handleDiscard(d, a);
    case 'END_TURN':
      return handleEndTurn(d, a.playerId);
    case 'ADVANCE_TURN':
      return handleAdvanceTurn(d);
    case 'SET_CONNECTED': {
      const p = player(d, a.playerId);
      p.connected = a.connected;
      emit(d, {
        t: 'CONNECTION',
        playerId: a.playerId,
        connected: a.connected,
      });
      return;
    }
  }
}

/** Réducteur pur : ne mute jamais `state`. */
export function reduce(state: GameState, action: GameAction): GameState {
  const d = clone(state);
  apply(d, action);
  return d;
}

/** Enchaîne plusieurs intentions. Pratique pour les tests et le replay. */
export function reduceAll(
  state: GameState,
  actions: readonly GameAction[],
): GameState {
  return actions.reduce<GameState>((s, a) => reduce(s, a), state);
}

/**
 * Reconstruit l'état courant depuis le log append-only.
 * C'est ce qui permet la reconnexion en cours de partie.
 */
export function replay(
  init: CreateGameOptions,
  actions: readonly GameAction[],
): GameState {
  return reduceAll(createGame(init), actions);
}

/** Vrai si l'intention est jouable, sans lever d'exception. */
export function canReduce(state: GameState, action: GameAction): boolean {
  try {
    reduce(state, action);
    return true;
  } catch (e) {
    if (e instanceof RuleError) return false;
    throw e;
  }
}

/**
 * Transitions que le serveur applique tout seul, sans attendre le client.
 * Aujourd'hui : sortir de END_TURN pour passer la main.
 */
export function getAutoActions(state: GameState): GameAction[] {
  if (state.phase === 'END_TURN') return [{ type: 'ADVANCE_TURN' }];
  return [];
}
