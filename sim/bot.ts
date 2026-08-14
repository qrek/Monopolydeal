/**
 * Bot glouton, écrit pour MESURER et non pour bien jouer.
 *
 * Il ne cherche pas la meilleure ligne : il applique une hiérarchie de
 * priorités qu'un joueur débutant appliquerait. C'est volontaire — ce qu'on
 * veut mesurer, ce sont les propriétés STRUCTURELLES du mode (durée, variance,
 * avantage du premier joueur, poids d'une carte), pas la profondeur
 * stratégique. Un bot plus fort déplacerait les chiffres, pas leur sens.
 */

import {
  COLORS,
  MAX_ACTIONS_PER_TURN,
  SETS_TO_WIN,
  bankTotal,
  canBank,
  createGame,
  completeColors,
  getCard,
  groupRent,
  isGroupComplete,
  isPropertyLike,
  payableCards,
  possibleColors,
  reduce,
  type CardId,
  type Color,
  type GameAction,
  type GameMode,
  type GameState,
  type PlayerState,
} from '../lib/engine/index.ts';

export interface Rules {
  /** Une quittance bicolore double son montant (variante duel). */
  rentDoubleInDuel: boolean;
  /** Le Coup de filet laisse une carte au choix de la victime. */
  softDealBreaker: boolean;
  /** Un seul Refus catégorique jouable par tour. */
  oneJsnPerTurn: boolean;
  /**
   * L'étal : on pioche parmi N cartes face visible au lieu du sommet aveugle.
   * Émulé en réordonnant le sommet de la pioche selon la préférence du
   * joueur — ce qui capture l'effet de SÉLECTION, pas l'effet d'information
   * (voir l'analyse : un bot glouton ne bluffe pas et ne prive personne).
   */
  market: number;
  /** Cartes supplémentaires données au SECOND joueur, en compensation. */
  secondPlayerBonus: number;
  /** Le premier joueur ne joue que 2 cartes à son premier tour. */
  firstTurnHandicap: boolean;
  /** Mode réellement passé au moteur : deck et compensation inclus. */
  mode: GameMode;
  /**
   * Retirer les quatre cartes du tête-à-tête avant de commencer. Sert à mesurer
   * ce qu'elles changent, à graines égales : sans ce témoin, on ne saurait pas
   * distinguer leur effet de celui du bot qui a appris à les jouer.
   */
  withoutExtras?: boolean;
}

export const BASE: Rules = {
  rentDoubleInDuel: false,
  softDealBreaker: false,
  oneJsnPerTurn: false,
  market: 0,
  secondPlayerBonus: 0,
  firstTurnHandicap: false,
  mode: 'CLASSIC',
};

export const DUEL: Rules = {
  rentDoubleInDuel: true,
  softDealBreaker: true,
  oneJsnPerTurn: true,
  market: 5,
  secondPlayerBonus: 0,
  firstTurnHandicap: false,
  mode: 'CLASSIC',
};

/** Compensations du second joueur, testées séparément. */
export const ONLY_BONUS1: Rules = { ...BASE, secondPlayerBonus: 1 };
export const ONLY_BONUS2: Rules = { ...BASE, secondPlayerBonus: 2 };
export const ONLY_HANDICAP: Rules = { ...BASE, firstTurnHandicap: true };
/** Le mode DUEL tel qu'il est réellement implémenté dans le moteur. */
export const DUEL_MOTEUR: Rules = { ...BASE, mode: 'DUEL' };

/** Balayage de la compensation sur le deck élargi. */
export const DUEL_B0: Rules = { ...BASE, mode: 'DUEL', secondPlayerBonus: 0 };
export const DUEL_B1: Rules = { ...BASE, mode: 'DUEL', secondPlayerBonus: 1 };
export const DUEL_B2: Rules = { ...BASE, mode: 'DUEL', secondPlayerBonus: 2 };
export const DUEL_B3: Rules = { ...BASE, mode: 'DUEL', secondPlayerBonus: 3 };

/** Le duel tel qu'il était avant les quatre cartes, pour comparaison. */
export const DUEL_SANS: Rules = { ...BASE, mode: 'DUEL', withoutExtras: true };
/** Le duel tel qu'il est maintenant. */
export const DUEL_AVEC: Rules = { ...BASE, mode: 'DUEL' };

/** Le duel corrigé : on garde ce qui marche, on jette ce qui nuit. */
export const DUEL_V2: Rules = {
  ...BASE,
  market: 5,
  softDealBreaker: true,
  secondPlayerBonus: 2,
};

/** Variantes isolées, pour savoir laquelle des quatre règles fait l'effet. */
export const ONLY_MARKET: Rules = { ...BASE, market: 5 };
export const ONLY_SOFT_DB: Rules = { ...BASE, softDealBreaker: true };
export const ONLY_RENT: Rules = { ...BASE, rentDoubleInDuel: true };
export const ONLY_JSN: Rules = { ...BASE, oneJsnPerTurn: true };

function opponent(s: GameState, me: string): PlayerState {
  const o = s.players.find((p) => p.id !== me);
  if (!o) throw new Error('pas d’adversaire');
  return o;
}

/** À combien de cartes ce lot est-il de sa complétion ? */
function missing(p: PlayerState, color: Color): number {
  const best = p.groups
    .filter((g) => g.color === color)
    .map((g) => COLORS[color].size - g.cards.length);
  return best.length ? Math.min(...best) : COLORS[color].size;
}

/** Valeur d'une propriété pour son propriétaire : ce qu'elle rapproche du but. */
function propertyWorth(p: PlayerState, id: CardId): number {
  const colors = possibleColors(id);
  let best = 0;
  for (const c of colors) {
    const m = missing(p, c);
    best = Math.max(best, m === 0 ? 1 : 10 - m * 2 + COLORS[c].rents[COLORS[c].size - 1]!);
  }
  return best;
}

/** Intérêt d'une carte pour ce joueur, tous usages confondus. */
function cardAppeal(p: PlayerState, id: CardId): number {
  const card = getCard(id);
  if (isPropertyLike(id)) return 10 + propertyWorth(p, id);
  if (card.kind === 'RENT') return 8;
  if (card.label === 'Coup de filet') return 9;
  if (card.label === 'Refus catégorique') return 7;
  if (card.label === 'Affaire douteuse') return 6;
  return card.value;
}

/** L'étal : les cartes que le joueur préfère remontent au sommet de la pioche. */
function restock(s: GameState, me: string, taille: number): GameState {
  if (s.deck.length < taille) return s;
  const p = s.players.find((x) => x.id === me)!;
  const d = structuredClone(s) as GameState;
  const etal = d.deck.slice(0, taille).sort((a, b) => cardAppeal(p, b) - cardAppeal(p, a));
  d.deck = [...etal, ...d.deck.slice(taille)];
  return d;
}

/**
 * Coup de filet adouci : la victime récupère la carte qui lui sert le plus.
 * Appliqué après coup — le moteur reste inchangé, on ne mesure qu'une règle.
 */
function giveBackOne(s: GameState, thief: string, victim: string, cards: CardId[]): GameState {
  const d = structuredClone(s) as GameState;
  const t = d.players.find((x) => x.id === thief)!;
  const v = d.players.find((x) => x.id === victim)!;
  const g = t.groups.find((x) => cards.every((c) => x.cards.includes(c)));
  if (!g || g.cards.length <= 1) return s;
  const keep = [...g.cards].sort((a, b) => propertyWorth(v, b) - propertyWorth(v, a))[0]!;
  g.cards = g.cards.filter((c) => c !== keep);
  const cible = v.groups.find(
    (x) => possibleColors(keep).includes(x.color) && x.cards.length < COLORS[x.color].size,
  );
  if (cible) cible.cards.push(keep);
  else {
    const c = possibleColors(keep)[0]!;
    v.groups.push({ id: `giveback-${keep}`, color: c, cards: [keep], house: null, hotel: null });
  }
  return d;
}

function tryAll(s: GameState, actions: GameAction[]): GameState | null {
  for (const a of actions) {
    try {
      return reduce(s, a);
    } catch {
      /* coup illégal : on passe au suivant */
    }
  }
  return null;
}

/** Un coup, dans l'ordre de préférence. Renvoie null si plus rien à faire. */
function bestMove(s: GameState, me: string, rules: Rules): GameState | null {
  const p = s.players.find((x) => x.id === me)!;
  const foe = opponent(s, me);
  const hand = [...p.hand];

  // 1. Poser une propriété qui COMPLÈTE un lot : c'est la victoire.
  for (const id of hand.filter(isPropertyLike)) {
    for (const c of possibleColors(id)) {
      if (missing(p, c) !== 1) continue;
      const g = p.groups.find((x) => x.color === c && x.cards.length < COLORS[c].size);
      const done = tryAll(s, [
        { type: 'PLAY_PROPERTY', playerId: me, cardId: id, groupId: g?.id, color: c },
      ]);
      if (done) return done;
    }
  }

  // 2. Coup de filet sur un lot complet adverse.
  const dealBreaker = hand.find((id) => getCard(id).label === 'Coup de filet');
  const target = foe.groups.filter(isGroupComplete).sort((a, b) => groupRent(b) - groupRent(a))[0];
  if (dealBreaker && target) {
    const done = tryAll(s, [
      {
        type: 'PLAY_DEAL_BREAKER',
        playerId: me,
        cardId: dealBreaker,
        targetPlayerId: foe.id,
        targetGroupId: target.id,
      },
    ]);
    if (done) return done;
  }

  // 3. Un loyer qui rapporte au moins 3 M.
  const rents = hand.filter((id) => getCard(id).kind === 'RENT');
  let bestRent: { a: GameAction; gain: number } | null = null;
  for (const id of rents) {
    const card = getCard(id);
    if (card.kind !== 'RENT') continue;
    for (const c of card.colors) {
      const own = p.groups.filter((g) => g.color === c);
      if (own.length === 0) continue;
      let gain = Math.max(...own.map(groupRent));
      if (rules.rentDoubleInDuel && !card.universal) gain *= 2;
      if (!bestRent || gain > bestRent.gain) {
        bestRent = {
          gain,
          a: {
            type: 'PLAY_RENT',
            playerId: me,
            cardId: id,
            color: c,
            ...(card.universal ? { targetPlayerId: foe.id } : {}),
          },
        };
      }
    }
  }
  if (bestRent && bestRent.gain >= 3) {
    const done = tryAll(s, [bestRent.a]);
    if (done) {
      const jouee = bestRent.a as Extract<GameAction, { type: 'PLAY_RENT' }>;
      const card = getCard(jouee.cardId);
      if (rules.rentDoubleInDuel && card.kind === 'RENT' && !card.universal && done.pending) {
        const d = structuredClone(done) as GameState;
        if (d.pending) d.pending.amount = (d.pending.amount ?? 0) * 2;
        return d;
      }
      return done;
    }
  }

  // 4. Voler la propriété adverse la plus utile à son propriétaire.
  const sly = hand.find((id) => getCard(id).label === 'Affaire douteuse');
  if (sly) {
    const stealable = foe.groups
      .filter((g) => !isGroupComplete(g))
      .flatMap((g) => g.cards)
      .sort((a, b) => propertyWorth(p, b) - propertyWorth(p, a));
    for (const id of stealable) {
      const done = tryAll(s, [
        { type: 'PLAY_SLY_DEAL', playerId: me, cardId: sly, targetPlayerId: foe.id, targetCardId: id },
      ]);
      if (done) return done;
    }
  }

  // 4 bis. Les cartes du tête-à-tête, dans l'ordre où elles rapportent.
  // La Filature d'abord : elle prive l'adversaire de sa meilleure carte, donc
  // d'un Refus ou d'un Coup de filet, avant qu'il ne s'en serve.
  const tail = hand.find((id) => getCard(id).label === 'Filature');
  if (tail && foe.hand.length > 0) {
    const done = tryAll(s, [
      { type: 'PLAY_TAIL', playerId: me, cardId: tail, targetPlayerId: foe.id },
    ]);
    if (done) return done;
  }

  // Le Contrôle ne passe que si l'autre mène : le moteur refuse le reste, on
  // tente et on continue.
  const ratp = hand.find((id) => getCard(id).label === 'Contrôle RATP');
  if (ratp && bankTotal(foe) >= 2) {
    const done = tryAll(s, [
      { type: 'PLAY_RATP_CHECK', playerId: me, cardId: ratp, targetPlayerId: foe.id },
    ]);
    if (done) return done;
  }

  // La Contravention est du tempo : elle vaut surtout quand l'adversaire a de
  // quoi faire, c'est-à-dire une main garnie.
  const fine = hand.find((id) => getCard(id).label === 'Contravention');
  if (fine && foe.hand.length >= 4) {
    const done = tryAll(s, [
      { type: 'PLAY_FINE', playerId: me, cardId: fine, targetPlayerId: foe.id },
    ]);
    if (done) return done;
  }

  // 5. Passe départ : de la matière première.
  const passGo = hand.find((id) => getCard(id).label === 'Passe départ');
  if (passGo) {
    const done = tryAll(s, [{ type: 'PLAY_PASS_GO', playerId: me, cardId: passGo }]);
    if (done) return done;
  }

  // 6. Recouvrement / Anniversaire si l'adversaire a de quoi payer.
  if (bankTotal(foe) >= 2) {
    const debt = hand.find((id) => getCard(id).label === 'Recouvrement');
    if (debt) {
      const done = tryAll(s, [
        { type: 'PLAY_DEBT_COLLECTOR', playerId: me, cardId: debt, targetPlayerId: foe.id },
      ]);
      if (done) return done;
    }
    const bday = hand.find((id) => getCard(id).label === 'Anniversaire');
    if (bday) {
      const done = tryAll(s, [{ type: 'PLAY_BIRTHDAY', playerId: me, cardId: bday }]);
      if (done) return done;
    }
  }

  // 7. Poser la propriété la plus utile.
  const props = hand.filter(isPropertyLike).sort((a, b) => propertyWorth(p, b) - propertyWorth(p, a));
  for (const id of props) {
    const c = possibleColors(id).sort((a, b) => missing(p, a) - missing(p, b))[0]!;
    const g = p.groups.find((x) => x.color === c && x.cards.length < COLORS[c].size);
    const done = tryAll(s, [
      { type: 'PLAY_PROPERTY', playerId: me, cardId: id, groupId: g?.id, color: c },
    ]);
    if (done) return done;
  }

  // 8. Construire sur un lot complet.
  const build = hand.find((id) => ['Maison', 'Hôtel'].includes(getCard(id).label));
  if (build) {
    for (const g of p.groups.filter(isGroupComplete)) {
      const done = tryAll(s, [{ type: 'PLAY_BUILDING', playerId: me, cardId: build, groupId: g.id }]);
      if (done) return done;
    }
  }

  // 9. Mettre en banque la plus grosse carte dont on n'a rien à faire.
  const bankable = hand
    .filter((id) => canBank(id) && !isPropertyLike(id))
    .filter((id) => !['Refus catégorique', 'Renvoi'].includes(getCard(id).label))
    .sort((a, b) => getCard(b).value - getCard(a).value);
  for (const id of bankable) {
    const done = tryAll(s, [{ type: 'PLAY_MONEY', playerId: me, cardId: id }]);
    if (done) return done;
  }

  return null;
}

/** Payer : les plus petites cartes d'abord, la banque avant les propriétés. */
function payment(p: PlayerState, debt: number): CardId[] {
  const owned = payableCards(p);
  const inBank = new Set(p.bank);
  const sorted = [...owned].sort((a, b) => {
    const pa = inBank.has(a) ? 0 : 1;
    const pb = inBank.has(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return getCard(a).value - getCard(b).value;
  });
  const out: CardId[] = [];
  let sum = 0;
  for (const id of sorted) {
    if (sum >= debt) break;
    out.push(id);
    sum += getCard(id).value;
  }
  return out.length === 0 ? owned : out;
}

export interface Outcome {
  winnerId: string | null;
  turns: number;
  /** Le gagnant a-t-il joué un Coup de filet dans la partie ? */
  usedDealBreaker: boolean;
  /** Lots complets du perdant à la fin. */
  loserSets: number;
  /** Cartes défaussées faute d'usage, sur toute la partie. */
  discarded: number;
  /** Nombre de Refus catégorique joués. */
  jsn: number;
  /** Combien de fois le joueur en tête a changé : mesure du suspense. */
  leadChanges: number;
  /** Cartes action mises en banque faute de mieux : le deck qui s'éteint. */
  bankedActions: number;
  /**
   * Cartes du tête-à-tête effectivement jouées. Sans ce compteur, une mesure
   * « équilibrée » ne prouve rien : elle peut simplement signifier que le bot
   * n'a jamais su s'en servir.
   */
  duelCards: number;
}

const MAX_TURNS = 400;

export function playGame(seed: string, rules: Rules): Outcome {
  let s = reduce(
    createGame({
      id: 'sim',
      seed,
      mode: rules.mode,
      players: [
        { id: 'A', name: 'A' },
        { id: 'B', name: 'B' },
      ],
    }),
    { type: 'START_GAME' },
  );

  // Témoin : on retire les quatre cartes du tête-à-tête, main comprise, et on
  // recomplète depuis la pioche pour que chacun garde le même nombre de cartes.
  if (rules.withoutExtras) {
    const d = structuredClone(s) as GameState;
    const extra = (id: CardId): boolean => {
      const c = getCard(id);
      return (
        c.kind === 'ACTION' &&
        ['REFLECT', 'FINE', 'RATP_CHECK', 'TAIL'].includes(c.action)
      );
    };
    d.deck = d.deck.filter((id) => !extra(id));
    for (const p of d.players) {
      const garde = p.hand.filter((id) => !extra(id));
      const manque = p.hand.length - garde.length;
      for (let i = 0; i < manque; i++) {
        const card = d.deck.shift();
        if (card) garde.push(card);
      }
      p.hand = garde;
    }
    s = d;
  }

  // Compensation du second joueur : il entre en jeu avec une main plus large.
  if (rules.secondPlayerBonus > 0) {
    const d = structuredClone(s) as GameState;
    const b = d.players.find((x) => x.id === 'B')!;
    for (let i = 0; i < rules.secondPlayerBonus; i++) {
      const card = d.deck.shift();
      if (card) b.hand.push(card);
    }
    s = d;
  }

  /** Dernier événement lu : le journal ne se relit pas en entier à chaque tour. */
  let lastSeq = -1;
  let turns = 0;
  let discarded = 0;
  let jsn = 0;
  let leadChanges = 0;
  let leader: string | null = null;
  let bankedActions = 0;
  let duelCards = 0;
  const dealBreakerBy = new Set<string>();

  /** Vol en cours, pour rendre une carte dès qu'il aboutit. */
  let vol: { thief: string; victim: string; cards: CardId[] } | null = null;

  while (!s.winnerId && turns < MAX_TURNS) {
    // Compte les cartes du tête-à-tête au fil du journal.
    for (const e of s.events) {
      if (e.seq <= lastSeq) continue;
      lastSeq = e.seq;
      if (e.t === 'REFLECTED' || e.t === 'FINED') duelCards++;
      else if (
        e.t === 'ACTION_PLAYED' &&
        (e.kind === 'RATP_CHECK' || e.kind === 'TAIL')
      ) {
        duelCards++;
      }
    }

    if (rules.softDealBreaker) {
      if (s.pending?.kind === 'DEAL_BREAKER') {
        const t = s.pending.targets[0]!;
        const v = s.players.find((x) => x.id === t.playerId)!;
        const g = v.groups.find((x) => x.id === s.pending!.groupId);
        if (g) vol = { thief: s.pending.sourcePlayerId, victim: v.id, cards: [...g.cards] };
      } else if (vol) {
        s = giveBackOne(s, vol.thief, vol.victim, vol.cards);
        vol = null;
      }
    }

    const cur = s.players[s.turnIndex]!;

    if (s.phase === 'DRAW') {
      if (rules.market > 0) s = restock(s, cur.id, rules.market);
      s = reduce(s, { type: 'DRAW', playerId: cur.id });
      continue;
    }

    if (s.phase === 'RESOLVING_ACTION' || s.phase === 'AWAITING_PAYMENT') {
      const t = s.pending?.targets.find(
        (x) => x.status === 'AWAITING_RESPONSE' || x.status === 'AWAITING_PAYMENT',
      );
      if (!t) break;
      const who = s.players.find((x) => x.id === (t.responderId ?? t.playerId))!;
      if (t.status === 'AWAITING_RESPONSE') {
        // Renvoi d'abord : il coûte une carte comme le Refus, mais il fait
        // payer l'autre au lieu de simplement ne pas payer.
        const renvoi = who.hand.find((id) => getCard(id).label === 'Renvoi');
        const demande = ['DEBT_COLLECTOR', 'BIRTHDAY', 'RENT', 'RATP_CHECK'].includes(
          s.pending?.kind ?? '',
        );
        if (
          renvoi &&
          demande &&
          who.id === t.playerId &&
          t.jsnChain.length === 0 &&
          !s.pending?.reflected
        ) {
          const tente = tryAll(s, [
            { type: 'RESPOND_REFLECT', playerId: who.id, cardId: renvoi },
          ]);
          if (tente) {
            s = tente;
            continue;
          }
        }
        const card = who.hand.find((id) => getCard(id).label === 'Refus catégorique');
        const grave = s.pending?.kind === 'DEAL_BREAKER' || (s.pending?.amount ?? 0) >= 4;
        const allowed = !rules.oneJsnPerTurn || t.jsnChain.length === 0;
        if (card && grave && allowed) {
          jsn++;
          s = reduce(s, { type: 'RESPOND_JUST_SAY_NO', playerId: who.id, cardId: card });
        } else {
          s = reduce(s, { type: 'RESPOND_ACCEPT', playerId: who.id, againstPlayerId: t.playerId });
        }
        continue;
      }
      const payer = s.players.find((x) => x.id === t.playerId)!;
      s = reduce(s, { type: 'PAY', playerId: payer.id, cardIds: payment(payer, t.debt) });
      continue;
    }

    if (s.phase === 'DISCARD') {
      const over = cur.hand.length - 7;
      const toss = [...cur.hand]
        .sort((a, b) => getCard(a).value - getCard(b).value)
        .slice(0, Math.max(0, over));
      discarded += toss.length;
      s = reduce(s, { type: 'DISCARD', playerId: cur.id, cardIds: toss });
      continue;
    }

    if (s.phase === 'END_TURN') {
      s = reduce(s, { type: 'ADVANCE_TURN' });
      continue;
    }

    if (s.phase === 'PLAY') {
      const before = s.actionsPlayed;
      // Le premier joueur ouvre avec une carte de moins : c'est le tour qui
      // porte tout son avantage.
      const permis = s.actionsAllowed ?? MAX_ACTIONS_PER_TURN;
      const plafond =
        rules.firstTurnHandicap && turns === 0 && cur.id === 'A'
          ? permis - 1
          : permis;
      const next = s.actionsPlayed < plafond ? bestMove(s, cur.id, rules) : null;
      // Qui mène ? Un changement de tête, c'est une partie qui se dispute.
      {
        const [a, b] = s.players;
        const sa = completeColors(a!).length;
        const sb = completeColors(b!).length;
        const tete = sa === sb ? null : sa > sb ? a!.id : b!.id;
        if (tete && tete !== leader) {
          if (leader !== null) leadChanges++;
          leader = tete;
        }
      }

      if (next && next.actionsPlayed > before) {
        if (next.pending?.kind === 'DEAL_BREAKER') dealBreakerBy.add(cur.id);
        s = next;
        continue;
      }
      s = reduce(s, { type: 'END_TURN', playerId: cur.id });
      turns++;
      continue;
    }

    break;
  }

  const winner = s.winnerId;
  for (const p of s.players) {
    bankedActions += p.bank.filter((id) => getCard(id).kind === 'ACTION').length;
  }
  const loser = s.players.find((p) => p.id !== winner);
  return {
    winnerId: winner,
    turns,
    usedDealBreaker: winner ? dealBreakerBy.has(winner) : false,
    loserSets: loser ? completeColors(loser).length : 0,
    discarded,
    jsn,
    leadChanges,
    bankedActions,
    duelCards,
  };
}

export { SETS_TO_WIN };
