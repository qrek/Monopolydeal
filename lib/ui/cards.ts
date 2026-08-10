/**
 * Textes portés par les cartes. Ils vivent côté UI et non dans le moteur :
 * ce sont des formulations, pas des règles — le moteur reste la seule autorité
 * sur ce qui est jouable.
 */

import {
  ACTIONS,
  BIRTHDAY_AMOUNT,
  COLORS,
  DEBT_COLLECTOR_AMOUNT,
  HOTEL_RENT_BONUS,
  HOUSE_RENT_BONUS,
  PASS_GO_DRAW,
  type ActionKind,
  type Color,
} from '@/lib/engine';

/**
 * L'effet d'une carte action, dit dans le registre d'une échelle de loyers :
 * un libellé à gauche, un chiffre à droite, et la condition sur une ligne
 * effacée dessous. C'est ce qui permet aux actions de partager la grammaire des
 * titres de propriété au lieu d'être une famille à part.
 *
 * Les montants viennent des constantes du moteur : un texte qui les recopierait
 * finirait par mentir le jour où une règle bouge.
 */
export interface ActionEffect {
  label: string;
  value: string;
  /** Condition d'usage, imprimée en retrait. */
  note?: string;
}

export const ACTION_EFFECTS: Record<ActionKind, ActionEffect> = {
  DEAL_BREAKER: { label: 'Tu prends', value: '1 lot complet', note: 'Constructions comprises' },
  SLY_DEAL: { label: 'Tu prends', value: '1 propriété', note: 'Hors lot complet' },
  FORCED_DEAL: { label: 'Tu échanges', value: '1 contre 1', note: 'Hors lot complet' },
  DEBT_COLLECTOR: {
    label: 'Tu réclames',
    value: `${DEBT_COLLECTOR_AMOUNT} M`,
    note: 'À un seul joueur',
  },
  BIRTHDAY: {
    label: 'Chacun te donne',
    value: `${BIRTHDAY_AMOUNT} M`,
    note: 'Tous les joueurs',
  },
  PASS_GO: {
    label: 'Tu pioches',
    value: `${PASS_GO_DRAW} cartes`,
    note: 'Sans cibler personne',
  },
  HOUSE: {
    label: 'Loyer du lot',
    value: `+${HOUSE_RENT_BONUS} M`,
    note: 'Sur un lot complet',
  },
  HOTEL: {
    label: 'Loyer du lot',
    value: `+${HOTEL_RENT_BONUS} M`,
    note: 'Maison déjà posée',
  },
  JUST_SAY_NO: { label: 'Tu annules', value: '1 action', note: 'Un autre Refus la rétablit' },
  DOUBLE_RENT: { label: 'Loyer réclamé', value: '×2', note: 'Coûte une action de plus' },
};

/**
 * Comment se compte un lot. Écrire « 1 carte » sur une gare sonne faux, et
 * « 2 compagnies » se lit tout seul.
 */
export function unitOf(color: Color): { one: string; many: string } {
  if (color === 'black') return { one: 'gare', many: 'gares' };
  if (color === 'turquoise') return { one: 'compagnie', many: 'compagnies' };
  return { one: 'carte', many: 'cartes' };
}

/** Ce que fait la carte, tel qu'imprimé dessus. */
export const ACTION_RULES: Record<ActionKind, string> = {
  DEAL_BREAKER: 'Vole un lot complet à un adversaire, constructions comprises.',
  SLY_DEAL:
    'Vole une propriété à un adversaire. Pas celles d’un lot complet.',
  FORCED_DEAL:
    'Échange une de tes propriétés contre celle d’un adversaire. Aucune des deux ne doit être dans un lot complet.',
  DEBT_COLLECTOR: 'Réclame 5 M à l’adversaire de ton choix.',
  BIRTHDAY: 'Chaque adversaire te donne 2 M.',
  PASS_GO: 'Pioche 2 cartes.',
  HOUSE:
    'Sur un lot complet : +3 M de loyer. Ni Gares ni Compagnies.',
  HOTEL:
    'Sur un lot complet portant déjà une Maison : +4 M de loyer.',
  JUST_SAY_NO:
    'Annule une action jouée contre toi. Un autre Refus peut la rétablir.',
  DOUBLE_RENT:
    'Double le loyer que tu réclames. Compte pour une action de plus.',
};

/** Sous-titre d'une carte Loyer, selon qu'elle est bicolore ou universelle. */
export function rentRule(universal: boolean, colors: Color[]): string {
  if (universal) {
    return 'Réclame le loyer de la couleur de ton choix à UN seul adversaire.';
  }
  const [a, b] = colors;
  const names =
    a && b ? `${COLORS[a].label} ou ${COLORS[b].label}` : 'de ces couleurs';
  return `Réclame à tous les adversaires le loyer d’un de tes lots ${names}.`;
}

export function actionLabel(kind: ActionKind): string {
  return ACTIONS[kind].label;
}

/**
 * Couleur de billet par valeur faciale. Le Monopoly donne une teinte à chaque
 * coupure ; on fait pareil pour que la banque se lise sans compter.
 */
export const MONEY_HUES: Record<number, string> = {
  1: '#F1E7C4',
  2: '#CDE6A5',
  3: '#A9DCC6',
  4: '#A9C8E8',
  5: '#C9B2DC',
  10: '#F4B183',
};

export function moneyHue(value: number): string {
  return MONEY_HUES[value] ?? '#F1E7C4';
}
