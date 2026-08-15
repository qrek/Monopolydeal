/**
 * Service de partie, côté serveur uniquement.
 *
 * Toutes les mutations suivent le même chemin :
 *   charger l'état privé → valider l'identité de l'acteur → reduce() du moteur
 *   → transitions automatiques → écrire état + version (verrou optimiste)
 *   → append au log d'intentions.
 *
 * `games.version` sert à la fois de verrou optimiste (deux actions concurrentes
 * ne peuvent pas écraser le même état) et de signal Realtime côté client.
 */

import 'server-only';

import { after } from 'next/server';

import {
  CLIENT_ACTIONS,
  JUST_SAY_NO_WINDOW_MS,
  MAX_ACTIONS_PER_TURN,
  RuleError,
  bankTotal,
  completeColors,
  createGame,
  getAutoActions,
  redactFor,
  reduce,
  roomCodeFromSeed,
  rulesFor,
  type GameAction,
  type GameMode,
  type GameState,
  type RedactedState,
} from '@/lib/engine';
import { ApiError } from '@/lib/server/errors';
import { PALETTE } from '@/lib/ui/avatar';
import { adminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types de lignes (le schéma vit dans supabase/migrations)
// ---------------------------------------------------------------------------

export interface GameRow {
  id: string;
  code: string;
  mode: GameMode;
  status: 'lobby' | 'active' | 'finished';
  phase: string;
  host_id: string;
  version: number;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerRow {
  game_id: string;
  user_id: string;
  name: string;
  seat: number;
  connected: boolean;
  joined_at: string;
  /** Couleur choisie dans le salon, ou null : dérivée de l'identité. */
  color: string | null;
}

interface PrivateRow {
  game_id: string;
  seed: string;
  state: GameState | null;
}

export interface GameView {
  game: GameRow;
  players: PlayerRow[];
  /** Vue du moteur filtrée pour ce joueur ; null tant que la partie n'a pas démarré. */
  state: RedactedState | null;
  /** Id du joueur tel que vu par le moteur (= user id Supabase). */
  viewerId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeName(raw: unknown): string {
  const name = String(raw ?? '')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .trim()
    .slice(0, 24);
  return name.length > 0 ? name : 'Joueur';
}

async function loadByCode(code: string): Promise<GameRow> {
  const db = adminClient();
  const { data, error } = await db
    .from('games')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle();
  if (error) throw new ApiError(500, 'DB_ERROR', error.message);
  if (!data) throw new ApiError(404, 'GAME_NOT_FOUND', 'Partie introuvable');
  return data as GameRow;
}

async function loadPlayers(gameId: string): Promise<PlayerRow[]> {
  const db = adminClient();
  const { data, error } = await db
    .from('game_players')
    .select('*')
    .eq('game_id', gameId)
    .order('seat');
  if (error) throw new ApiError(500, 'DB_ERROR', error.message);
  return (data ?? []) as PlayerRow[];
}

/**
 * Partie et état privé en UNE requête, via la clé étrangère. Les deux lectures
 * enchaînées coûtaient deux allers-retours à la base, et un coup en fait déjà
 * plusieurs.
 */
async function loadWithPrivate(
  code: string,
): Promise<{ game: GameRow; priv: PrivateRow }> {
  const db = adminClient();
  const { data, error } = await db
    .from('games')
    .select('*, game_private(*)')
    .eq('code', code.toUpperCase())
    .maybeSingle();
  if (error) throw new ApiError(500, 'DB_ERROR', error.message);
  if (!data) throw new ApiError(404, 'GAME_NOT_FOUND', 'Partie introuvable');
  const row = data as GameRow & { game_private: PrivateRow | PrivateRow[] | null };
  const priv = Array.isArray(row.game_private) ? row.game_private[0] : row.game_private;
  if (!priv) throw new ApiError(500, 'STATE_MISSING', 'État absent');
  const { game_private: _omit, ...game } = row;
  return { game: game as GameRow, priv };
}

async function loadPrivate(gameId: string): Promise<PrivateRow> {
  const db = adminClient();
  const { data, error } = await db
    .from('game_private')
    .select('*')
    .eq('game_id', gameId)
    .single();
  if (error) throw new ApiError(500, 'DB_ERROR', error.message);
  return data as PrivateRow;
}

function statusOf(state: GameState): GameRow['status'] {
  if (state.phase === 'GAME_OVER') return 'finished';
  if (state.phase === 'LOBBY') return 'lobby';
  return 'active';
}

/**
 * Prévient les clients qu'il faut recharger la vue.
 *
 * On passe par le Broadcast Realtime et non par `postgres_changes` : ce dernier
 * décode le WAL et rejoue la RLS pour chaque abonné, et il a cessé de livrer au
 * bout de deux événements lors des mesures — l'abonnement restait « joined »
 * mais plus rien n'arrivait, laissant l'adversaire figé jusqu'à ce qu'il agisse
 * lui-même. Le Broadcast est un simple pub/sub : aucun état de jeu n'y transite,
 * seulement « la version a changé ».
 *
 * L'envoi est confié à `after` : celui qui vient de jouer a déjà son état dans
 * la réponse, il n'a aucune raison d'attendre que les autres soient prévenus.
 */
function notify(gameId: string, version: number): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  after(async () => {
    try {
      await fetch(`${url}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [{ topic: `game-${gameId}`, event: 'sync', payload: { version } }],
        }),
      });
    } catch {
      // Le signal est un confort : les clients ont un filet de sécurité qui
      // recharge périodiquement. Une notification perdue ne bloque pas la partie.
    }
  });
}

// ---------------------------------------------------------------------------
// Création & lobby
// ---------------------------------------------------------------------------

/** Le mode est choisi à la création, et nulle part ailleurs. */
function sanitizeMode(raw: unknown): GameMode {
  return raw === 'DUEL' ? 'DUEL' : 'CLASSIC';
}

export async function createRoom(
  userId: string,
  rawName: unknown,
  rawMode?: unknown,
): Promise<{ code: string; gameId: string }> {
  const db = adminClient();
  const name = sanitizeName(rawName);
  const mode = sanitizeMode(rawMode);

  // Le code est dérivé du seed ; en cas de collision (unique sur code), on
  // retire un seed. 24^4 ≈ 331k codes, la boucle aboutit vite.
  for (let attempt = 0; attempt < 10; attempt++) {
    const seed = crypto.randomUUID();
    const code = roomCodeFromSeed(seed);
    const { data: game, error } = await db
      .from('games')
      .insert({ code, host_id: userId, mode })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') continue; // collision de code
      throw new ApiError(500, 'DB_ERROR', error.message);
    }
    const g = game as GameRow;
    const [priv, player] = await Promise.all([
      db.from('game_private').insert({ game_id: g.id, seed, state: null }),
      db.from('game_players').insert({
        game_id: g.id,
        user_id: userId,
        name,
        seat: 0,
      }),
    ]);
    if (priv.error || player.error) {
      await db.from('games').delete().eq('id', g.id);
      throw new ApiError(
        500,
        'DB_ERROR',
        priv.error?.message ?? player.error?.message,
      );
    }
    return { code: g.code, gameId: g.id };
  }
  throw new ApiError(500, 'CODE_EXHAUSTED', 'Impossible de générer un code');
}

/** Rejoint une partie en lobby. Idempotent : re-rejoindre = reconnexion. */
export async function joinRoom(
  code: string,
  userId: string,
  rawName: unknown,
): Promise<{ gameId: string }> {
  const db = adminClient();
  const game = await loadByCode(code);
  const players = await loadPlayers(game.id);
  const existing = players.find((p) => p.user_id === userId);

  if (existing) {
    await db
      .from('game_players')
      .update({ connected: true })
      .eq('game_id', game.id)
      .eq('user_id', userId);
    return { gameId: game.id };
  }
  if (game.status !== 'lobby') {
    throw new ApiError(409, 'GAME_STARTED', 'La partie a déjà commencé');
  }
  // Le mode fixe le nombre de sièges : un duel n'en a que deux.
  const { maxPlayers } = rulesFor(game.mode);
  if (players.length >= maxPlayers) {
    throw new ApiError(
      409,
      'GAME_FULL',
      `La partie est complète (${maxPlayers} joueurs)`,
    );
  }
  const seat = Math.max(-1, ...players.map((p) => p.seat)) + 1;
  const { error } = await db.from('game_players').insert({
    game_id: game.id,
    user_id: userId,
    name: sanitizeName(rawName),
    seat,
  });
  if (error) throw new ApiError(500, 'DB_ERROR', error.message);
  notify(game.id, game.version);
  return { gameId: game.id };
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/**
 * Le journal complet finit par peser lourd dans chaque réponse, et l'écran n'en
 * montre que la fin. On n'envoie que les derniers événements.
 */
const EVENT_WINDOW = 60;

export async function getGameView(
  code: string,
  userId: string,
): Promise<GameView> {
  const game = await loadByCode(code);
  const [players, priv] = await Promise.all([
    loadPlayers(game.id),
    game.status === 'lobby' ? Promise.resolve(null) : loadPrivate(game.id),
  ]);
  if (!players.some((p) => p.user_id === userId)) {
    throw new ApiError(403, 'NOT_A_PLAYER', "Vous n'êtes pas dans cette partie");
  }
  let state: RedactedState | null = null;
  if (priv?.state) {
    state = redactFor(priv.state, userId);
    // Une partie terminée envoie son journal entier : le résumé compte les
    // tours, les paiements et les vols depuis le début, et une fenêtre
    // tronquée lui ferait raconter n'importe quoi. Le coût ne se paie qu'une
    // fois, quand plus personne ne joue.
    if (game.status !== 'finished') {
      state.events = state.events.slice(-EVENT_WINDOW);
    }
  }
  return { game, players, state, viewerId: userId };
}

// ---------------------------------------------------------------------------
// Application des intentions
// ---------------------------------------------------------------------------

function assertClientAction(
  action: GameAction,
  userId: string,
): asserts action is GameAction {
  if (!CLIENT_ACTIONS[action.type]) {
    throw new ApiError(403, 'FORBIDDEN_ACTION', `${action.type} est réservé au serveur`);
  }
  // Toutes les intentions client portent un playerId : il doit être l'appelant.
  if (!('playerId' in action) || action.playerId !== userId) {
    throw new ApiError(403, 'NOT_YOUR_ACTION', 'playerId ≠ utilisateur authentifié');
  }
}

interface Applied {
  actions: Array<{ action: GameAction; actorId: string | null }>;
  state: GameState;
}

/** Applique une intention + les transitions automatiques qui en découlent. */
function runEngine(
  state: GameState,
  action: GameAction,
  actorId: string | null,
): Applied {
  const applied: Applied['actions'] = [];
  let cur = reduce(state, action);
  applied.push({ action, actorId });

  const settle = () => {
    for (let guard = 0; guard < 4; guard++) {
      const autos = getAutoActions(cur);
      if (autos.length === 0) break;
      for (const auto of autos) {
        cur = reduce(cur, auto);
        applied.push({ action: auto, actorId: null });
      }
    }
  };
  settle();

  // Enchaînement des tours. La boucle est bornée par le nombre de joueurs :
  // une partie sans plus aucune carte nulle part passerait sinon la main
  // indéfiniment.
  for (let guard = 0; guard <= cur.players.length; guard++) {
    // La pioche de début de tour n'est pas un choix : le client la déclenchait
    // aussitôt, ce qui coûtait un aller-retour complet à chaque changement de
    // main. On la joue ici, dans la même requête.
    if (cur.phase === 'DRAW') {
      const next = cur.players[cur.turnIndex];
      if (!next) break;
      const draw: GameAction = { type: 'DRAW', playerId: next.id };
      cur = reduce(cur, draw);
      applied.push({ action: draw, actorId: null });
    }

    // Plus rien à faire de son tour : trois actions jouées, ou plus une seule
    // carte en main. Dans les deux cas « Fin de tour » est le seul coup légal
    // qui reste, et l'exiger à chaque fois n'était qu'un clic de péage. La
    // main de plus de sept cartes passe quand même par la défausse : le moteur
    // s'en charge, et là il y a bien un choix à faire.
    if (cur.phase !== 'PLAY') break;
    const p = cur.players[cur.turnIndex];
    if (!p) break;
    if (cur.actionsPlayed < MAX_ACTIONS_PER_TURN && p.hand.length > 0) break;

    const end: GameAction = { type: 'END_TURN', playerId: p.id };
    cur = reduce(cur, end);
    applied.push({ action: end, actorId: null });
    settle();
  }

  return { actions: applied, state: cur };
}

async function persist(
  game: GameRow,
  applied: Applied,
): Promise<void> {
  const db = adminClient();
  const next = applied.state;
  const newVersion = game.version + applied.actions.length;

  // Verrou optimiste : l'update n'aboutit que si personne n'a écrit entre-temps.
  const { data: updated, error } = await db
    .from('games')
    .update({
      version: newVersion,
      phase: next.phase,
      status: statusOf(next),
      winner_id: next.winnerId,
    })
    .eq('id', game.id)
    .eq('version', game.version)
    .select('id');
  if (error) throw new ApiError(500, 'DB_ERROR', error.message);
  if (!updated || updated.length === 0) {
    throw new ApiError(409, 'CONFLICT', 'Une autre action vient d’être jouée, réessayez');
  }

  const rows = applied.actions.map((a, i) => ({
    game_id: game.id,
    seq: game.version + i + 1,
    actor_id: a.actorId,
    action: a.action,
  }));
  // Le verrou de version est déjà pris : ces deux écritures ne peuvent plus
  // entrer en concurrence, autant les mener de front.
  const [stateWrite, logWrite] = await Promise.all([
    db.from('game_private').update({ state: next }).eq('game_id', game.id),
    db.from('game_actions').insert(rows),
  ]);
  if (stateWrite.error) throw new ApiError(500, 'DB_ERROR', stateWrite.error.message);
  if (logWrite.error) throw new ApiError(500, 'DB_ERROR', logWrite.error.message);

  // La partie vient de se terminer : on fige ce qu'elle a produit. C'est la
  // seule occasion — l'état complet sera écrasé à la partie suivante, et le
  // relire pour dresser un classement obligerait à ouvrir les données privées
  // à chaque affichage.
  if (statusOf(next) === 'finished' && game.status !== 'finished') {
    await recordResults(game.id, next);
  }

  notify(game.id, newVersion);
}

/**
 * Une ligne par joueur, à la fin d'une partie.
 *
 * Le classement s'indexe sur le PSEUDO et non sur le compte : l'identité
 * technique meurt avec le cookie du navigateur, le pseudo se retape à
 * l'identique ailleurs. La clé de rapprochement est calculée en base — colonne
 * générée — pour qu'il n'existe qu'une seule définition de « c'est le même
 * joueur ».
 */
async function recordResults(gameId: string, state: GameState): Promise<void> {
  const rows = state.players.map((p) => ({
    game_id: gameId,
    user_id: p.id,
    pseudo: p.name,
    mode: state.mode,
    won: state.winnerId === p.id,
    sets: completeColors(p).length,
    bank: bankTotal(p),
    turns: state.events.filter((e) => e.t === 'TURN_STARTED').length,
  }));
  // Un échec ici ne doit pas faire perdre le coup gagnant au joueur : la
  // partie est jouée, le classement n'est qu'un décompte.
  const { error } = await adminClient().from('game_results').insert(rows);
  if (error) console.error('game_results', error.message);
}

function toApiError(e: unknown): never {
  if (e instanceof RuleError) {
    throw new ApiError(422, e.code, e.message);
  }
  throw e;
}

/**
 * Choisir sa couleur, tant que la partie n'a pas démarré.
 *
 * La palette est vérifiée ici ET par une contrainte en base : un client
 * bricolé ne doit pas pouvoir peindre son avatar en blanc sur le tapis clair.
 * Une couleur déjà prise est refusée — c'est tout l'intérêt d'en choisir une.
 */
export async function setPlayerColor(
  code: string,
  userId: string,
  rawColor: unknown,
): Promise<void> {
  const color = typeof rawColor === 'string' ? rawColor : null;
  if (color !== null && !(PALETTE as readonly string[]).includes(color)) {
    throw new ApiError(400, 'BAD_COLOR', 'Couleur hors palette');
  }
  const game = await loadByCode(code);
  if (game.status !== 'lobby') {
    throw new ApiError(409, 'GAME_STARTED', 'La partie a déjà commencé');
  }
  const players = await loadPlayers(game.id);
  if (!players.some((p) => p.user_id === userId)) {
    throw new ApiError(403, 'NOT_A_PLAYER', "Vous n'êtes pas dans cette partie");
  }
  if (color && players.some((p) => p.user_id !== userId && p.color === color)) {
    throw new ApiError(409, 'COLOR_TAKEN', 'Cette couleur est déjà prise');
  }

  const db = adminClient();
  const { error } = await db
    .from('game_players')
    .update({ color })
    .eq('game_id', game.id)
    .eq('user_id', userId);
  if (error) throw new ApiError(500, 'DB_ERROR', error.message);

  // Le salon des autres joueurs doit refléter le choix tout de suite : c'est
  // la version de la partie qui porte le signal Realtime.
  await db
    .from('games')
    .update({ version: game.version + 1 })
    .eq('id', game.id)
    .eq('version', game.version);
  notify(game.id, game.version + 1);
}

/** Démarre la partie : réservé à l'hôte, 2 à 5 joueurs présents. */
export async function startGame(code: string, userId: string): Promise<void> {
  const game = await loadByCode(code);
  if (game.host_id !== userId) {
    throw new ApiError(403, 'HOST_ONLY', "Seul l'hôte peut lancer la partie");
  }
  if (game.status !== 'lobby') {
    throw new ApiError(409, 'GAME_STARTED', 'La partie a déjà commencé');
  }
  const [players, priv] = await Promise.all([
    loadPlayers(game.id),
    loadPrivate(game.id),
  ]);
  const initial = createGame({
    id: game.id,
    seed: priv.seed,
    mode: game.mode,
    players: players.map((p) => ({ id: p.user_id, name: p.name })),
  });
  try {
    const applied = runEngine(initial, { type: 'START_GAME' }, userId);
    await persist(game, applied);
  } catch (e) {
    toApiError(e);
  }
}

/** Applique une intention de jeu envoyée par un client. */
export async function applyIntent(
  code: string,
  userId: string,
  action: GameAction,
): Promise<void> {
  assertClientAction(action, userId);
  const { game, priv } = await loadWithPrivate(code);
  if (game.status !== 'active') {
    throw new ApiError(409, 'GAME_NOT_ACTIVE', "La partie n'est pas en cours");
  }
  if (!priv.state) throw new ApiError(500, 'STATE_MISSING', 'État absent');
  try {
    const applied = runEngine(priv.state, action, userId);
    await persist(game, applied);
  } catch (e) {
    toApiError(e);
  }
}

/**
 * Fenêtre de Refus expirée : n'importe quel joueur de la partie peut réclamer
 * le timeout ; le serveur vérifie le délai puis accepte au nom des cibles qui
 * n'ont pas répondu. Timeout = acceptation.
 */
export async function claimResponseTimeout(
  code: string,
  userId: string,
): Promise<void> {
  const game = await loadByCode(code);
  const players = await loadPlayers(game.id);
  if (!players.some((p) => p.user_id === userId)) {
    throw new ApiError(403, 'NOT_A_PLAYER', "Vous n'êtes pas dans cette partie");
  }
  const priv = await loadPrivate(game.id);
  const state = priv.state;
  if (!state || state.phase !== 'RESOLVING_ACTION' || !state.pending) {
    throw new ApiError(409, 'NOTHING_PENDING', 'Aucune réponse attendue');
  }
  const elapsed = Date.now() - new Date(game.updated_at).getTime();
  if (elapsed < JUST_SAY_NO_WINDOW_MS) {
    throw new ApiError(425, 'TOO_EARLY', 'La fenêtre de réponse court encore');
  }

  const stale = state.pending.targets.filter(
    (t) => t.status === 'AWAITING_RESPONSE',
  );
  if (stale.length === 0) {
    throw new ApiError(409, 'NOTHING_PENDING', 'Aucune réponse attendue');
  }
  try {
    let applied: Applied | null = null;
    let cur = state;
    const all: Applied['actions'] = [];
    for (const t of stale) {
      const accept: GameAction = {
        type: 'RESPOND_ACCEPT',
        playerId: t.responderId,
        againstPlayerId: t.playerId,
      };
      applied = runEngine(cur, accept, null);
      cur = applied.state;
      all.push(...applied.actions);
    }
    await persist(game, { actions: all, state: cur });
  } catch (e) {
    toApiError(e);
  }
}

/**
 * Interrompt la partie. N'importe quel joueur peut le faire : c'est une porte de
 * sortie quand une partie se bloque, pas un coup de jeu.
 *
 * Rien n'est supprimé — l'état et le journal restent en base pour comprendre ce
 * qui s'est passé. Seul le statut change, ce qui referme la porte à toute
 * nouvelle intention (`applyIntent` exige `active`) et réveille les autres
 * clients via le Realtime, `version` étant incrémenté.
 */
export async function abortGame(code: string, userId: string): Promise<void> {
  const db = adminClient();
  const game = await loadByCode(code);
  const players = await loadPlayers(game.id);
  if (!players.some((p) => p.user_id === userId)) {
    throw new ApiError(403, 'NOT_A_PLAYER', "Vous n'êtes pas dans cette partie");
  }
  if (game.status === 'finished') return;
  const { error } = await db
    .from('games')
    .update({ status: 'finished', phase: 'GAME_OVER', version: game.version + 1 })
    .eq('id', game.id);
  if (error) throw new ApiError(500, 'DB_ERROR', error.message);
  notify(game.id, game.version + 1);
}

/** Marque un joueur (dé)connecté — piloté par la présence Realtime du client. */
export async function setConnected(
  code: string,
  userId: string,
  connected: boolean,
): Promise<void> {
  const db = adminClient();
  const game = await loadByCode(code);
  const { error } = await db
    .from('game_players')
    .update({ connected })
    .eq('game_id', game.id)
    .eq('user_id', userId);
  if (error) throw new ApiError(500, 'DB_ERROR', error.message);
}
