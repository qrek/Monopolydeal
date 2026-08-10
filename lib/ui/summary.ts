/**
 * Résumé de fin de partie, calculé à partir du journal complet.
 *
 * Fonction pure et sans React : c'est la seule façon de la tester, et c'est ce
 * qui compte ici — un classement faux ou un total qui ne tombe pas juste se
 * verrait immédiatement, à un moment où plus personne ne peut le corriger.
 *
 * Le journal n'est tronqué que pendant la partie (la table n'en montre que la
 * fin) ; une fois terminée, le serveur l'envoie entier.
 */

import {
  COLORS,
  SETS_TO_WIN,
  bankTotal,
  completeColors,
  getCard,
  type Color,
  type GameEvent,
  type RedactedPlayer,
} from '@/lib/engine';

export interface PlayerSummary {
  id: string;
  name: string;
  /** Lots complets — c'est le classement du jeu. */
  sets: number;
  /** Couleurs des lots complets, pour les montrer. */
  setColors: Color[];
  /** Cartes propriété posées, jokers compris. */
  properties: number;
  /** Valeur en banque. */
  bank: number;
  /** Banque + valeur faciale des propriétés : la fortune sur la table. */
  worth: number;
  winner: boolean;
}

export interface Highlight {
  /** Libellé du fait. */
  label: string;
  /** Valeur mise en avant. */
  value: string;
  /** Joueur concerné, s'il y en a un. */
  who?: string;
}

export interface GameSummaryData {
  players: PlayerSummary[];
  winnerId: string | null;
  /** Nombre de tours joués, tous joueurs confondus. */
  turns: number;
  highlights: Highlight[];
}

function propertyValue(p: RedactedPlayer): number {
  let total = 0;
  for (const g of p.groups) {
    for (const id of g.cards) total += getCard(id).value;
    if (g.house) total += getCard(g.house).value;
    if (g.hotel) total += getCard(g.hotel).value;
  }
  return total;
}

function propertyCount(p: RedactedPlayer): number {
  return p.groups.reduce((n, g) => n + g.cards.length, 0);
}

/** Le plus haut score d'un compteur, avec le nom du joueur qui le détient. */
function top(
  counts: Map<string, number>,
  nameOf: (id: string) => string,
): { who: string; value: number } | null {
  let bestId: string | null = null;
  let best = 0;
  for (const [id, n] of counts) {
    if (n > best) {
      best = n;
      bestId = id;
    }
  }
  return bestId ? { who: nameOf(bestId), value: best } : null;
}

function bump(counts: Map<string, number>, id: string, by = 1): void {
  counts.set(id, (counts.get(id) ?? 0) + by);
}

export function summarize(
  players: RedactedPlayer[],
  events: GameEvent[],
  winnerId: string | null,
): GameSummaryData {
  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? 'Joueur';

  const ranked: PlayerSummary[] = players
    .map((p) => {
      const setColors = completeColors(p);
      const bank = bankTotal(p);
      return {
        id: p.id,
        name: p.name,
        sets: setColors.length,
        setColors,
        properties: propertyCount(p),
        bank,
        worth: bank + propertyValue(p),
        winner: p.id === winnerId,
      };
    })
    // Le vainqueur d'abord, puis les lots complets, puis la fortune : c'est
    // l'ordre dans lequel on regarde un plateau en fin de partie.
    .sort(
      (a, b) =>
        Number(b.winner) - Number(a.winner) ||
        b.sets - a.sets ||
        b.worth - a.worth ||
        b.properties - a.properties,
    );

  // --- Faits marquants -------------------------------------------------------
  const paid = new Map<string, number>();
  const collected = new Map<string, number>();
  const stolen = new Map<string, number>();
  const refused = new Map<string, number>();
  const actions = new Map<string, number>();
  let biggest: { amount: number; from: string; to: string } | null = null;
  let turns = 0;
  let reshuffles = 0;

  for (const e of events) {
    switch (e.t) {
      case 'TURN_ENDED':
        turns++;
        break;
      case 'DECK_RESHUFFLED':
        reshuffles++;
        break;
      case 'PAID':
        bump(paid, e.fromId, e.amount);
        bump(collected, e.toId, e.amount);
        if (!biggest || e.amount > biggest.amount) {
          biggest = { amount: e.amount, from: nameOf(e.fromId), to: nameOf(e.toId) };
        }
        break;
      case 'CARDS_STOLEN':
        bump(stolen, e.toId, e.cardIds.length);
        break;
      case 'JUST_SAY_NO':
        bump(refused, e.playerId);
        break;
      case 'ACTION_PLAYED':
        bump(actions, e.playerId);
        break;
      default:
        break;
    }
  }

  const highlights: Highlight[] = [];
  highlights.push({ label: 'Tours joués', value: String(turns) });

  const encaisse = top(collected, nameOf);
  if (encaisse) {
    highlights.push({ label: 'A le plus encaissé', value: `${encaisse.value} M`, who: encaisse.who });
  }
  const verse = top(paid, nameOf);
  if (verse) {
    highlights.push({ label: 'A le plus versé', value: `${verse.value} M`, who: verse.who });
  }
  const vol = top(stolen, nameOf);
  if (vol) {
    highlights.push({
      label: 'A le plus volé',
      value: `${vol.value} carte${vol.value > 1 ? 's' : ''}`,
      who: vol.who,
    });
  }
  if (biggest) {
    highlights.push({
      label: 'Plus gros paiement',
      value: `${biggest.amount} M`,
      who: `${biggest.from} → ${biggest.to}`,
    });
  }
  const non = top(refused, nameOf);
  if (non) {
    highlights.push({
      label: 'Refus opposés',
      value: String(non.value),
      who: non.who,
    });
  }
  const joue = top(actions, nameOf);
  if (joue) {
    highlights.push({ label: 'Actions jouées', value: String(joue.value), who: joue.who });
  }
  if (reshuffles > 0) {
    highlights.push({
      label: 'Pioche remélangée',
      value: `${reshuffles} fois`,
    });
  }

  return { players: ranked, winnerId, turns, highlights };
}

/** Libellé d'un lot complet, pour l'afficher en toutes lettres. */
export function setLabel(color: Color): string {
  return COLORS[color].label;
}

export { SETS_TO_WIN };
