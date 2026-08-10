/**
 * Vue table, pensée pour un téléphone en paysage : la hauteur est la ressource
 * rare, donc tout s'empile en bandes — adversaires en haut, tapis au milieu,
 * mon plateau puis ma main en bas.
 *
 * Presque rien n'a de cadre. Le seul aplat est le bandeau de marque en haut ;
 * partout ailleurs les cartes se posent directement sur le tapis, et les zones
 * de dépôt sont les endroits eux-mêmes : mes propriétés à gauche, ma banque à
 * droite, le tapis au centre pour jouer une action.
 */

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Wordmark } from '@/components/brand/Wordmark';
import { CardBack } from '@/components/cards/CardFace';
import { AbortButton } from '@/components/play/AbortButton';
import { DiscardModal } from '@/components/play/DiscardModal';
import { DragLayer, Zone } from '@/components/play/DropZones';
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
import { OpponentBoard } from '@/components/table/OpponentBoard';
import { OpponentSeat } from '@/components/table/OpponentSeat';
import { PropertyGroups } from '@/components/table/PropertyGroups';
import { RotateHint } from '@/components/table/RotateHint';
import { SetPips } from '@/components/table/SetPips';
import { TableFeedback } from '@/components/table/TableFeedback';
import { Button } from '@/components/ui/Button';
import { useGameStore } from '@/lib/client/store';
import {
  MAX_ACTIONS_PER_TURN,
  bankTotal,
  completeColors,
  type GameEvent,
  type Phase,
  type RedactedPlayer,
} from '@/lib/engine';
import type { GameView } from '@/lib/server/games';
import { useTable } from '@/lib/ui/layout';
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
  const applyView = useGameStore((s) => s.applyView);
  const { scale, bands, viewport } = useTable();
  const [rotateDismissed, setRotateDismissed] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  /** Adversaire dont le plateau est ouvert en détail. */
  const [boardOf, setBoardOf] = useState<string | null>(null);

  const state = view.state;
  const ctl = usePlayController(view.game.code, view.viewerId, applyView);

  const me = state?.players.find((p) => p.id === view.viewerId);
  const shaken = useLossPulse(state?.events ?? [], view.viewerId);

  const current = state?.players[state.turnIndex];
  const myTurn = current?.id === view.viewerId;
  const left = state ? Math.max(0, MAX_ACTIONS_PER_TURN - state.actionsPlayed) : 0;

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

  // Début de tour : la pioche est automatique, elle n'est jamais un choix. Le
  // serveur la joue désormais dans la foulée du coup précédent — ce filet ne
  // sert plus qu'aux parties commencées avant, restées figées en phase DRAW.
  const drawn = useRef<string | null>(null);
  useEffect(() => {
    if (!state || !myTurn || state.phase !== 'DRAW') return;
    const key = `${view.game.version}`;
    if (drawn.current === key) return;
    drawn.current = key;
    void ctl.send({ type: 'DRAW', playerId: view.viewerId });
  }, [state, myTurn, view.game.version, view.viewerId, ctl]);

  const nameOf = useMemo(
    () => (id: string) => state?.players.find((p) => p.id === id)?.name ?? 'Joueur',
    [state],
  );

  if (!state || !me) {
    return (
      <main className="grid min-h-dvh place-items-center px-5 text-center">
        <p className="text-sm text-ink-soft">État de la partie indisponible.</p>
      </main>
    );
  }

  if (viewport.portraitPhone && !rotateDismissed) {
    return <RotateHint onDismiss={() => setRotateDismissed(true)} />;
  }

  const opponents = seatOrder(state.players, view.viewerId);
  const shown = opponents.find((p) => p.id === boardOf);
  const over = view.game.status === 'finished';
  const playable = !over && myTurn && state.phase === 'PLAY' && left > 0;
  const held = ctl.drag?.cardId ?? ctl.selected;

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* Marque du tapis : le feutre d'une vraie table porte le logo du jeu.
            Très effacé et inerte au pointeur — c'est un fond, pas un élément. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 grid place-items-center overflow-hidden"
        >
          {/* Sans son ombre portée : à 5 % d'opacité elle ne se lit plus comme
              un relief mais comme un cadre gris autour du bandeau. */}
          {/* En produit plutôt qu'en transparence : le bandeau rouge posé à
              plat sur le vert donnait un rectangle gris sale, alors qu'en
              assombrissant le feutre il se lit comme une marque imprimée. */}
          <Wordmark
            size={Math.round(viewport.height * 0.22)}
            className="opacity-[0.09] mix-blend-multiply [&_.brand-bar]:shadow-none"
          />
        </div>

        {/* Bandeau ------------------------------------------------------- */}
        <header className="safe-px relative z-10 flex h-8 shrink-0 items-center gap-2 border-b-2 border-ink/80 bg-cream">
          <Link href="/" aria-label="Quitter la partie" className="shrink-0">
            <Wordmark size={18} short />
          </Link>
          <span className="shrink-0 rounded-[0.2rem] border-2 border-ink bg-paper px-1.5 py-0.5 text-[0.68rem] font-extrabold tracking-[0.15em]">
            {view.game.code}
          </span>
          {/* Pioche et défausse : deux compteurs dans le bandeau. Posées au
              milieu du tapis elles flottaient sans rien y faire, et les
              montrer par intermittence aurait fait sauter la mise en page. */}
          <span className="flex shrink-0 items-center gap-1 text-[0.68rem] font-bold leading-none text-ink-soft">
            <CardBack width={13} />
            <span className="tabular-nums">{state.deckCount}</span>
            <span className="opacity-50">·</span>
            <span className="tabular-nums" title="Cartes défaussées">
              {state.discard.length}
            </span>
          </span>

          <span className="truncate text-[0.68rem] font-bold text-ink-soft">
            {PHASE_LABEL[state.phase]}
            {!myTurn && current && ` — ${current.name}`}
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {state.winnerId && (
              <span className="rounded-[0.2rem] bg-mono-red px-2 py-1 text-[0.68rem] font-extrabold uppercase text-cream">
                {nameOf(state.winnerId)} gagne
              </span>
            )}
            <ActionPips played={state.actionsPlayed} active={myTurn} />
            <Button
              block={false}
              variant="secondary"
              className="!min-h-7 px-2 text-xs"
              disabled={!myTurn || (state.phase !== 'PLAY' && state.phase !== 'DRAW')}
              loading={ctl.busy}
              onClick={() => void ctl.send({ type: 'END_TURN', playerId: view.viewerId })}
            >
              Fin de tour
            </Button>
            {!over && <AbortButton code={view.game.code} />}
            <button
              onClick={() => setLogOpen((v) => !v)}
              className="rounded-[0.3rem] border-2 border-ink/50 px-1.5 py-1 text-[0.68rem] font-bold transition-colors hover:bg-cream"
              aria-expanded={logOpen}
            >
              Journal
            </button>
          </div>
        </header>

        <div className="safe-px relative z-10 flex min-h-0 flex-1 flex-col gap-1 pb-1 pt-1.5">
          {/* Adversaires --------------------------------------------------- */}
          <section className="flex shrink-0 items-start gap-3" aria-label="Adversaires">
            {opponents.map((p) => (
              <OpponentSeat
                key={p.id}
                player={p}
                isCurrent={p.id === current?.id}
                cardWidth={scale.opponent}
                stackHeight={bands.opponentStack}
                onOpen={() => setBoardOf(p.id)}
              />
            ))}
          </section>

          {/* Mon plateau, sur une seule rangée collée à ma main : propriétés à
              gauche, tapis au centre pour jouer une action, banque à droite.
              Les trois zones de dépôt sont les emplacements eux-mêmes. */}
          {/* `items-stretch` et non `items-end` : alignées sur leur contenu, les
              trois zones prenaient chacune une hauteur différente, et le tapis
              — qui n'a pas de contenu — tombait à zéro pixel. Il était donc
              invisible ET intouchable, au glisser comme à la tape. */}
          <section
            aria-label="Mon plateau"
            className={`flex min-h-0 flex-1 items-stretch gap-2 ${shaken ? 'animate-shake' : ''}`}
          >
            <Zone
              ctl={ctl}
              dest="PROPERTY"
              active={playable}
              className="flex min-w-0 flex-1 flex-col justify-end px-1 pb-0.5"
            >
              <h2 className="board-label mb-0.5 flex items-center gap-1.5">
                Mes propriétés
                <SetPips sets={completeColors(me).length} />
              </h2>
              <PropertyGroups
                groups={me.groups}
                cardWidth={scale.mine}
                maxHeight={bands.mineStack}
                onMoveWild={playable && !held ? ctl.moveWild : undefined}
              />
            </Zone>

            {/* Le tapis, au centre, sous la main : c'est là qu'on pousse une
                carte action. Il porte une marque au repos, sinon rien ne dit
                qu'il est là. */}
            <Zone
              ctl={ctl}
              dest="ACTION"
              active={playable}
              className="flex shrink-0 flex-col items-center justify-end pb-0.5"
              style={{ width: Math.round(scale.mine * 1.9) }}
              hint={
                // Plus large qu'une carte : la marque tient ses deux mots sans
                // déborder, et le pouce a une cible confortable.
                <span
                  className={`grid w-full place-items-center rounded-card border-2 border-dashed border-ink/25 px-1 text-center text-[0.6rem] font-extrabold uppercase leading-tight tracking-tight text-ink/35 transition-opacity ${
                    playable ? 'opacity-100' : 'opacity-40'
                  }`}
                  style={{ height: Math.round(scale.mine * 1.4) }}
                >
                  Jouer
                  <br />
                  l’action
                </span>
              }
            />

            <Zone
              ctl={ctl}
              dest="BANK"
              active={playable}
              className="flex shrink-0 flex-col justify-end px-1 pb-0.5"
            >
              <h2 className="board-label mb-0.5 text-right">
                Ma banque · <span className="text-ink">{bankTotal(me)} M</span>
              </h2>
              <BankRow
                cards={me.bank}
                cardWidth={scale.mine}
                // Une banque fournie ne doit pas repousser mes propriétés hors
                // de l'écran : passé cette largeur, les billets se resserrent.
                maxWidth={Math.round(viewport.width * 0.34)}
              />
            </Zone>
          </section>
        </div>

        {/* Ma main : posée sur le tapis, sans cadre. --------------------- */}
        {/* `relative` + éventail ancré en bas : l'arc peut dépasser au-dessus
            du pied, dans le tapis vide, au lieu d'y réserver de la hauteur. */}
        <footer
          style={{ height: bands.hand }}
          className="safe-b relative shrink-0 pb-1"
        >
          {/* Au-dessus de l'éventail, qui occupe désormais tout le pied. */}
          {ctl.error && (
            <button
              onClick={ctl.clearError}
              className="absolute -top-7 left-1/2 z-20 max-w-[90%] -translate-x-1/2 truncate rounded-[0.3rem] border-2 border-ink bg-mono-red px-2 py-0.5 text-xs font-bold text-cream shadow-card"
            >
              {ctl.error}
            </button>
          )}
          <div className="safe-px absolute inset-x-0 bottom-1">
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
        <>
          <button
            className="fixed inset-0 z-40 bg-ink/40"
            aria-label="Fermer le journal"
            onClick={() => setLogOpen(false)}
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 w-72 border-l-2 border-ink bg-cream pr-[env(safe-area-inset-right)] shadow-panel"
            aria-label="Journal de partie"
          >
            <div className="no-scrollbar h-full overflow-y-auto p-3">
              <h2 className="board-label mb-2">Journal</h2>
              <GameLog events={state.events} nameOf={nameOf} />
            </div>
          </aside>
        </>
      )}

      {/* Couches interactives --------------------------------------------- */}
      <TableFeedback
        events={state.events}
        viewerId={view.viewerId}
        nameOf={nameOf}
        winnerId={state.winnerId}
        handWidth={scale.hand}
      />

      <DragLayer ctl={ctl} width={scale.hand} />
      <FlightLayer ctl={ctl} width={scale.hand} />

      <PromptModal ctl={ctl} state={state} me={me} actionsLeft={left} />

      <OpponentBoard player={shown ?? null} onClose={() => setBoardOf(null)} />

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

      {mustDiscard && !over && <DiscardModal me={me} ctl={ctl} />}

      {/* Partie arrêtée sans vainqueur : c'est une interruption, pas une fin de
          partie, et il faut une sortie explicite. */}
      {over && !state.winnerId && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/70 px-6">
          <div className="panel flex max-w-sm flex-col items-center gap-3 px-6 py-5 text-center">
            <p className="text-xl font-extrabold uppercase tracking-tight">
              Partie interrompue
            </p>
            <p className="text-sm text-ink-soft">
              Un joueur y a mis fin. Rien n’est perdu : vous pouvez en relancer
              une nouvelle.
            </p>
            <Link
              href="/"
              className="mt-1 inline-flex min-h-11 items-center rounded-card border-2 border-ink bg-mono-red px-5 font-extrabold text-cream"
            >
              Retour à l’accueil
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
