/**
 * Lecture du classement et des statistiques d'un pseudo.
 *
 * Rien n'est calculé ici : la base agrège, ce module ne fait que demander. La
 * règle de rapprochement des pseudos — accents, casse, espaces — vit dans la
 * fonction SQL `normalise_pseudo`, et nulle part ailleurs. Le serveur envoie le
 * pseudo tel qu'il est tapé et laisse Postgres décider qui est qui : deux
 * implémentations de cette règle finiraient par diverger, et ce sont les
 * statistiques d'un joueur qui se scinderaient en deux.
 */

import { adminClient } from '@/lib/supabase/admin';
import { ApiError } from '@/lib/server/errors';

/** En dessous, une victoire unique placerait quelqu'un en tête à 100 %. */
export const RANKED_MIN_GAMES = 3;

export interface RankRow {
  pseudo: string;
  parties: number;
  victoires: number;
  taux: number;
  derniere: string;
  /** Rang au classement, 1 pour le premier. Absent si le joueur n'est pas classé. */
  rang?: number;
}

export interface PlayerStats {
  pseudo: string;
  parties: number;
  victoires: number;
  taux: number;
  rang: number | null;
  /** Le mode le plus joué, et ce qu'il pèse. */
  mode: { nom: string; parties: number } | null;
  /** Meilleure série de victoires consécutives. */
  serie: number;
  /** Les dernières parties, de la plus récente à la plus ancienne. */
  recentes: Array<{ won: boolean; mode: string; sets: number | null; date: string }>;
}

interface LeaderboardRow {
  pseudo_key: string;
  pseudo: string;
  parties: number;
  victoires: number;
  taux: number;
  derniere: string;
}

/** Le classement, du plus de victoires au moins. */
export async function leaderboard(limit = 50): Promise<RankRow[]> {
  const { data, error } = await adminClient()
    .from('leaderboard')
    .select('pseudo, parties, victoires, taux, derniere')
    .gte('parties', RANKED_MIN_GAMES)
    .order('victoires', { ascending: false })
    .order('taux', { ascending: false })
    .order('parties', { ascending: false })
    .limit(limit);
  if (error) throw new ApiError(500, 'DB_ERROR', error.message);
  return (data ?? []).map((r, i) => ({ ...(r as RankRow), rang: i + 1 }));
}

/**
 * Statistiques d'un pseudo. Renvoie des zéros plutôt qu'une erreur pour un
 * pseudo inconnu : un joueur qui n'a pas fini de partie n'est pas une panne.
 */
export async function statsFor(rawPseudo: unknown): Promise<PlayerStats> {
  const pseudo = String(rawPseudo ?? '').trim().slice(0, 24);
  if (!pseudo) throw new ApiError(400, 'BAD_REQUEST', 'Pseudo manquant');
  const db = adminClient();

  // La clé de rapprochement est calculée par la base, pas ici.
  const { data: cle, error: cleErr } = await db.rpc('normalise_pseudo', { raw: pseudo });
  if (cleErr) throw new ApiError(500, 'DB_ERROR', cleErr.message);

  const [{ data: parties, error: e1 }, { data: rangs, error: e2 }] = await Promise.all([
    db
      .from('game_results')
      .select('won, mode, sets, finished_at')
      .eq('pseudo_key', cle)
      .order('finished_at', { ascending: false })
      .limit(200),
    db
      .from('leaderboard')
      .select('pseudo_key, pseudo, parties, victoires, taux, derniere')
      .gte('parties', RANKED_MIN_GAMES)
      .order('victoires', { ascending: false })
      .order('taux', { ascending: false })
      .order('parties', { ascending: false })
      .limit(200),
  ]);
  if (e1) throw new ApiError(500, 'DB_ERROR', e1.message);
  if (e2) throw new ApiError(500, 'DB_ERROR', e2.message);

  const jouees = (parties ?? []) as Array<{
    won: boolean;
    mode: string;
    sets: number | null;
    finished_at: string;
  }>;
  const victoires = jouees.filter((p) => p.won).length;

  // Meilleure série : les parties arrivent de la plus récente à la plus
  // ancienne, l'ordre n'importe pas pour un maximum.
  let serie = 0;
  let courante = 0;
  for (const p of jouees) {
    courante = p.won ? courante + 1 : 0;
    if (courante > serie) serie = courante;
  }

  const parMode = new Map<string, number>();
  for (const p of jouees) parMode.set(p.mode, (parMode.get(p.mode) ?? 0) + 1);
  const mode = [...parMode.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  const place = ((rangs ?? []) as LeaderboardRow[]).findIndex((r) => r.pseudo_key === cle);

  return {
    pseudo,
    parties: jouees.length,
    victoires,
    taux: jouees.length > 0 ? Math.round((100 * victoires) / jouees.length) : 0,
    rang: place >= 0 ? place + 1 : null,
    mode: mode ? { nom: mode[0], parties: mode[1] } : null,
    serie,
    recentes: jouees.slice(0, 10).map((p) => ({
      won: p.won,
      mode: p.mode,
      sets: p.sets,
      date: p.finished_at,
    })),
  };
}
