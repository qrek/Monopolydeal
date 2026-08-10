/**
 * Vue table. Le joueur est en bas, les adversaires disposés au-dessus dans
 * l'ordre du tour — sur mobile en bandeau défilant, sur grand écran répartis en
 * arc autour du tapis.
 *
 * Étape 4 : tout est en lecture seule. Les interactions (glisser-déposer,
 * modale de paiement, fenêtre de Refus) arrivent à l'étape 5.
 */

'use client';

import Link from 'next/link';
import { useState } from 'react';

import { CardBack } from '@/components/cards/CardFace';
import { ActionPips } from '@/components/table/ActionPips';
import { BankRow } from '@/components/table/BankStack';
import { GameLog } from '@/components/table/GameLog';
import { HandFan } from '@/components/table/HandFan';
import { OpponentSeat } from '@/components/table/OpponentSeat';
import { PropertyGroups } from '@/components/table/PropertyGroups';
import { SetPips } from '@/components/table/SetPips';
import { Avatar } from '@/components/ui/Avatar';
import {
  bankTotal,
  completeColors,
  type Phase,
  type RedactedPlayer,
  type RedactedState,
} from '@/lib/engine';
import type { GameView } from '@/lib/server/games';

const PHASE_LABEL: Record<Phase, string> = {
  LOBBY: 'Salle d’attente',
  DRAW: 'Pioche',
  PLAY: 'À jouer',
  RESOLVING_ACTION: 'Action en cours',
  AWAITING_PAYMENT: 'Paiement en attente',
  DISCARD: 'Défausse',
  END_TURN: 'Fin de tour',
  GAME_OVER: 'Partie terminée',
};

/**
 * Adversaires dans l'ordre du tour à partir de nous : le voisin de gauche est
 * celui qui joue après nous, comme autour d'une vraie table.
 */
function seatOrder(players: RedactedPlayer[], viewerId: string): RedactedPlayer[] {
  const me = players.findIndex((p) => p.id === viewerId);
  if (me < 0) return players;
  return Array.from({ length: players.length - 1 }, (_, i) => {
    const p = players[(me + i + 1) % players.length];
    return p;
  }).filter((p): p is RedactedPlayer => Boolean(p));
}

function DeckPile({ state }: { state: RedactedState }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <CardBack width={34} />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-table px-1.5 py-0.5 text-[0.65rem] font-extrabold tabular-nums leading-none text-ink ring-1 ring-white/15">
          {state.deckCount}
        </span>
      </div>
      <div className="text-[0.7rem] leading-tight text-muted">
        <p className="font-bold text-ink">{PHASE_LABEL[state.phase]}</p>
        <p>{state.discard.length} défaussée{state.discard.length > 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}

export function TableView({ view }: { view: GameView }) {
  const [logOpen, setLogOpen] = useState(false);
  const state = view.state;

  if (!state) {
    return (
      <main className="grid min-h-dvh place-items-center px-5 text-center">
        <p className="text-sm text-muted">État de la partie indisponible.</p>
      </main>
    );
  }

  const me = state.players.find((p) => p.id === view.viewerId);
  const opponents = seatOrder(state.players, view.viewerId);
  const current = state.players[state.turnIndex];
  const myTurn = current?.id === view.viewerId;
  const mySets = me ? completeColors(me).length : 0;

  const nameOf = (id: string) =>
    state.players.find((p) => p.id === id)?.name ?? 'Joueur';

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ---------------------------------------------------------------- */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-table/90 px-4 py-2.5 backdrop-blur">
          <Link
            href="/"
            className="text-xs font-bold uppercase tracking-widest text-muted transition-colors hover:text-ink"
            aria-label="Quitter la partie"
          >
            ←
          </Link>
          <span className="font-extrabold tracking-[0.2em] text-gold">
            {view.game.code}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <DeckPile state={state} />
            <button
              onClick={() => setLogOpen((v) => !v)}
              className="rounded-card border border-white/10 px-2.5 py-2 text-xs font-bold text-muted transition-colors hover:text-ink lg:hidden"
              aria-expanded={logOpen}
            >
              Journal
            </button>
          </div>
        </header>

        {state.winnerId && (
          <p className="bg-gold px-4 py-2 text-center text-sm font-extrabold text-table">
            {nameOf(state.winnerId)} remporte la partie !
          </p>
        )}

        {/* Adversaires ---------------------------------------------------- */}
        {/* Deux colonnes sur mobile : à 4 adversaires, tout le monde reste
            visible d'un coup d'œil plutôt que derrière un défilement. */}
        <section
          className={[
            'grid gap-2 px-4 py-3 lg:flex lg:flex-wrap lg:justify-center',
            opponents.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
          ].join(' ')}
          aria-label="Adversaires"
        >
          {opponents.map((p) => (
            <OpponentSeat key={p.id} player={p} isCurrent={p.id === current?.id} />
          ))}
        </section>

        {/* Ma zone -------------------------------------------------------- */}
        <section className="flex-1 px-4 pb-2" aria-label="Mes cartes">
          <div className="panel p-3">
            <header className="mb-3 flex items-center gap-2">
              <Avatar name={me?.name ?? 'Moi'} seed={view.viewerId} size={32} />
              <p className="flex-1 truncate text-sm font-extrabold">
                {me?.name ?? 'Moi'}
                <span className="ml-2 text-xs font-bold text-muted">toi</span>
              </p>
              <SetPips sets={mySets} />
            </header>

            <h2 className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-widest text-muted">
              Mes propriétés
            </h2>
            <PropertyGroups groups={me?.groups ?? []} cardWidth={54} />

            <h2 className="mb-1.5 mt-4 flex items-baseline gap-2 text-[0.65rem] font-bold uppercase tracking-widest text-muted">
              Ma banque
              <span className="tabular-nums font-extrabold text-gold">
                {me ? bankTotal(me) : 0}M
              </span>
            </h2>
            <div className="overflow-x-auto [scrollbar-width:none]">
              <BankRow cards={me?.bank ?? []} cardWidth={46} />
            </div>
          </div>
        </section>

        {/* Main + compteur d'actions -------------------------------------- */}
        <footer className="sticky bottom-0 z-20 border-t border-white/10 bg-table/90 px-4 pb-3 pt-2 backdrop-blur">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-bold text-muted">
              {myTurn ? (
                <span className="text-gold">À toi de jouer</span>
              ) : (
                <>Tour de {current?.name ?? '—'}</>
              )}
            </p>
            <ActionPips played={state.actionsPlayed} active={myTurn} />
          </div>
          <HandFan cards={me?.hand ?? []} />
        </footer>
      </div>

      {/* Journal : colonne fixe sur grand écran, feuille glissante sur mobile —
          en simple bloc de flux, le bouton « Journal » ouvrait un panneau
          plusieurs écrans plus bas, donc invisible. */}
      {logOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Fermer le journal"
          onClick={() => setLogOpen(false)}
        />
      )}
      <aside
        className={[
          // Opaque en feuille mobile : à 95 % les cartes transparaissaient
          // derrière le texte du journal.
          'border-white/10 bg-felt lg:static lg:block lg:w-72 lg:shrink-0',
          'lg:border-l lg:bg-felt/60 lg:shadow-none',
          logOpen
            ? 'fixed inset-x-0 bottom-0 z-50 max-h-[70vh] rounded-t-panel border-t shadow-panel lg:rounded-none'
            : 'hidden',
        ].join(' ')}
        aria-label="Journal de partie"
      >
        <div className="max-h-[70vh] overflow-y-auto p-4 lg:sticky lg:top-0 lg:max-h-dvh">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
              Journal
            </h2>
            <button
              onClick={() => setLogOpen(false)}
              className="text-xs font-bold text-muted transition-colors hover:text-ink lg:hidden"
            >
              Fermer
            </button>
          </div>
          <GameLog events={state.events} nameOf={nameOf} />
        </div>
      </aside>
    </div>
  );
}
