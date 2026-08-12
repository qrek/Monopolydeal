/**
 * Partie de duel réelle contre le déploiement (temporaire, hors suite CI).
 *
 * Deux sessions anonymes Supabase, deux cookies, et le vrai serveur au bout :
 * rien n'est simulé côté règles. Le but est de vérifier que le mode DUEL tient
 * de bout en bout — sièges, compensation, deck élargi, loyers avec Maison et
 * Hôtel — et pas de mesurer quoi que ce soit.
 */

import { describe, expect, it } from 'vitest';

import {
  COLORS,
  bankTotal,
  bestRentForColor,
  canBank,
  deckFor,
  getCard,
  isGroupComplete,
  isPropertyLike,
  payableCards,
  possibleColors,
  type CardId,
  type Color,
  type GameAction,
} from '../lib/engine/index.ts';
import type { RedactedState } from '../lib/engine/selectors.ts';

const APP = 'https://monopolydeal-theta.vercel.app';
const SB = 'https://mrqhesvdazroyqqcwprh.supabase.co';
/** Clé publiable : elle est déjà dans le bundle client, par construction. */
const KEY = 'sb_publishable_-mOWxULkUk-KBO9Wz4rF9Q_I1m3pHO1';
const REF = 'mrqhesvdazroyqqcwprh';

const log = console.log;

/** Le proxy sortant coupe parfois : on retente avant de conclure. */
async function fetchRetry(url: string, init: RequestInit, essais = 6): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < essais; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw last;
}

interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type?: string;
  user: { id: string };
}

async function anon(): Promise<Session> {
  const res = await fetchRetry(`${SB}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ data: {} }),
  });
  const body = (await res.json()) as Session & { msg?: string };
  if (!res.ok || !body.access_token) throw new Error(`auth ${res.status}`);
  return body;
}

/** Le cookie que lit @supabase/ssr côté serveur, découpé comme lui. */
function cookieFor(s: Session): string {
  const payload = {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_in: s.expires_in,
    expires_at: s.expires_at,
    token_type: s.token_type ?? 'bearer',
    user: s.user,
  };
  const value = 'base64-' + Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const name = `sb-${REF}-auth-token`;
  const MAX = 3180;
  if (value.length <= MAX) return `${name}=${value}`;
  const parts: string[] = [];
  for (let i = 0, n = 0; i < value.length; i += MAX, n += 1) {
    parts.push(`${name}.${n}=${value.slice(i, i + MAX)}`);
  }
  return parts.join('; ');
}

interface View {
  game: { code: string; mode: string; status: string };
  players: Array<{ user_id: string; name: string; color: string | null }>;
  viewerId: string;
  state: RedactedState | null;
}

class Joueur {
  readonly nom: string;
  readonly id: string;
  private readonly cookie: string;
  constructor(nom: string, s: Session) {
    this.nom = nom;
    this.id = s.user.id;
    this.cookie = cookieFor(s);
  }
  static async create(nom: string): Promise<Joueur> {
    return new Joueur(nom, await anon());
  }
  async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetchRetry(`${APP}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', cookie: this.cookie, ...(init.headers ?? {}) },
    });
    const body: unknown = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${this.nom} ${path} → ${res.status} ${JSON.stringify(body)}`);
    return body as T;
  }
  view(code: string): Promise<View> {
    return this.call<View>(`/api/games/${code}`);
  }
  send(code: string, action: GameAction): Promise<{ view: View }> {
    return this.call(`/api/games/${code}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }
}

// ---------------------------------------------------------------------------
// Décisions : gloutonnes, juste assez pour que la partie avance.
// ---------------------------------------------------------------------------

type P = RedactedState['players'][number];

function moi(st: RedactedState, id: string): P {
  const p = st.players.find((x) => x.id === id);
  if (!p) throw new Error('joueur absent');
  return p;
}

function adverse(st: RedactedState, id: string): P {
  const p = st.players.find((x) => x.id !== id);
  if (!p) throw new Error('adversaire absent');
  return p;
}

/** Coup suivant, ou null pour finir le tour. */
function choisir(st: RedactedState, id: string): GameAction | null {
  const me = moi(st, id);
  const eux = adverse(st, id);

  // 1. Construire dès qu'un lot complet le permet : c'est précisément ce que
  // ce test doit provoquer, puisque la plainte porte sur les loyers majorés.
  for (const cardId of me.hand) {
    const card = getCard(cardId);
    if (card.kind !== 'ACTION') continue;
    if (card.action !== 'HOUSE' && card.action !== 'HOTEL') continue;
    const g = me.groups.find(
      (x) =>
        isGroupComplete(x) &&
        COLORS[x.color].buildable &&
        (card.action === 'HOUSE' ? !x.house : x.house && !x.hotel),
    );
    if (g) return { type: 'PLAY_BUILDING', playerId: id, cardId, groupId: g.id };
  }

  // 2. Une quittance rapporte, et c'est ce qu'on veut observer. On la joue
  // avant de poser une nouvelle propriété quand elle rapporte vraiment.
  for (const cardId of me.hand) {
    const card = getCard(cardId);
    if (card.kind !== 'RENT') continue;
    const couleurs = (card.colors ?? []) as Color[];
    const jouables = couleurs.filter((c) => bestRentForColor(me, c) > 0);
    const color = card.universal
      ? ([...me.groups]
          .sort((a, b) => bestRentForColor(me, b.color) - bestRentForColor(me, a.color))[0]
          ?.color ?? null)
      : (jouables.sort((a, b) => bestRentForColor(me, b) - bestRentForColor(me, a))[0] ?? null);
    if (!color || bestRentForColor(me, color) <= 0) continue;
    return card.universal
      ? { type: 'PLAY_RENT', playerId: id, cardId, color, targetPlayerId: eux.id }
      : { type: 'PLAY_RENT', playerId: id, cardId, color };
  }

  // 3. Poser une propriété : c'est la seule chose qui fait gagner.
  for (const cardId of me.hand) {
    if (!isPropertyLike(cardId)) continue;
    const colors = possibleColors(cardId);
    const groupe = me.groups.find(
      (g) => colors.includes(g.color) && g.cards.length < COLORS[g.color].size,
    );
    if (groupe) return { type: 'PLAY_PROPERTY', playerId: id, cardId, groupId: groupe.id };
    const color = colors[0];
    if (color) return { type: 'PLAY_PROPERTY', playerId: id, cardId, color, newGroup: true };
  }

  // 4. Sinon, la banque.
  const argent = me.hand.find((c) => canBank(c));
  if (argent) return { type: 'PLAY_MONEY', playerId: id, cardId: argent };

  return null;
}

/** Paiement : les plus petites cartes d'abord, comme un joueur pressé. */
function payer(st: RedactedState, id: string, du: number): CardId[] {
  const me = moi(st, id);
  const dispo = [...payableCards(me)].sort(
    (a, b) => (getCard(a).value ?? 0) - (getCard(b).value ?? 0),
  );
  const choix: CardId[] = [];
  let total = 0;
  for (const c of dispo) {
    if (total >= du) break;
    choix.push(c);
    total += getCard(c).value ?? 0;
  }
  return choix;
}

// ---------------------------------------------------------------------------

describe('duel en conditions réelles', () => {
  it('se joue jusqu’au bout sur le déploiement', async () => {
   const MANCHES = Number(process.env.MANCHES ?? 1);
   let construits = 0;
   for (let manche = 1; manche <= MANCHES; manche++) {
    log(`\n──────── manche ${manche}/${MANCHES} ────────`);
    const A = await Joueur.create('Alice');
    const B = await Joueur.create('Bob');
    const parId = new Map([
      [A.id, A],
      [B.id, B],
    ]);

    const { code } = await A.call<{ code: string }>('/api/games', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice', mode: 'DUEL' }),
    });
    log(`Partie ${code}`);

    await B.call(`/api/games/${code}/join`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Bob' }),
    });

    // Le duel n'a que deux sièges.
    const C = await Joueur.create('Chloé');
    await expect(
      C.call(`/api/games/${code}/join`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Chloé' }),
      }),
    ).rejects.toThrow(/GAME_FULL/);

    await A.call(`/api/games/${code}/actions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'START_GAME' }),
    });

    let vue = await A.view(code);
    expect(vue.game.mode).toBe('DUEL');
    let st = vue.state;
    if (!st) throw new Error('état absent');

    // Compensation : le second joueur reçoit deux cartes de plus.
    const vueB = await B.view(code);
    log(
      'vue Alice :',
      st.players.map((p) => `${p.name} hand=${p.hand.length} count=${p.handCount}`).join(' | '),
    );
    log(
      'vue Bob   :',
      vueB.state!.players.map((p) => `${p.name} hand=${p.hand.length} count=${p.handCount}`).join(' | '),
    );
    log('pioche restante :', st.deckCount, '| événements :', st.events.map((e) => e.t).join(','));
    // Le serveur pioche pour le joueur au trait dans la même requête : Alice
    // affiche donc 5 + 2 piochées, tandis que Bob montre sa compensation nue.
    const mains = st.players.map((p) => p.handCount);
    expect(mains[1]).toBe(7);
    expect(mains[0]).toBe(7);
    expect(st.deckCount).toBe(deckFor('DUEL').length - 14);
    log('deck du duel :', deckFor('DUEL').length, 'cartes contre', deckFor('CLASSIC').length, 'en classique');

    let coups = 0;
    let tours = 0;
    const vues = new Map<string, RedactedState>();
    const loyers: Array<{ montant: number; detail: string; reclame: number; du: number; construit: boolean }> = [];
    const familles = new Set<Color>();

    // Boucle de partie : chaque intention passe par le vrai serveur.
    for (let garde = 0; garde < 1200 && st.phase !== 'GAME_OVER'; garde++) {
      const courant = st.players[st.turnIndex];
      if (!courant) throw new Error('tour sans joueur');

      // La vue du joueur qui doit agir : lui seul voit sa main.
      const enAttente = st.pending?.targets.find(
        (t) => t.status === 'AWAITING_RESPONSE' || t.status === 'AWAITING_PAYMENT',
      );
      const qui: Joueur = (() => {
        if (enAttente) {
          const acteur =
            enAttente.status === 'AWAITING_RESPONSE' ? enAttente.responderId : enAttente.playerId;
          return parId.get(acteur) ?? parId.get(courant.id)!;
        }
        return parId.get(courant.id)!;
      })();

      const v = await qui.view(code);
      st = v.state!;
      vues.set(qui.id, st);
      for (const p of st.players) for (const g of p.groups) familles.add(g.color);

      let action: GameAction | null = null;
      const cible = st.pending?.targets.find(
        (t) => t.status === 'AWAITING_RESPONSE' || t.status === 'AWAITING_PAYMENT',
      );

      switch (st.phase) {
        case 'DRAW':
          action = { type: 'DRAW', playerId: courant.id };
          break;
        case 'RESOLVING_ACTION':
          action = {
            type: 'RESPOND_ACCEPT',
            playerId: cible!.responderId,
            againstPlayerId: cible!.playerId,
          };
          break;
        case 'AWAITING_PAYMENT': {
          const du = Math.max(0, cible!.debt - cible!.paid);
          // La dette réellement exigée doit être le montant annoncé, sinon la
          // fenêtre de loyer et la caisse racontent deux histoires différentes.
          if (st.pending?.kind === 'RENT' && cible!.paid === 0) {
            expect(cible!.debt).toBe(st.pending.amount);
            log(`  paiement exigé : ${cible!.debt} M (annoncé ${st.pending.amount} M)`);
          }
          action = { type: 'PAY', playerId: cible!.playerId, cardIds: payer(st, cible!.playerId, du) };
          break;
        }
        case 'DISCARD': {
          const me = moi(st, courant.id);
          action = { type: 'DISCARD', playerId: courant.id, cardIds: me.hand.slice(0, me.hand.length - 7) };
          break;
        }
        case 'PLAY': {
          action = st.actionsPlayed < 3 ? choisir(st, courant.id) : null;
          if (!action) {
            action = { type: 'END_TURN', playerId: courant.id };
            tours++;
          }
          break;
        }
        default:
          throw new Error(`phase inattendue : ${st.phase}`);
      }

      // Le loyer est le point du test : on note ce que le moteur local calcule
      // pour ce lot, constructions comprises, avant de laisser le serveur trancher.
      let attendu: { montant: number; detail: string } | null = null;
      if (action.type === 'PLAY_RENT') {
        const me = moi(st, action.playerId);
        const g = [...me.groups]
          .filter((x) => x.color === action.color)
          .sort((a, b) => b.cards.length - a.cards.length)[0];
        attendu = {
          montant: bestRentForColor(me, action.color),
          detail: `${action.color} ${g?.cards.length ?? 0}/${COLORS[action.color].size}${
            g?.house ? ' +Maison' : ''
          }${g?.hotel ? ' +Hôtel' : ''}`,
        };
      }

      const res = await qui.send(code, action);
      st = res.view.state!;
      coups++;

      if (attendu) {
        const du = st.pending?.targets[0]?.debt ?? 0;
        const construit = / \+/.test(attendu.detail);
        loyers.push({ ...attendu, reclame: st.pending?.amount ?? 0, du, construit });
        log(
          `loyer ${attendu.detail} → moteur ${attendu.montant} M, serveur ${st.pending?.amount ?? 0} M, dette ${du} M`,
        );
      }
    }

    log(`Partie terminée en ${coups} intentions, ${tours} tours.`);
    log('phase finale :', st.phase, '| vainqueur :', st.players.find((p) => p.id === st!.winnerId)?.name);
    log('familles vues sur les plateaux :', [...familles].join(', '));
    const banques = st.players.map((p) => `${p.name}: banque ${bankTotal(p)} M, ${p.groups.length} lots`);
    log(banques.join(' | '));

    // Le deck élargi doit se voir : métro et aéroports circulent.
    const journal = JSON.stringify(st.events);
    log('métro dans le journal :', /metro/.test(journal), '| aéroport :', /airport/.test(journal));

    // Les loyers annoncés doivent correspondre au moteur, constructions comprises.
    log(`quittances jouées : ${loyers.length}, dont ${loyers.filter((l) => l.construit).length} sur un lot construit`);
    for (const l of loyers) expect(l.reclame).toBe(l.montant);
    construits += loyers.filter((l) => l.construit).length;

    expect(st.phase).toBe('GAME_OVER');
    expect(st.winnerId).toBeTruthy();
   }
   log(`\nTotal : ${construits} loyers réclamés sur un lot construit.`);
  }, 3_600_000);
});
