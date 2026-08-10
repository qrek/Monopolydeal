/**
 * Ce que le client croit jouable. Ces lectures ne servent qu'à guider la main
 * — griser une zone, proposer les bonnes cibles. Le moteur côté serveur reste
 * seul juge : toute intention repart chez lui et peut être refusée.
 */

import {
  COLORS,
  canBank,
  getCard,
  isGroupComplete,
  isPropertyLike,
  possibleColors,
  type CardId,
  type Color,
  type PropertyGroup,
  type RedactedPlayer,
  type RedactedState,
} from '@/lib/engine';

/** Les trois destinations d'une carte quittant la main. */
export type Destination = 'BANK' | 'PROPERTY' | 'ACTION';

export const DESTINATION_LABEL: Record<Destination, string> = {
  BANK: 'Banque',
  PROPERTY: 'Mes propriétés',
  ACTION: 'Jouer l’action',
};

/** Une carte Maison ou Hôtel se pose sur un lot, pas parmi les propriétés. */
export function isBuilding(cardId: CardId): boolean {
  const card = getCard(cardId);
  return card.kind === 'ACTION' && (card.action === 'HOUSE' || card.action === 'HOTEL');
}

export function isJustSayNo(cardId: CardId): boolean {
  const card = getCard(cardId);
  return card.kind === 'ACTION' && card.action === 'JUST_SAY_NO';
}

export function isDoubleRent(cardId: CardId): boolean {
  const card = getCard(cardId);
  return card.kind === 'ACTION' && card.action === 'DOUBLE_RENT';
}

/**
 * Destinations possibles pour une carte en main. Le Refus catégorique et le
 * Double loyer ne se jouent jamais seuls : ils répondent ou accompagnent, donc
 * hors banque il n'y a rien à en faire depuis la main.
 */
export function destinationsFor(cardId: CardId): Destination[] {
  const card = getCard(cardId);
  const out: Destination[] = [];
  if (canBank(cardId)) out.push('BANK');
  if (isPropertyLike(cardId)) out.push('PROPERTY');
  if (card.kind === 'RENT') out.push('ACTION');
  if (card.kind === 'ACTION' && !isJustSayNo(cardId) && !isDoubleRent(cardId)) {
    out.push('ACTION');
  }
  if (isBuilding(cardId)) {
    // Une construction va sur un lot : c'est « jouer », pas « poser ».
    return out.filter((d) => d !== 'PROPERTY');
  }
  return out;
}

/** Lots du joueur pouvant accueillir cette carte, par couleur possible. */
export function landableGroups(
  player: RedactedPlayer,
  cardId: CardId,
): PropertyGroup[] {
  const colors = possibleColors(cardId);
  return player.groups.filter(
    (g) => colors.includes(g.color) && g.cards.length < COLORS[g.color].size,
  );
}

/** Lots complets et constructibles : cibles d'une Maison ou d'un Hôtel. */
export function buildableGroups(
  player: RedactedPlayer,
  building: 'HOUSE' | 'HOTEL',
): PropertyGroup[] {
  return player.groups.filter((g) => {
    if (!isGroupComplete(g) || !COLORS[g.color].buildable) return false;
    return building === 'HOUSE' ? !g.house : Boolean(g.house) && !g.hotel;
  });
}

/** Cartes volables chez un adversaire : jamais celles d'un lot complet. */
export function stealableCards(player: RedactedPlayer): CardId[] {
  return player.groups
    .filter((g) => !isGroupComplete(g))
    .flatMap((g) => g.cards);
}

/** Lots complets d'un adversaire : cibles du Coup de filet. */
export function completeGroupsOf(player: RedactedPlayer): PropertyGroup[] {
  return player.groups.filter(isGroupComplete);
}

/** Couleurs pour lesquelles je possède au moins une carte : loyers réclamables. */
export function rentableColors(
  player: RedactedPlayer,
  card: CardId,
): Color[] {
  const c = getCard(card);
  if (c.kind !== 'RENT') return [];
  const mine = new Set(player.groups.filter((g) => g.cards.length > 0).map((g) => g.color));
  return c.colors.filter((color) => mine.has(color));
}

export function opponentsOfView(
  state: RedactedState,
  viewerId: string,
): RedactedPlayer[] {
  return state.players.filter((p) => p.id !== viewerId);
}

/** La cible que le moteur attend de moi, s'il en attend une. */
export function myPendingTarget(state: RedactedState, me: string) {
  return state.pending?.targets.find(
    (t) => t.playerId === me && t.status === 'AWAITING_PAYMENT',
  );
}

/** L'action à laquelle je dois répondre (Refus ou acceptation). */
export function myResponse(state: RedactedState, me: string) {
  return state.pending?.targets.find(
    (t) => t.responderId === me && t.status === 'AWAITING_RESPONSE',
  );
}

export function handHasJustSayNo(player: RedactedPlayer): CardId | null {
  return player.hand.find(isJustSayNo) ?? null;
}
