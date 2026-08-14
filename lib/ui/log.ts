/**
 * Mise en mots du journal de partie. `state.events` est un log append-only du
 * moteur ; ce module le traduit en phrases, sans jamais rien recalculer.
 */

import { ACTIONS, getCard } from '@/lib/engine';
import type { Color, GameEvent, PendingKind } from '@/lib/engine';
import { COLORS } from '@/lib/engine';

/** Colore la ligne du journal : ce qu'on gagne, ce qu'on perd, ce qui frappe. */
export type LogTone = 'neutral' | 'gain' | 'loss' | 'strong';

export interface LogLine {
  seq: number;
  text: string;
  tone: LogTone;
}

/** `ACTION_PLAYED.kind` couvre les actions ciblées, le loyer et Passe départ. */
function actionLabel(kind: PendingKind | 'PASS_GO'): string {
  if (kind === 'RENT') return 'Loyer';
  return ACTIONS[kind].label;
}

function colorLabel(color: Color): string {
  return COLORS[color].label;
}

function cardLabel(id: string): string {
  return getCard(id).label;
}

function list(ids: string[]): string {
  return ids.map(cardLabel).join(', ');
}

/**
 * `nameOf` résout un id de joueur ; on passe par une fonction pour que l'appelant
 * reste libre de dire « toi » plutôt que le pseudo.
 */
export function describeEvent(
  e: GameEvent,
  nameOf: (id: string) => string,
): LogLine {
  const line = (text: string, tone: LogTone = 'neutral'): LogLine => ({
    seq: e.seq,
    text,
    tone,
  });

  switch (e.t) {
    case 'GAME_STARTED':
      return line(`La partie commence — ${e.playerIds.length} joueurs.`, 'strong');
    case 'TURN_STARTED':
      return line(`Au tour de ${nameOf(e.playerId)}.`, 'strong');
    case 'TURN_ENDED':
      return line(`${nameOf(e.playerId)} termine son tour.`);
    case 'DREW':
      return line(`${nameOf(e.playerId)} pioche ${e.count} carte${e.count > 1 ? 's' : ''}.`);
    case 'DECK_RESHUFFLED':
      return line(`La défausse est remélangée (${e.count} cartes).`);
    case 'BANKED':
      return line(`${nameOf(e.playerId)} met ${cardLabel(e.cardId)} en banque.`);
    case 'PROPERTY_PLACED':
      return line(
        `${nameOf(e.playerId)} pose ${cardLabel(e.cardId)} en ${colorLabel(e.color)}.`,
      );
    case 'WILD_MOVED':
      return line(
        `${nameOf(e.playerId)} déplace son joker vers ${colorLabel(e.color)}.`,
      );
    case 'BUILDING_PLACED':
      return line(
        `${nameOf(e.playerId)} construit ${e.building === 'HOUSE' ? 'une maison' : 'un hôtel'}.`,
        'gain',
      );
    case 'BUILDING_RETURNED':
      return line(
        `${cardLabel(e.cardId)} retourne en banque : le lot n’est plus complet.`,
        'loss',
      );
    case 'ACTION_PLAYED': {
      const who = nameOf(e.playerId);
      const what = actionLabel(e.kind);
      if (e.kind === 'PASS_GO') return line(`${who} joue ${what}.`);
      const targets = e.targetIds.map(nameOf).join(', ');
      if (e.kind === 'RENT') {
        return line(
          `${who} réclame un loyer ${e.color ? colorLabel(e.color) : ''} de ${e.amount}M à ${targets}.`.replace(
            /\s+/g,
            ' ',
          ),
          'strong',
        );
      }
      return line(`${who} joue ${what} contre ${targets}.`, 'strong');
    }
    case 'JUST_SAY_NO':
      return line(
        `${nameOf(e.playerId)} oppose un Refus catégorique à ${nameOf(e.againstId)} !`,
        'strong',
      );
    case 'REFLECTED':
      return line(
        `${nameOf(e.playerId)} renvoie la demande de ${e.amount}M à ${nameOf(e.againstId)} !`,
        'strong',
      );
    case 'FINED':
      return line(
        `${nameOf(e.targetId)} écope d’une Contravention : ${e.actions} action de moins au prochain tour.`,
        'loss',
      );
    case 'ACTION_CANCELLED':
      return line(`L’action contre ${nameOf(e.targetId)} est annulée.`, 'gain');
    case 'DEBT_CREATED':
      return line(
        `${nameOf(e.fromId)} doit ${e.amount}M à ${nameOf(e.toId)}.`,
        'loss',
      );
    case 'PAID':
      return line(
        `${nameOf(e.fromId)} paie ${e.amount}M à ${nameOf(e.toId)} (${list(e.cardIds)}).`,
        'loss',
      );
    case 'DEBT_FORGIVEN':
      return line(
        `${nameOf(e.fromId)} n’a plus rien à donner : ${nameOf(e.toId)} passe la main.`,
      );
    case 'CARDS_STOLEN':
      return line(
        `${nameOf(e.toId)} vole ${list(e.cardIds)} à ${nameOf(e.fromId)}.`,
        'loss',
      );
    case 'CARDS_SWAPPED':
      return line(
        `${nameOf(e.aId)} échange ${cardLabel(e.aCardId)} contre ${cardLabel(e.bCardId)} de ${nameOf(e.bId)}.`,
      );
    case 'DISCARDED':
      return line(`${nameOf(e.playerId)} défausse ${e.cardIds.length} carte${e.cardIds.length > 1 ? 's' : ''}.`);
    case 'GAME_OVER':
      return line(`${nameOf(e.winnerId)} remporte la partie !`, 'strong');
    case 'CONNECTION':
      return line(
        `${nameOf(e.playerId)} ${e.connected ? 'est de retour' : 'a quitté la table'}.`,
      );
  }
}
