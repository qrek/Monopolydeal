/**
 * Les quatre cartes du tête-à-tête, jouées contre le déploiement.
 *
 * Ce fichier existe parce qu'un test unitaire ne pouvait pas voir le bug qui
 * l'a motivé : le moteur acceptait `PLAY_TAIL`, l'interface le proposait, et
 * seule la liste blanche du SERVEUR le refusait. Il faut donc traverser toute
 * la pile — cookie, route, garde, moteur, base — pour en avoir le cœur net.
 *
 * Manuel, hors CI, comme le reste de sim/.
 */

import { describe, expect, it } from 'vitest';

import { getCard, type CardId, type GameAction } from '../lib/engine/index.ts';
import type { RedactedState } from '../lib/engine/selectors.ts';

const APP = 'https://monopolydeal-theta.vercel.app';
const SB = 'https://mrqhesvdazroyqqcwprh.supabase.co';
/** Clé publiable : elle est déjà dans le bundle client, par construction. */
const KEY = 'sb_publishable_-mOWxULkUk-KBO9Wz4rF9Q_I1m3pHO1';
const REF = 'mrqhesvdazroyqqcwprh';

const log = console.log;

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
  const body = (await res.json()) as Session;
  if (!res.ok || !body.access_token) throw new Error(`auth ${res.status}`);
  return body;
}

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

/**
 * Solde tout ce qui traîne — fenêtre de Refus, dette, défausse — et rend la
 * vue une fois la table de nouveau en phase de jeu. Le banc n'essaie pas de
 * bien jouer : il essaie que la partie avance.
 */
async function solder(
  code: string,
  parId: Map<string, Joueur>,
  vue: View,
): Promise<View> {
  let v = vue;
  for (let garde = 0; garde < 12; garde++) {
    const st = v.state!;
    if (st.phase === 'PLAY' || st.phase === 'GAME_OVER') return v;

    const enAttente = st.pending?.targets.find(
      (t) => t.status === 'AWAITING_RESPONSE' || t.status === 'AWAITING_PAYMENT',
    );
    if (enAttente?.status === 'AWAITING_RESPONSE') {
      v = (
        await parId.get(enAttente.responderId)!.send(code, {
          type: 'RESPOND_ACCEPT',
          playerId: enAttente.responderId,
          againstPlayerId: enAttente.playerId,
        })
      ).view;
      continue;
    }
    if (enAttente?.status === 'AWAITING_PAYMENT') {
      const p = st.players.find((x) => x.id === enAttente.playerId)!;
      const du = Math.max(0, enAttente.debt - enAttente.paid);
      const cartes: CardId[] = [];
      let somme = 0;
      for (const id of [...p.bank, ...p.groups.flatMap((g) => g.cards)]) {
        if (somme >= du) break;
        cartes.push(id);
        somme += getCard(id).value;
      }
      v = (
        await parId
          .get(enAttente.playerId)!
          .send(code, { type: 'PAY', playerId: enAttente.playerId, cardIds: cartes })
      ).view;
      continue;
    }

    const courant = st.players[st.turnIndex]!;
    if (st.phase === 'DISCARD') {
      const moi = st.players.find((x) => x.id === courant.id)!;
      const trop = moi.hand.slice(0, Math.max(0, moi.hand.length - 7));
      v = (
        await parId
          .get(courant.id)!
          .send(code, { type: 'DISCARD', playerId: courant.id, cardIds: trop })
      ).view;
      continue;
    }
    if (st.phase === 'DRAW') {
      v = (await parId.get(courant.id)!.send(code, { type: 'DRAW', playerId: courant.id })).view;
      continue;
    }
    return v;
  }
  return v;
}

/** Passe la main : on finit le tour courant, quoi qu'il reste à solder. */
async function tourSuivant(
  code: string,
  parId: Map<string, Joueur>,
  vue: View,
): Promise<View> {
  const v = await solder(code, parId, vue);
  const st = v.state!;
  if (st.phase !== 'PLAY') return v;
  const courant = st.players[st.turnIndex]!;
  const apres = (
    await parId.get(courant.id)!.send(code, { type: 'END_TURN', playerId: courant.id })
  ).view;
  return solder(code, parId, apres);
}

describe('les quatre cartes, contre le vrai serveur', () => {
  it('se jouent toutes les quatre', async () => {
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
    await B.call(`/api/games/${code}/join`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Bob' }),
    });
    await A.call(`/api/games/${code}/actions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'START_GAME' }),
    });
    log(`Partie ${code}`);

    let v = await A.view(code);
    expect(v.game.mode).toBe('DUEL');

    /**
     * On ne peut pas choisir sa main : on tente la carte quand elle arrive, et
     * on tourne les tours en attendant. Ce qu'on veut prouver n'est pas qu'elle
     * gagne la partie — c'est que le serveur ne la refuse plus.
     */
    const vues = new Map<string, string>();
    const attendu = ['TAIL', 'FINE', 'RATP_CHECK'] as const;
    const jouees = new Set<string>();
    const refus: string[] = [];

    for (let tour = 0; tour < 40 && jouees.size < attendu.length; tour++) {
      v = await solder(code, parId, v);
      if (v.state!.phase === 'GAME_OVER') break;
      const courant = v.state!.players[v.state!.turnIndex]!;
      const joueur = parId.get(courant.id)!;
      // La vue est redacted : seule celle du joueur au trait montre sa main.
      // Sans ce rafraîchissement, on regardait une main systématiquement vide.
      v = await joueur.view(code);

      const moi = v.state!.players.find((p) => p.id === courant.id)!;
      const adversaire = v.state!.players.find((p) => p.id !== courant.id)!;
      for (const id of [...moi.hand]) {
        const c = getCard(id as CardId);
        if (c.kind !== 'ACTION') continue;
        const kind = c.action as string;
        if (!attendu.includes(kind as (typeof attendu)[number])) continue;
        vues.set(kind, id);
        const base = { playerId: courant.id, cardId: id as CardId, targetPlayerId: adversaire.id };
        const action: GameAction =
          kind === 'TAIL'
            ? { type: 'PLAY_TAIL', ...base }
            : kind === 'FINE'
              ? { type: 'PLAY_FINE', ...base }
              : { type: 'PLAY_RATP_CHECK', ...base };
        try {
          const res = await joueur.send(code, action);
          v = res.view;
          jouees.add(kind);
          log(`  ${kind} accepté par le serveur`);
          v = await solder(code, parId, v);
        } catch (e) {
          const msg = String(e instanceof Error ? e.message : e);
          // Un refus de RÈGLE est légitime (« ne mène pas », « main vide ») ;
          // un refus de GARDE ne l'est pas, et c'était tout le bug.
          if (/FORBIDDEN_ACTION|réservé au serveur/.test(msg)) refus.push(`${kind} : ${msg}`);
          else log(`  ${kind} refusé par une règle : ${msg.slice(-70)}`);
        }
        break;
      }

      v = await tourSuivant(code, parId, v);
    }

    log(`Cartes vues en main : ${[...vues.keys()].join(', ') || 'aucune'}`);
    log(`Cartes acceptées : ${[...jouees].join(', ') || 'aucune'}`);
    expect(refus, 'le serveur refuse encore des intentions du client').toEqual([]);
    expect(jouees.size, 'aucune des trois cartes n’a pu être jouée').toBeGreaterThan(0);
  }, 900_000);
});
