/**
 * Salle d'attente : le code partageable, la liste des joueurs présents, et le
 * bouton de lancement réservé à l'hôte (2 à 5 joueurs).
 */

'use client';

import Link from 'next/link';
import { useState } from 'react';

import { CodeTiles, ShareInvite } from '@/components/lobby/RoomCode';
import { RulesButton } from '@/components/rules/RulesBook';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { api, RequestError } from '@/lib/client/api';
import { useGameStore } from '@/lib/client/store';
import { rulesFor } from '@/lib/engine';
import { PALETTE, playerColor } from '@/lib/ui/avatar';
import type { GameView } from '@/lib/server/games';

function seatHint(count: number, min: number, max: number): string {
  if (count < min) {
    const missing = min - count;
    return `Il manque ${missing} joueur${missing > 1 ? 's' : ''} pour commencer.`;
  }
  if (count >= max) return 'La table est complète.';
  return `Tu peux lancer, ou attendre jusqu’à ${max} joueurs.`;
}

export function WaitingRoom({ view }: { view: GameView }) {
  const refresh = useGameStore((s) => s.refresh);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Couleur en cours d'envoi : le retour serveur peut mettre une seconde. */
  const [pendingColor, setPendingColor] = useState<string | null>(null);

  const { game, players, viewerId } = view;
  const isHost = game.host_id === viewerId;
  // Le nombre de sièges dépend du mode : un duel n'en a que deux.
  const { minPlayers, maxPlayers } = rulesFor(game.mode);
  const canStart = players.length >= minPlayers && players.length <= maxPlayers;
  const host = players.find((p) => p.user_id === game.host_id);

  const moi = players.find((p) => p.user_id === viewerId);
  const prises = new Set(
    players.filter((p) => p.user_id !== viewerId).map((p) => p.color),
  );

  const choisir = async (color: string) => {
    if (prises.has(color)) return;
    setPendingColor(color);
    setError(null);
    try {
      // Reprendre sa propre couleur la retire : c'est le geste attendu quand
      // on change d'avis sans vouloir en choisir une autre.
      await api.setColor(game.code, moi?.color === color ? null : color);
      await refresh();
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Couleur indisponible');
    } finally {
      setPendingColor(null);
    }
  };

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      await api.startGame(game.code);
      await refresh();
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Lancement impossible');
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <header className="animate-fade-up flex flex-col items-center gap-4 text-center">
        <div className="flex w-full items-baseline justify-between">
          <Link
            href="/"
            className="text-xs font-bold uppercase tracking-widest text-ink-soft transition-colors hover:text-ink"
          >
            ← Quitter
          </Link>
          {/* L'attente avant le lancement est le meilleur moment pour lire les
              règles : plus tard, on est au milieu d'un tour. */}
          <RulesButton
            className="text-xs font-bold uppercase tracking-widest text-ink-soft transition-colors hover:text-ink"
            label="Règles"
            mode={game.mode}
          />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">
          Code de la partie
        </p>
        <p className="rounded-card border-2 border-ink bg-cream px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-ink shadow-card">
          {rulesFor(game.mode).label}
        </p>
        <CodeTiles code={game.code} />
        <div className="w-full max-w-xs">
          <ShareInvite code={game.code} />
        </div>
      </header>

      <section className="panel animate-fade-up flex-1 p-5">
        <h2 className="mb-4 flex items-baseline justify-between text-sm font-bold uppercase tracking-widest text-ink-soft">
          Joueurs
          <span className="tabular-nums text-ink">
            {players.length}/{maxPlayers}
          </span>
        </h2>

        <ul className="space-y-2">
          {players.map((p) => (
            <li
              key={p.user_id}
              className="flex items-center gap-3 rounded-card bg-paper px-3 py-2.5"
            >
              <Avatar
                name={p.name}
                seed={p.user_id}
                color={p.color}
                offline={!p.connected}
              />
              <span className="min-w-0 flex-1 truncate text-base font-bold tracking-tight">
                {p.name}
                {p.user_id === viewerId && (
                  <span className="ml-2 text-xs font-bold text-ink-soft">toi</span>
                )}
              </span>
              {p.user_id === game.host_id && (
                <span className="rounded-full bg-mono-red/15 px-2.5 py-1 text-[0.65rem] font-extrabold uppercase tracking-widest text-mono-red">
                  Hôte
                </span>
              )}
              {!p.connected && (
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-soft">
                  absent
                </span>
              )}
            </li>
          ))}

          {/* Sièges libres : on voit d'un coup d'œil ce qu'il reste. */}
          {Array.from({ length: Math.max(0, maxPlayers - players.length) }, (_, i) => (
            <li
              key={`empty-${i}`}
              className="flex items-center gap-3 rounded-card border border-dashed border-ink/25 px-3 py-2.5"
            >
              <span aria-hidden className="size-11 rounded-full bg-ink/10" />
              <span className="text-sm text-ink-soft">Siège libre</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Choisir sa couleur : c'est elle qui identifie le joueur à la table,
          où il n'y a pas la place d'écrire un pseudo en entier. */}
      <section className="animate-fade-up">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-ink-soft">
          Ma couleur
        </h2>
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((c) => {
            const prise = prises.has(c);
            const mienne = playerColor(viewerId, moi?.color) === c && Boolean(moi?.color);
            return (
              <button
                key={c}
                type="button"
                onClick={() => void choisir(c)}
                disabled={prise || pendingColor !== null}
                aria-pressed={mienne}
                aria-label={prise ? 'Couleur déjà prise' : 'Choisir cette couleur'}
                className={`size-11 rounded-full border-2 transition-transform ${
                  mienne
                    ? 'border-ink shadow-card'
                    : 'border-ink/25 hover:scale-105 disabled:hover:scale-100'
                } ${prise ? 'cursor-not-allowed opacity-25' : ''}`}
                style={{ backgroundColor: c }}
              >
                {mienne && <span className="text-lg font-extrabold text-table">✓</span>}
              </button>
            );
          })}
        </div>
      </section>

      <footer className="animate-fade-up space-y-3">
        <p className="text-center text-sm text-ink-soft">{seatHint(players.length, minPlayers, maxPlayers)}</p>
        {isHost ? (
          <Button onClick={() => void start()} disabled={!canStart} loading={starting}>
            Lancer la partie
          </Button>
        ) : (
          <p className="text-center text-sm font-bold text-ink">
            En attente que {host?.name ?? 'l’hôte'} lance la partie…
          </p>
        )}
        {error && (
          <p role="alert" className="text-center text-sm text-mono-red">
            {error}
          </p>
        )}
      </footer>
    </main>
  );
}
