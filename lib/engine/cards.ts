/**
 * Définition du deck complet et des tables de référence.
 *
 * 106 cartes : 20 argent + 28 propriétés + 11 jokers + 34 actions + 13 loyers.
 * `DECK_COMPOSITION` est la source de vérité unique ; un test verrouille la
 * composition exacte.
 */

import type {
  ActionKind,
  Card,
  CardId,
  Color,
  GameMode,
  PropertyGroup,
} from './types.ts';

// ---------------------------------------------------------------------------
// Couleurs
// ---------------------------------------------------------------------------

export interface ColorConfig {
  /** Nombre de cartes nécessaires pour un lot complet. */
  size: number;
  /** Loyer indexé sur le nombre de cartes possédées : rents[n - 1]. */
  rents: number[];
  /** Valeur banque d'une carte de cette couleur. */
  value: number;
  label: string;
  /** Aplat principal, utilisé par l'UI (CSS/SVG, aucune image externe). */
  hex: string;
  /** Les lots Noir et Turquoise n'acceptent ni Maison ni Hôtel. */
  buildable: boolean;
}

/**
 * Les aplats sont ceux du plateau Monopoly, pas une palette maison : c'est à
 * la couleur qu'on reconnaît un lot d'un coup d'œil, et un joueur qui connaît
 * le jeu de plateau doit retrouver ses repères sans réapprendre.
 */
export const COLORS: Record<Color, ColorConfig> = {
  brown: { size: 2, rents: [1, 2], value: 1, label: 'Marron', hex: '#955436', buildable: true },
  lightblue: { size: 3, rents: [1, 2, 3], value: 1, label: 'Bleu ciel', hex: '#AAE0FA', buildable: true },
  pink: { size: 3, rents: [1, 2, 4], value: 2, label: 'Rose', hex: '#D93A96', buildable: true },
  orange: { size: 3, rents: [1, 3, 5], value: 2, label: 'Orange', hex: '#F7941D', buildable: true },
  red: { size: 3, rents: [2, 3, 6], value: 3, label: 'Rouge', hex: '#ED1B24', buildable: true },
  yellow: { size: 3, rents: [2, 4, 6], value: 3, label: 'Jaune', hex: '#FEF200', buildable: true },
  green: { size: 3, rents: [2, 4, 7], value: 4, label: 'Vert', hex: '#1FB25A', buildable: true },
  darkblue: { size: 2, rents: [3, 8], value: 4, label: 'Bleu nuit', hex: '#0072BB', buildable: true },
  black: { size: 4, rents: [1, 2, 3, 4], value: 2, label: 'Gares', hex: '#1A1A1A', buildable: false },
  turquoise: { size: 2, rents: [1, 2], value: 2, label: 'Compagnies', hex: '#8FD4A8', buildable: false },
  // Trois cartes seulement pour le loyer le plus élevé du jeu : le lot court
  // et cher, celui qu'on peut réunir vite et perdre d'un coup.
  airport: { size: 3, rents: [2, 4, 7], value: 4, label: 'Aéroports', hex: '#4E7A8A', buildable: false },
  // Quatre cartes pour un loyer moyen : le lot du patient, qu'on complète
  // pendant que les autres se battent ailleurs.
  metro: { size: 4, rents: [1, 2, 3, 5], value: 2, label: 'Métro', hex: '#6D4C9F', buildable: false },
};

export const ALL_COLORS: Color[] = Object.keys(COLORS) as Color[];

/** Bonus de loyer apporté par les constructions, sur lot complet uniquement. */
export const HOUSE_RENT_BONUS = 3;
export const HOTEL_RENT_BONUS = 4;

// ---------------------------------------------------------------------------
// Noms de rues (plateau français) — 28 propriétés
// ---------------------------------------------------------------------------

const PROPERTY_NAMES: Record<Color, string[]> = {
  brown: ['Boulevard de Belleville', 'Rue Lecourbe'],
  lightblue: ['Rue de Vaugirard', 'Rue de Courcelles', 'Avenue de la République'],
  pink: ['Boulevard de la Villette', 'Avenue de Neuilly', 'Rue de Paradis'],
  orange: ['Avenue Mozart', 'Boulevard Saint-Michel', 'Place Pigalle'],
  red: ['Avenue Matignon', 'Boulevard Malesherbes', 'Avenue Henri-Martin'],
  yellow: ['Faubourg Saint-Honoré', 'Place de la Bourse', 'Rue La Fayette'],
  green: ['Avenue de Breteuil', 'Avenue Foch', 'Boulevard des Capucines'],
  darkblue: ['Avenue des Champs-Élysées', 'Rue de la Paix'],
  black: ['Gare Montparnasse', 'Gare de Lyon', 'Gare du Nord', 'Gare Saint-Lazare'],
  turquoise: ['Compagnie de distribution des eaux', 'Compagnie d’électricité'],
  airport: ['Roissy — Charles-de-Gaulle', 'Orly', 'Beauvais-Tillé'],
  metro: ['Ligne 1', 'Ligne 4', 'Ligne 6', 'Ligne 14'],
};

// ---------------------------------------------------------------------------
// Actions & loyers
// ---------------------------------------------------------------------------

export interface ActionConfig {
  qty: number;
  value: number;
  label: string;
  /** Une action « ciblée » ouvre une fenêtre de Refus catégorique. */
  targeted: boolean;
}

export const ACTIONS: Record<ActionKind, ActionConfig> = {
  DEAL_BREAKER: { qty: 2, value: 5, label: 'Coup de filet', targeted: true },
  SLY_DEAL: { qty: 3, value: 3, label: 'Affaire douteuse', targeted: true },
  FORCED_DEAL: { qty: 3, value: 3, label: 'Échange forcé', targeted: true },
  DEBT_COLLECTOR: { qty: 3, value: 3, label: 'Recouvrement', targeted: true },
  BIRTHDAY: { qty: 3, value: 2, label: 'Anniversaire', targeted: true },
  PASS_GO: { qty: 10, value: 1, label: 'Passe départ', targeted: false },
  HOUSE: { qty: 3, value: 3, label: 'Maison', targeted: false },
  HOTEL: { qty: 2, value: 4, label: 'Hôtel', targeted: false },
  JUST_SAY_NO: { qty: 3, value: 4, label: 'Refus catégorique', targeted: false },
  DOUBLE_RENT: { qty: 2, value: 1, label: 'Double loyer', targeted: false },
  REFLECT: { qty: 2, value: 3, label: 'Renvoi', targeted: false },
  FINE: { qty: 2, value: 2, label: 'Contravention', targeted: true },
  RATP_CHECK: { qty: 2, value: 3, label: 'Contrôle RATP', targeted: true },
  TAIL: { qty: 1, value: 4, label: 'Filature', targeted: true },
};

/**
 * Actions réservées aux modes étendus. Le tête-à-tête a besoin de coups qui se
 * rendent — une partie à deux où l'on ne peut que subir se joue en apnée — mais
 * ces quatre-là n'ont pas de sens à cinq : un renvoi ne sait pas qui viser, et
 * un contrôle du meneur devient un vote à plusieurs.
 */
const EXTENDED_ACTIONS: ReadonlySet<ActionKind> = new Set([
  'REFLECT',
  'FINE',
  'RATP_CHECK',
  'TAIL',
]);

/** Montant réclamé par Recouvrement. */
export const DEBT_COLLECTOR_AMOUNT = 5;
/** Montant réclamé au meneur par un Contrôle RATP. */
export const RATP_CHECK_AMOUNT = 5;
/** Actions retirées au prochain tour de celui qui prend une Contravention. */
export const FINE_PENALTY = 1;
/** Un tour garde toujours au moins une action : sinon on le regarde passer. */
export const MIN_ACTIONS_PER_TURN = 1;
/** Montant réclamé par Anniversaire, à chaque adversaire. */
export const BIRTHDAY_AMOUNT = 2;
/** Cartes piochées par Passe départ. */
export const PASS_GO_DRAW = 2;

const MONEY_COMPOSITION: Array<[value: number, qty: number]> = [
  [1, 6],
  [2, 5],
  [3, 3],
  [4, 3],
  [5, 2],
  [10, 1],
];

const WILD_COMPOSITION: Array<[colors: [Color, Color], qty: number]> = [
  [['lightblue', 'brown'], 1],
  [['lightblue', 'black'], 1],
  [['black', 'green'], 1],
  [['black', 'turquoise'], 1],
  [['orange', 'pink'], 2],
  [['red', 'yellow'], 2],
  [['green', 'darkblue'], 1],
  // Réservé aux modes étendus : les deux familles de transports modernes.
  [['metro', 'airport'], 1],
];

const WILD_ANY_QTY = 2;

const RENT_PAIRS: Array<[Color, Color]> = [
  ['brown', 'lightblue'],
  ['pink', 'orange'],
  ['red', 'yellow'],
  ['green', 'darkblue'],
  ['black', 'turquoise'],
  ['metro', 'airport'],
];

const RENT_PAIR_QTY = 2;
const RENT_UNIVERSAL_QTY = 3;
const RENT_PAIR_VALUE = 1;
const RENT_UNIVERSAL_VALUE = 3;

// ---------------------------------------------------------------------------
// Construction du deck
// ---------------------------------------------------------------------------

function buildDeck(): Card[] {
  const cards: Card[] = [];

  for (const [value, qty] of MONEY_COMPOSITION) {
    for (let i = 0; i < qty; i++) {
      cards.push({
        id: `money-${value}-${i}`,
        kind: 'MONEY',
        value,
        label: `${value}M`,
      });
    }
  }

  for (const color of ALL_COLORS) {
    const names = PROPERTY_NAMES[color];
    names.forEach((name, i) => {
      cards.push({
        id: `prop-${color}-${i}`,
        kind: 'PROPERTY',
        value: COLORS[color].value,
        label: name,
        color,
      });
    });
  }

  for (const [colors, qty] of WILD_COMPOSITION) {
    for (let i = 0; i < qty; i++) {
      cards.push({
        id: `wild-${colors[0]}_${colors[1]}-${i}`,
        kind: 'WILD',
        // Un joker bicolore vaut la valeur banque de la plus chère de ses couleurs.
        value: Math.max(COLORS[colors[0]].value, COLORS[colors[1]].value),
        label: `Joker ${COLORS[colors[0]].label} / ${COLORS[colors[1]].label}`,
        colors,
      });
    }
  }

  for (let i = 0; i < WILD_ANY_QTY; i++) {
    cards.push({
      id: `wildany-${i}`,
      kind: 'WILD_ANY',
      value: 0,
      label: 'Joker universel',
    });
  }

  for (const kind of Object.keys(ACTIONS) as ActionKind[]) {
    const cfg = ACTIONS[kind];
    for (let i = 0; i < cfg.qty; i++) {
      cards.push({
        id: `act-${kind.toLowerCase()}-${i}`,
        kind: 'ACTION',
        value: cfg.value,
        label: cfg.label,
        action: kind,
      });
    }
  }

  for (const pair of RENT_PAIRS) {
    for (let i = 0; i < RENT_PAIR_QTY; i++) {
      cards.push({
        id: `rent-${pair[0]}_${pair[1]}-${i}`,
        kind: 'RENT',
        value: RENT_PAIR_VALUE,
        label: `Loyer ${COLORS[pair[0]].label} / ${COLORS[pair[1]].label}`,
        colors: [...pair],
        universal: false,
      });
    }
  }

  for (let i = 0; i < RENT_UNIVERSAL_QTY; i++) {
    cards.push({
      id: `rent-universal-${i}`,
      kind: 'RENT',
      value: RENT_UNIVERSAL_VALUE,
      label: 'Loyer universel',
      colors: [...ALL_COLORS],
      universal: true,
    });
  }

  return cards;
}

/**
 * Le catalogue : toutes les cartes de tous les modes. Un deck de partie n'en
 * distribue qu'un sous-ensemble, mais `getCard` doit connaître les autres —
 * une carte reste lisible dans un journal ou un résumé même si le mode courant
 * ne la joue pas.
 */
const CATALOGUE: readonly Card[] = Object.freeze(buildDeck());

/** Familles réservées aux modes étendus. */
const EXTENDED: readonly Color[] = ['airport', 'metro'];

function isExtended(card: Card): boolean {
  if (card.kind === 'ACTION') return EXTENDED_ACTIONS.has(card.action);
  if (card.kind === 'PROPERTY') return EXTENDED.includes(card.color);
  if (card.kind === 'WILD') return card.colors.some((c) => EXTENDED.includes(c));
  // Le loyer universel couvre toutes les couleurs par définition : il reste
  // dans le deck classique, où il ne pourra simplement viser aucune des deux.
  if (card.kind === 'RENT' && !card.universal) {
    return card.colors.some((c) => EXTENDED.includes(c));
  }
  return false;
}

/** Composition d'un deck de partie, selon le mode. */
export function deckFor(mode: GameMode): readonly Card[] {
  if (mode === 'CLASSIC') return CATALOGUE.filter((c) => !isExtended(c));
  return CATALOGUE;
}

/** Les couleurs réellement distribuées dans ce mode. */
export function colorsFor(mode: GameMode): Color[] {
  return mode === 'CLASSIC'
    ? ALL_COLORS.filter((c) => !EXTENDED.includes(c))
    : [...ALL_COLORS];
}

/** Le deck classique, tel que verrouillé par les tests de composition. */
export const DECK_COMPOSITION: readonly Card[] = Object.freeze(deckFor('CLASSIC'));

export const CARDS: Readonly<Record<CardId, Card>> = Object.freeze(
  Object.fromEntries(CATALOGUE.map((c) => [c.id, c])),
);

export function getCard(id: CardId): Card {
  const card = CARDS[id];
  if (!card) throw new Error(`Carte inconnue : ${id}`);
  return card;
}

/** Ids du deck neuf, dans l'ordre canonique (avant mélange). */
export function freshDeckIds(mode: GameMode = 'CLASSIC'): CardId[] {
  return deckFor(mode).map((c) => c.id);
}

// ---------------------------------------------------------------------------
// Prédicats de cartes
// ---------------------------------------------------------------------------

export function isPropertyLike(id: CardId): boolean {
  const k = getCard(id).kind;
  return k === 'PROPERTY' || k === 'WILD' || k === 'WILD_ANY';
}

/** Couleurs qu'une carte peut prendre dans un lot. */
export function possibleColors(id: CardId): Color[] {
  const card = getCard(id);
  if (card.kind === 'PROPERTY') return [card.color];
  if (card.kind === 'WILD') return [...card.colors];
  if (card.kind === 'WILD_ANY') return [...ALL_COLORS];
  return [];
}

export function isActionOf(id: CardId, kind: ActionKind): boolean {
  const card = getCard(id);
  return card.kind === 'ACTION' && card.action === kind;
}

/** Les jokers universels ne peuvent jamais être posés en banque. */
export function canBank(id: CardId): boolean {
  return getCard(id).kind !== 'WILD_ANY';
}

// ---------------------------------------------------------------------------
// Lots
// ---------------------------------------------------------------------------

export function groupSize(group: PropertyGroup): number {
  return COLORS[group.color].size;
}

/**
 * Un lot est complet quand il atteint la taille de sa couleur.
 * Règle maison : un lot composé *uniquement* de jokers universels ne compte pas
 * comme un lot — il faut au moins une carte réellement colorée.
 */
export function isGroupComplete(group: PropertyGroup): boolean {
  if (group.cards.length < COLORS[group.color].size) return false;
  return group.cards.some((id) => getCard(id).kind !== 'WILD_ANY');
}

/** Loyer réclamable pour ce lot, constructions comprises. */
export function groupRent(group: PropertyGroup): number {
  const cfg = COLORS[group.color];
  const n = Math.min(group.cards.length, cfg.size);
  if (n === 0) return 0;
  let rent = cfg.rents[n - 1] ?? 0;
  if (isGroupComplete(group)) {
    if (group.house) rent += HOUSE_RENT_BONUS;
    if (group.hotel) rent += HOTEL_RENT_BONUS;
  }
  return rent;
}
