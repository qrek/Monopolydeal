/**
 * L'aide-mémoire des règles, tel qu'il s'affiche en cours de partie.
 *
 * Tous les nombres viennent des constantes du moteur. C'est la seule façon
 * qu'un aide-mémoire reste vrai : recopié à la main, il ment le jour où une
 * règle bouge, et un joueur qui ouvre les règles pour lever un doute repart
 * avec une certitude fausse — pire que pas de règles du tout.
 */

import {
  ACTIONS,
  ALL_COLORS,
  COLORS,
  EMPTY_HAND_DRAW,
  HAND_LIMIT,
  MAX_ACTIONS_PER_TURN,
  MAX_JSN_CHAIN,
  MAX_PLAYERS,
  MIN_PLAYERS,
  SETS_TO_WIN,
  STARTING_HAND,
  TURN_DRAW,
  type ActionKind,
  type Color,
} from '@/lib/engine';

import { ACTION_RULES, unitOf } from './cards';

export interface RuleEntry {
  /** Court, impératif : c'est lui qu'on relit en diagonale. */
  term: string;
  detail: string;
}

export interface RuleChapter {
  id: string;
  title: string;
  /** Une phrase qui résume le chapitre avant le détail. */
  lede?: string;
  entries: RuleEntry[];
}

/** Ligne du tableau des loyers : une couleur, sa taille, son échelle. */
export interface RentRow {
  color: Color;
  label: string;
  size: number;
  /** Loyer indexé sur le nombre de cartes possédées. */
  rents: number[];
  value: number;
  buildable: boolean;
}

export const RENT_TABLE: RentRow[] = ALL_COLORS.map((color) => ({
  color,
  label: COLORS[color].label,
  size: COLORS[color].size,
  rents: [...COLORS[color].rents],
  value: COLORS[color].value,
  buildable: COLORS[color].buildable,
}));

export interface ActionRow {
  kind: ActionKind;
  label: string;
  value: number;
  qty: number;
  rule: string;
}

export const ACTION_TABLE: ActionRow[] = (
  Object.keys(ACTIONS) as ActionKind[]
).map((kind) => ({
  kind,
  label: ACTIONS[kind].label,
  value: ACTIONS[kind].value,
  qty: ACTIONS[kind].qty,
  rule: ACTION_RULES[kind],
}));

/** Le plus gros lot du jeu, cité tel quel dans le chapitre des loyers. */
const BIGGEST = RENT_TABLE.reduce((a, b) => (b.size > a.size ? b : a));

export const CHAPTERS: RuleChapter[] = [
  {
    id: 'but',
    title: 'Le but',
    lede: `Réunir ${SETS_TO_WIN} lots complets de trois couleurs différentes. C'est tout — l'argent ne fait pas gagner, il sert à payer.`,
    entries: [
      {
        term: 'Lot complet',
        detail: `Toutes les cartes d'une couleur posées devant toi : ${RENT_TABLE.filter(
          (r) => r.size === 2,
        )
          .map((r) => r.label)
          .join(', ')} en ${2} cartes, ${BIGGEST.label} en ${BIGGEST.size}, les autres en 3.`,
      },
      {
        term: 'Trois couleurs',
        detail: `Trois lots de la même couleur ne comptent que pour un. Il faut ${SETS_TO_WIN} couleurs distinctes.`,
      },
      {
        term: 'Victoire immédiate',
        detail:
          'La partie s’arrête à l’instant où le troisième lot est complet — y compris pendant le tour d’un autre joueur, si c’est un paiement qui te l’a apporté.',
      },
    ],
  },
  {
    id: 'tour',
    title: 'Ton tour',
    lede: `Pioche, puis joue jusqu'à ${MAX_ACTIONS_PER_TURN} cartes. Rien ne t'oblige à les jouer.`,
    entries: [
      {
        term: 'Pioche',
        detail: `${TURN_DRAW} cartes en début de tour — ${EMPTY_HAND_DRAW} si tu commences le tour la main vide.`,
      },
      {
        term: `${MAX_ACTIONS_PER_TURN} cartes`,
        detail:
          'Poser une propriété, mettre une carte en banque ou jouer une action : chacune compte pour une, quelle qu’elle soit.',
      },
      {
        term: 'Fin de tour',
        detail: `Au-delà de ${HAND_LIMIT} cartes en main, tu défausses le surplus. Si tu n'as plus rien à jouer, le tour passe tout seul.`,
      },
      {
        term: 'Déplacer un joker',
        detail:
          'Changer un joker déjà posé de lot est gratuit et ne compte pas dans tes cartes jouées. Sauf si le lot qu’il quitte porte une construction.',
      },
    ],
  },
  {
    id: 'carte',
    title: 'Les trois usages d’une carte',
    lede: 'Presque toutes les cartes ont plusieurs vies. C’est là que se joue la partie.',
    entries: [
      {
        term: 'En propriété',
        detail:
          'Devant toi, dans un lot de sa couleur. Elle rapporte des loyers et compte pour la victoire, mais on peut te la voler.',
      },
      {
        term: 'En banque',
        detail:
          'De côté, pour sa valeur en M. N’importe quelle carte peut y aller, action comprise — mais elle y perd son effet.',
      },
      {
        term: 'En action',
        detail:
          'Son effet, puis la défausse. Une carte action jouée est une carte de moins pour payer.',
      },
      {
        term: 'La main ne paie pas',
        detail:
          'On ne paie jamais avec ses cartes en main : uniquement avec sa banque, ses propriétés et ses constructions.',
      },
    ],
  },
  {
    id: 'jokers',
    title: 'Jokers',
    entries: [
      {
        term: 'Joker bicolore',
        detail:
          'Vaut l’une ou l’autre de ses deux couleurs. Tu choisis en le posant, et tu peux le changer de lot plus tard, gratuitement.',
      },
      {
        term: 'Joker universel',
        detail:
          'Prend n’importe quelle couleur. En revanche il ne vaut rien en banque et ne peut pas servir à payer.',
      },
    ],
  },
  {
    id: 'loyers',
    title: 'Loyers',
    lede: 'Le loyer se lit sur la carte : il dépend du nombre de cartes que tu possèdes dans la couleur, pas du lot complet.',
    entries: [
      {
        term: 'Quittance bicolore',
        detail:
          'Réclame le loyer d’une de ses deux couleurs à TOUS les adversaires, chacun le montant plein.',
      },
      {
        term: 'Quittance universelle',
        detail:
          'N’importe quelle couleur, mais un seul adversaire — celui que tu désignes.',
      },
      {
        term: 'Double loyer',
        detail: `Double le montant réclamé. Elle se joue avec une quittance et coûte une carte jouée de plus : loyer + double = 2 de tes ${MAX_ACTIONS_PER_TURN}.`,
      },
      {
        term: 'Maison et Hôtel',
        detail: `Se posent sur un lot complet et en augmentent le loyer. Ni sur les ${COLORS.black.label}, ni sur les ${COLORS.turquoise.label}. Si le lot se casse, la construction retourne dans ta banque.`,
      },
    ],
  },
  {
    id: 'payer',
    title: 'Payer',
    entries: [
      {
        term: 'Tu choisis',
        detail:
          'Avec quoi tu paies te regarde : billets, propriétés, constructions. C’est le total en M qui compte.',
      },
      {
        term: 'Pas de monnaie',
        detail:
          'Payer 5 M avec un billet de 10 ne rend rien. Mieux vaut prévoir de la petite monnaie.',
      },
      {
        term: 'Si tu ne peux pas',
        detail:
          'Tu donnes tout ce que tu as, et la dette s’éteint. Rien du tout à donner : tu ne dois rien.',
      },
      {
        term: 'Ce que tu reçois',
        detail:
          'Une propriété reçue en paiement se pose chez toi et peut compléter un lot — donc faire gagner la partie.',
      },
    ],
  },
  {
    id: 'refus',
    title: 'Refus catégorique',
    entries: [
      {
        term: 'Annule tout',
        detail:
          'Se joue hors de ton tour, contre une action jouée contre toi. Elle ne compte pas dans les cartes jouées.',
      },
      {
        term: 'La riposte',
        detail: `Un second Refus rétablit l'action. La chaîne s'arrête là : ${MAX_JSN_CHAIN} Refus au maximum sur une même action.`,
      },
      {
        term: 'Ce qu’il ne bloque pas',
        detail:
          'Rien de ce qui ne te vise pas : ni une pioche, ni une propriété posée, ni une carte mise en banque.',
      },
    ],
  },
  {
    id: 'table',
    title: 'La table',
    entries: [
      {
        term: 'Joueurs',
        detail: `De ${MIN_PLAYERS} à ${MAX_PLAYERS}. Chacun commence avec ${STARTING_HAND} cartes.`,
      },
      {
        term: 'Pioche vide',
        detail:
          'La défausse est mélangée et redevient la pioche. Une partie ne s’arrête jamais faute de cartes.',
      },
      {
        term: 'Appui long',
        detail:
          'Sur n’importe quelle carte, la tienne ou celle d’un adversaire, pour la voir en grand.',
      },
    ],
  },
];

/** Comment se compte un lot, pour l'en-tête du tableau des loyers. */
export function sizeLabel(row: RentRow): string {
  return `${row.size} ${unitOf(row.color).many}`;
}
