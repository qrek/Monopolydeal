/**
 * Textes portés par les cartes. Ils vivent côté UI et non dans le moteur :
 * ce sont des formulations, pas des règles — le moteur reste la seule autorité
 * sur ce qui est jouable.
 */

import { ACTIONS, COLORS, type ActionKind, type Color } from '@/lib/engine';

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
