/**
 * Écran de fin : ce qui s'est passé, et la porte de sortie.
 *
 * Une partie qui s'arrête sur un simple « X gagne » laisse tout le monde
 * regarder un plateau figé sans savoir quoi en faire. On donne donc le
 * classement, quelques faits marquants tirés du journal complet, et deux
 * sorties claires — revoir la table, ou quitter.
 */

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

import { Wordmark } from '@/components/brand/Wordmark';
import {
  COLORS,
  SETS_TO_WIN,
  type GameEvent,
  type RedactedPlayer,
} from '@/lib/engine';
import { COUCHE } from '@/lib/ui/couches';
import { summarize } from '@/lib/ui/summary';

export function GameSummary({
  players,
  events,
  winnerId,
  viewerId,
  aborted,
  onClose,
}: {
  players: RedactedPlayer[];
  events: GameEvent[];
  winnerId: string | null;
  viewerId: string;
  /** Partie interrompue : il n'y a pas de vainqueur, juste un arrêt. */
  aborted: boolean;
  onClose: () => void;
}) {
  const data = summarize(players, events, winnerId);
  const iWon = winnerId === viewerId;

  return (
    <div
      className="safe-px fixed inset-0 grid place-items-center py-3"
      style={{ zIndex: COUCHE.resume }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        // Hauteur bornée et pied fixe : en paysage le panneau dépassait de
        // l'écran, et « Quitter » — la seule chose qu'on cherche à ce
        // moment-là — se retrouvait sous la ligne de flottaison.
        className="panel flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col p-3"
        role="dialog"
        aria-modal
        aria-label="Résumé de la partie"
      >
        {/* Titre ---------------------------------------------------------- */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b-2 border-ink/15 pb-2">
          <div className="flex items-center gap-3">
            <Wordmark size={20} short />
            <div>
              <p className="text-xl font-extrabold uppercase leading-none tracking-tight">
                {aborted
                  ? 'Partie interrompue'
                  : iWon
                    ? 'Tu gagnes !'
                    : `${data.players.find((p) => p.winner)?.name ?? 'Personne'} gagne`}
              </p>
              <p className="mt-0.5 text-[0.7rem] font-bold uppercase tracking-widest text-ink-soft">
                {aborted
                  ? 'Arrêtée avant la fin'
                  : `${SETS_TO_WIN} lots complets · ${data.turns} tours`}
              </p>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-2 sm:flex-row">
          {/* Classement --------------------------------------------------- */}
          <section className="min-w-0 flex-1">
            <h3 className="board-label mb-1">Classement</h3>
            <ol className="flex flex-col gap-1">
              {data.players.map((p, i) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-2 rounded-card border-2 px-2 py-1.5 ${
                    p.winner
                      ? 'border-ink bg-mono-red text-cream'
                      : 'border-ink/20 bg-paper'
                  }`}
                >
                  <span
                    className={`w-4 shrink-0 text-center text-sm font-extrabold tabular-nums ${
                      p.winner ? 'text-cream' : 'text-ink-soft'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-extrabold">
                    {p.name}
                    {p.id === viewerId && (
                      <span className="ml-1 text-[0.65rem] font-bold uppercase opacity-70">
                        vous
                      </span>
                    )}
                  </span>

                  {/* Les couleurs des lots complets, en pastilles. */}
                  <span className="flex shrink-0 items-center gap-0.5">
                    {p.setColors.map((c) => (
                      <span
                        key={c}
                        title={COLORS[c].label}
                        className="size-2.5 rounded-full border border-ink/60"
                        style={{ background: COLORS[c].hex }}
                      />
                    ))}
                  </span>

                  <span className="shrink-0 text-right text-[0.7rem] font-bold leading-tight">
                    <span className="tabular-nums">{p.sets}</span> lot
                    {p.sets > 1 ? 's' : ''}
                    <br />
                    <span className={p.winner ? 'opacity-80' : 'text-ink-soft'}>
                      <span className="tabular-nums">{p.properties}</span> carte
                      {p.properties > 1 ? 's' : ''} ·{' '}
                      <span className="tabular-nums">{p.worth}</span> M
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* Faits marquants ---------------------------------------------- */}
          <section className="min-w-0 sm:w-64">
            <h3 className="board-label mb-1">Faits marquants</h3>
            <dl className="flex flex-col gap-0.5">
              {data.highlights.map((h) => (
                <div
                  key={h.label}
                  className="flex items-baseline justify-between gap-2 border-b border-dashed border-ink/15 py-1 last:border-0"
                >
                  <dt className="min-w-0 text-[0.72rem] text-ink-soft">
                    {h.label}
                    {h.who && (
                      <span className="ml-1 font-bold text-ink">{h.who}</span>
                    )}
                  </dt>
                  <dd className="shrink-0 text-[0.8rem] font-extrabold tabular-nums">
                    {h.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        {/* Sorties --------------------------------------------------------- */}
        <footer className="flex shrink-0 flex-col gap-2 border-t-2 border-ink/15 pt-2 sm:flex-row">
          <button
            onClick={onClose}
            className="min-h-11 flex-1 rounded-card border-2 border-ink bg-cream px-4 font-extrabold transition-colors hover:bg-paper"
          >
            Revoir la table
          </button>
          <Link
            href="/"
            className="grid min-h-11 flex-1 place-items-center rounded-card border-2 border-ink bg-mono-red px-4 font-extrabold text-cream"
          >
            Quitter la partie
          </Link>
        </footer>
      </motion.div>
    </div>
  );
}
