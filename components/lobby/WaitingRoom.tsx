/**
 * Salle d'attente : le code partageable, la liste des joueurs présents, et le
 * bouton de lancement réservé à l'hôte (2 à 5 joueurs).
 */

'use client';

import Link from 'next/link';
import { useState } from 'react';

import { CodeTiles, ShareInvite } from '@/components/lobby/RoomCode';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { api, RequestError } from '@/lib/client/api';
import { useGameStore } from '@/lib/client/store';
import { MAX_PLAYERS, MIN_PLAYERS } from '@/lib/engine';
import type { GameView } from '@/lib/server/games';

function seatHint(count: number): string {
  if (count < MIN_PLAYERS) {
    const missing = MIN_PLAYERS - count;
    return `Il manque ${missing} joueur${missing > 1 ? 's' : ''} pour commencer.`;
  }
  if (count >= MAX_PLAYERS) return 'La table est complète.';
  return `Tu peux lancer, ou attendre jusqu’à ${MAX_PLAYERS} joueurs.`;
}

export function WaitingRoom({ view }: { view: GameView }) {
  const refresh = useGameStore((s) => s.refresh);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { game, players, viewerId } = view;
  const isHost = game.host_id === viewerId;
  const canStart = players.length >= MIN_PLAYERS && players.length <= MAX_PLAYERS;
  const host = players.find((p) => p.user_id === game.host_id);

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
        <Link
          href="/"
          className="self-start text-xs font-bold uppercase tracking-widest text-ink-soft transition-colors hover:text-ink"
        >
          ← Quitter
        </Link>
        <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">
          Code de la partie
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
            {players.length}/{MAX_PLAYERS}
          </span>
        </h2>

        <ul className="space-y-2">
          {players.map((p) => (
            <li
              key={p.user_id}
              className="flex items-center gap-3 rounded-card bg-paper px-3 py-2.5"
            >
              <Avatar name={p.name} seed={p.user_id} offline={!p.connected} />
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
          {Array.from({ length: MAX_PLAYERS - players.length }, (_, i) => (
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

      <footer className="animate-fade-up space-y-3">
        <p className="text-center text-sm text-ink-soft">{seatHint(players.length)}</p>
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
