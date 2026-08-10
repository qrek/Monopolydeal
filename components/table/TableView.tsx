/**
 * Vue table, pensée en paysage : la hauteur est la ressource rare, donc tout
 * s'empile en bandes — adversaires en haut, mon plateau au milieu, ma main et
 * les zones de dépôt en bas, journal sur le côté.
 *
 * Le joueur est toujours en bas, les adversaires au-dessus dans l'ordre du
 * tour : le premier est celui qui joue après moi.
 */

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Wordmark } from '@/components/brand/Wordmark';
import { CardBack, CardFace } from '@/components/cards/CardFace';
import { DiscardModal } from '@/components/play/DiscardModal';
import { DragLayer, DropZones } from '@/components/play/DropZones';
import { FlightLayer } from '@/components/play/FlightLayer';
import {
  JustSayNoOverlay,
  useTimeoutClaim,
} from '@/components/play/JustSayNoOverlay';
import { PaymentModal } from '@/components/play/PaymentModal';
import { PromptModal } from '@/components/play/Prompts';
import { usePlayController } from '@/components/play/usePlayController';
import { ActionPips } from '@/components/table/ActionPips';
import { BankRow } from '@/components/table/BankStack';
import { GameLog } from '@/components/table/GameLog';
import { HandFan } from '@/components/table/HandFan';
import { OpponentSeat } from '@/components/table/OpponentSeat';
import { PropertyGroups } from '@/components/table/PropertyGroups';
import { RotateHint } from '@/components/table/RotateHint';
import { SetPips } from '@/components/table/SetPips';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useGameStore } from '@/lib/client/store';
import {
  MAX_ACTIONS_PER_TURN,
  bankTotal,
  completeColors,
  type GameEvent,
  type Phase,
  type RedactedPlayer,
  type RedactedState,
} from '@/lib/engine';
import type { GameView } from '@/lib/server/games';
import {
  bandHeights,
  opponentBand,
  opponentStack,
  useTableScale,
  useViewport,
} from '@/lib/ui/layout';
import { myPendingTarget, myResponse } from '@/lib/ui/legal';

const PHASE_LABEL: Record<Phase, string> = {
  LOBBY: 'Salle d’attente',
  DRAW: 'Pioche',
  PLAY: 'À jouer',
  RESOLVING_ACTION: 'Action en cours',
  AWAITING_PAYMENT: 'Paiement',
  DISCARD: 'Défausse',
  END_TURN: 'Fin de tour',
  GAME_OVER: 'Partie terminée',
};

/** Adversaires dans l'ordre du tour à partir de moi. */
function seatOrder(players: RedactedPlayer[], viewerId: string): RedactedPlayer[] {
  const me = players.findIndex((p) => p.id === viewerId);
  if (me < 0) return players;
  return Array.from({ length: players.length - 1 }, (_, i) =>
    players[(me + i + 1) % players.length],
  ).filter((p): p is RedactedPlayer => Boolean(p));
}

/**
 * Secousse quand on se fait dépouiller : le journal dit ce qui s'est passé,
 * la secousse dit que ça m'est arrivé à moi.
 */
function useLossPulse(events: GameEvent[], me: string): boolean {
  const [hit, setHit] = useState(false);
  const seen = useRef(0);

  useEffect(() => {
    const last = events[events.length - 1];
    if (!last || last.seq <= seen.current) return;
    seen.current = last.seq;
    const painful =
      (last.t === 'CARDS_STOLEN' && last.fromId === me) ||
      (last.t === 'PAID' && last.fromId === me) ||
      (last.t === 'CARDS_SWAPPED' && (last.aId === me || last.bId === me));
    if (!painful) return;
    setHit(true);
    const id = setTimeout(() => setHit(false), 320);
    return () => clearTimeout(id);
  }, [events, me]);

  return hit;
}

export function TableView({ view }: { view: GameView }) {
  const refresh = useGameStore((s) => s.refresh);
  const scale = useTableScale();
  const bands = bandHeights(scale);
  const { height: vh, portraitPhone } = useViewport();
  const oppStack = opponentStack(opponentBand(vh, bands));
  const [rotateDismissed, setRotateDismissed] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const state = view.state;
  const ctl = usePlayController(view.game.code, view.viewerId, refresh);

  const me = state?.players.find((p) => p.id === view.viewerId);
  const shaken = useLossPulse(state?.events ?? [], view.viewerId);

  const current = state?.players[state.turnIndex];
  const myTurn = current?.id === view.viewerId;
  // `actionsRemaining` attend un GameState complet ; la vue redacted n'a pas de
  // pioche, mais le calcul ne tient qu'au compteur du tour.
  const left = state
    ? Math.max(0, MAX_ACTIONS_PER_TURN - state.actionsPlayed)
    : 0;

  const response = state ? myResponse(state, view.viewerId) : undefined;
  const debt = state ? myPendingTarget(state, view.viewerId) : undefined;
  const mustDiscard = Boolean(state && state.phase === 'DISCARD' && myTurn);

  // Fenêtre de Refus expirée : quelqu'un doit réclamer le dénouement.
  useTimeoutClaim(
    view.game.code,
    state?.pending ?? null,
    view.viewerId,
    view.game.updated_at,
    refresh,
  );

  // Début de tour : la pioche est automatique, elle n'est jamais un choix.
  const drawn = useRef<string | null>(null);
  useEffect(() => {
    if (!state || !myTurn || state.phase !== 'DRAW') return;
    const key = `${view.game.version}`;
    if (drawn.current === key) return;
    drawn.current = key;
    void ctl.send({ type: 'DRAW', playerId: view.viewerId });
  }, [state, myTurn, view.game.version, view.viewerId, ctl]);

  const nameOf = useMemo(
    () => (id: string) =>
      state?.players.find((p) => p.id === id)?.name ?? 'Joueur',
    [state],
  );

  if (!state || !me) {
    return (
      <main className="grid min-h-dvh place-items-center px-5 text-center">
        <p className="text-sm text-ink-soft">État de la partie indisponible.</p>
      </main>
    );
  }

  if (portraitPhone && !rotateDismissed) {
    return <RotateHint onDismiss={() => setRotateDismissed(true)} />;
  }

  const opponents = seatOrder(state.players, view.viewerId);
  const playable = myTurn && state.phase === 'PLAY' && left > 0;
  const top = state.discard[state.discard.length - 1];

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Bandeau ------------------------------------------------------- */}
        <header className="flex h-8 shrink-0 items-center gap-2 border-b-2 border-ink/80 bg-cream px-2">
          <Link href="/" aria-label="Quitter la partie" className="shrink-0">
            <Wordmark size={18} short />
          </Link>
          <span className="shrink-0 rounded-[0.2rem] border-2 border-ink bg-paper px-1.5 py-0.5 text-[0.7rem] font-extrabold tracking-[0.15em]">
            {view.game.code}
          </span>

          <span className="truncate text-[0.7rem] font-bold text-ink-soft">
            {PHASE_LABEL[state.phase]}
            {!myTurn && current && ` — ${current.name}`}
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {state.winnerId && (
              <span className="rounded-[0.2rem] bg-mono-red px-2 py-1 text-[0.7rem] font-extrabold uppercase text-cream">
                {nameOf(state.winnerId)} gagne
              </span>
            )}
            {/* En haut plutôt qu'en bas : la hauteur du pied est comptée au
                pixel près pour la main, un bouton de 48 px y tenait mal. */}
            <Button
              block={false}
              variant="secondary"
              className="!min-h-7 px-2 text-xs"
              disabled={!myTurn || (state.phase !== 'PLAY' && state.phase !== 'DRAW')}
              loading={ctl.busy}
              onClick={() =>
                void ctl.send({ type: 'END_TURN', playerId: view.viewerId })
              }
            >
              Fin de tour
            </Button>
            <button
              onClick={() => setLogOpen((v) => !v)}
              className="rounded-[0.3rem] border-2 border-ink/60 px-2 py-1 text-[0.7rem] font-bold transition-colors hover:bg-cream xl:hidden"
              aria-expanded={logOpen}
            >
              Journal
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-1.5">
          {/* Adversaires — c'est cette bande qui absorbe le reste de la
              hauteur, et qui se comprime quand l'écran est bas. */}
          <section
            className="no-scrollbar flex shrink-0 items-start gap-1.5"
            aria-label="Adversaires"
          >
            {opponents.map((p) => (
              <OpponentSeat
                key={p.id}
                player={p}
                isCurrent={p.id === current?.id}
                cardWidth={scale.opponent}
                stackHeight={oppStack}
              />
            ))}
          </section>

          {/* Le tapis : ce qui reste entre les adversaires et moi. Sur un grand
              écran c'est de la place perdue, alors la pioche et la défausse s'y
              installent, comme au milieu d'une vraie table. */}
          <div className="flex min-h-0 flex-1 items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <CardBack width={scale.pile} />
              <span className="board-label">Pioche {state.deckCount}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              {top ? (
                <CardFace cardId={top} width={scale.pile} />
              ) : (
                <div
                  className="rounded-card border-2 border-dashed border-ink/30"
                  style={{ width: scale.pile, height: Math.round(scale.pile * 1.4) }}
                />
              )}
              <span className="board-label">Défausse {state.discard.length}</span>
            </div>
          </div>

          {/* Mon plateau — hauteur réservée, jamais négociable. */}
          <section
            aria-label="Mon plateau"
            style={{ height: bands.mine }}
            className={`panel flex shrink-0 items-stretch gap-2 p-1.5 ${
              shaken ? 'animate-shake' : ''
            }`}
          >
            <div className="flex shrink-0 flex-col items-center justify-center gap-1 pr-1.5">
              <Avatar name={me.name} seed={me.id} size={26} />
              <SetPips sets={completeColors(me).length} />
            </div>

            <div className="no-scrollbar flex min-w-0 flex-1 gap-3 overflow-x-auto">
              <div className="shrink-0">
                <h2 className="board-label mb-0.5">Mes propriétés</h2>
                <PropertyGroups
                  groups={me.groups}
                  cardWidth={scale.mine}
                  maxHeight={bands.mineStack}
                  onMoveWild={playable ? ctl.moveWild : undefined}
                />
              </div>
              <div className="shrink-0">
                <h2 className="board-label mb-0.5">
                  Ma banque · <span className="text-ink">{bankTotal(me)} M</span>
                </h2>
                <BankRow cards={me.bank} cardWidth={scale.mine} />
              </div>
            </div>
          </section>
        </div>

        {/* Main + zones -------------------------------------------------- */}
        <footer
          style={{ height: bands.hand }}
          className="flex shrink-0 items-stretch gap-2 border-t-2 border-ink/80 bg-cream/80 px-2 py-1.5"
        >
          <div className="flex w-32 shrink-0 flex-col gap-1 sm:w-40">
            <div className="flex shrink-0 items-center justify-between gap-1">
              <ActionPips played={state.actionsPlayed} active={myTurn} />
              <span className="text-[0.6rem] font-bold uppercase tracking-wide text-ink-soft">
                {left} action{left > 1 ? 's' : ''}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <DropZones ctl={ctl} active={playable} vertical />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-end">
            {ctl.error && (
              <p
                role="alert"
                className="mb-1 truncate rounded-[0.3rem] bg-mono-red px-2 py-1 text-center text-xs font-bold text-cream"
                onClick={ctl.clearError}
              >
                {ctl.error}
              </p>
            )}
            <HandFan
              cards={me.hand}
              cardWidth={scale.hand}
              ctl={ctl}
              playable={playable}
            />
          </div>
        </footer>
      </main>

      {/* Journal ---------------------------------------------------------- */}
      {logOpen && (
        <button
          className="fixed inset-0 z-40 bg-ink/40 xl:hidden"
          aria-label="Fermer le journal"
          onClick={() => setLogOpen(false)}
        />
      )}
      <aside
        className={[
          'border-ink/80 bg-cream xl:static xl:block xl:w-64 xl:shrink-0 xl:border-l-2',
          logOpen
            ? 'fixed inset-y-0 right-0 z-50 w-72 border-l-2 shadow-panel'
            : 'hidden',
        ].join(' ')}
        aria-label="Journal de partie"
      >
        <div className="no-scrollbar h-full overflow-y-auto p-3">
          <h2 className="board-label mb-2">Journal</h2>
          <GameLog events={state.events} nameOf={nameOf} />
        </div>
      </aside>

      {/* Couches interactives --------------------------------------------- */}
      <DragLayer ctl={ctl} width={scale.hand} />
      <FlightLayer ctl={ctl} width={scale.hand} />

      <PromptModal ctl={ctl} state={state} me={me} actionsLeft={left} />

      {debt && (
        <PaymentModal
          target={debt}
          me={me}
          creditorName={nameOf(state.pending?.sourcePlayerId ?? '')}
          ctl={ctl}
        />
      )}

      {response && state.pending && !debt && (
        <JustSayNoOverlay
          pending={state.pending}
          target={response}
          me={me}
          sourceName={nameOf(state.pending.sourcePlayerId)}
          updatedAt={view.game.updated_at}
          ctl={ctl}
        />
      )}

      {mustDiscard && <DiscardModal me={me} ctl={ctl} />}
    </div>
  );
}

/** Réexport pour les écrans qui n'ont besoin que du type. */
export type { RedactedState };
