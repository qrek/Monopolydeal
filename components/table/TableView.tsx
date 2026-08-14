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
import { RulesButton } from '@/components/rules/RulesBook';
import { ActionPips } from '@/components/table/ActionPips';
import { BankRow } from '@/components/table/BankStack';
import { GameLog } from '@/components/table/GameLog';
import { GameSummary } from '@/components/table/GameSummary';
import { HandFan } from '@/components/table/HandFan';
import { LiveRegion } from '@/components/table/LiveRegion';
import { OpponentBoard } from '@/components/table/OpponentBoard';
import { OpponentSeat } from '@/components/table/OpponentSeat';
import { PropertyGroups } from '@/components/table/PropertyGroups';
import { SetPips } from '@/components/table/SetPips';
import { TableFeedback } from '@/components/table/TableFeedback';
import { TransferLayer } from '@/components/table/TransferLayer';
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
import { playerColor } from '@/lib/ui/avatar';
import { COUCHE } from '@/lib/ui/couches';
import {
  fitBank,
  fitGroups,
  handSink,
  useMeasuredWidth,
  useTable,
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
  const applyView = useGameStore((s) => s.applyView);
  // Le budget de hauteur dépend du nombre d'adversaires en portrait : ils ont
  // chacun leur ligne, au lieu de se partager une rangée.
  const { scale, bands, viewport } = useTable(
    Math.max(1, (view.state?.players.length ?? 2) - 1),
  );
  const [logOpen, setLogOpen] = useState(false);
  /** Adversaire dont le plateau est ouvert en détail. */
  const [boardOf, setBoardOf] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const state = view.state;
  const ctl = usePlayController(view.game.code, view.viewerId, applyView);
  // La rangée de mon plateau se mesure elle-même : c'est elle qui connaît la
  // place restante une fois l'encoche déduite.
  const [boardRef, boardWidth] = useMeasuredWidth(viewport.width - 16);

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

  // Fin de partie : on laisse d'abord passer la carte de victoire, puis le
  // résumé s'ouvre. L'ouvrir aussitôt écraserait la seule seconde de fête.
  const finished = view.game.status === 'finished';
  const hasWinner = Boolean(state?.winnerId);
  useEffect(() => {
    if (!finished) return;
    const id = setTimeout(() => setSummaryOpen(true), hasWinner ? 1800 : 300);
    return () => clearTimeout(id);
  }, [finished, hasWinner]);

  const nameOf = useMemo(
    () => (id: string) => state?.players.find((p) => p.id === id)?.name ?? 'Joueur',
    [state],
  );

  // La couleur choisie vit sur la ligne de salon, pas dans l'état du moteur :
  // c'est de la présentation, et le moteur n'a pas à la connaître. À défaut de
  // choix, on retombe sur la couleur dérivée de l'identité — celle de l'avatar,
  // pour que tout ce qui désigne un joueur parle de la même couleur que lui.
  const colorOf = useMemo(() => {
    const carte = new Map(view.players.map((p) => [p.user_id, p.color]));
    return (id: string) => playerColor(id, carte.get(id) ?? null);
  }, [view.players]);

  if (!state || !me) {
    return (
      <main className="grid min-h-dvh place-items-center px-5 text-center">
        <p className="text-sm text-ink-soft">État de la partie indisponible.</p>
      </main>
    );
  }

  const opponents = seatOrder(state.players, view.viewerId);
  const shown = opponents.find((p) => p.id === boardOf);

  const colonne = viewport.portrait;

  // Carte du coup joué, montrée au centre : aussi grande que l'écran le permet,
  // bornée pour ne pas devenir une affiche sur un grand écran.
  const cueWidth = Math.round(
    Math.min(viewport.width * 0.42, (viewport.height * 0.58) / 1.4, 210),
  );

  // Répartition de la LARGEUR de mon plateau. La banque prend ce qu'il lui faut
  // mais jamais plus de sa part ; mes lots héritent du reste et rétrécissent
  // pour tenir. Sans cela, huit billets poussaient mes propriétés dans un
  // défilement horizontal invisible.
  //
  // En colonne, la question ne se pose plus : chaque zone a sa ligne et donc
  // toute la largeur. C'est tout l'intérêt de la disposition.
  const rowWidth = Math.max(240, boardWidth);
  const actionWidth = Math.round(scale.mine * 1.9);
  const bankShare = colonne
    ? rowWidth - 16
    : Math.round((rowWidth - actionWidth) * 0.42);
  const bankMax = colonne ? Math.floor(bands.bank / 1.4) : scale.mine;
  const bankWidth = fitBank(bankShare, me.bank.length, bankMax);
  const bankSpan =
    me.bank.length > 0
      ? bankWidth + Math.round(bankWidth * 0.62) * (me.bank.length - 1)
      : 0;
  // 32 px de chrome : les deux écarts entre zones (2 × 8) et le retrait
  // intérieur de chacune des deux zones bordées (2 × 8).
  const mineWidth = colonne
    ? fitGroups(rowWidth - 16, me.groups.length, scale.mine)
    : fitGroups(
        rowWidth - actionWidth - bankSpan - 32,
        me.groups.length,
        scale.mine,
      );
  const over = view.game.status === 'finished';
  // Une fenêtre ouverte prend la main sur la table : sans cela, l'éventail
  // restait saisissable derrière les règles ou le journal — on relevait une
  // carte sans la voir, et on la retrouvait sélectionnée en refermant.
  const windowOpen =
    logOpen ||
    rulesOpen ||
    summaryOpen ||
    boardOf !== null ||
    ctl.prompt !== null ||
    Boolean(debt) ||
    Boolean(response) ||
    mustDiscard;
  const playable = !over && !windowOpen && myTurn && state.phase === 'PLAY' && left > 0;
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
          {/* Lettres seules, à l'encre, très effacées : le bandeau rouge, même
              transparent, restait un rectangle bien visible au milieu du
              tapis. Une marque doit se deviner, pas se remarquer. */}
          <Wordmark
            size={Math.round(viewport.height * 0.22)}
            flat
            className="opacity-[0.045]"
          />
        </div>

        {/* Ce que la table dit à voix haute, pour qui ne la voit pas. */}
        <LiveRegion events={state.events} nameOf={nameOf} />

        {/* Les cartes qui changent de mains, montrées en vol : sans ça, un vol
            ou un paiement n'était qu'une ligne de journal. */}
        <TransferLayer
          events={state.events}
          width={scale.mine}
          viewerId={view.viewerId}
        />

        {/* Bandeau ------------------------------------------------------- */}
        <header className="safe-px relative z-10 flex h-8 shrink-0 items-center gap-2 border-b-2 border-ink/80 bg-cream">
          {/* Sous 420 px de large — un téléphone tenu debout — le bandeau
              réclamait 430 px et le bouton « Journal » sortait de l'écran, sans
              rien pour le signaler. La marque est ce qui se retire le mieux :
              elle ne sert qu'à revenir à l'accueil, ce que le geste de retour
              du téléphone fait déjà. */}
          <Link
            href="/"
            aria-label="Quitter la partie"
            className="tap hidden shrink-0 min-[420px]:block"
          >
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

          {/* Qui joue, et de quelle couleur. La pastille reprend celle du
              joueur : c'est le même repère que sur son siège et sur le bandeau
              de passage de main. */}
          <span className="flex min-w-0 items-center gap-1 text-[0.68rem] font-bold text-ink-soft">
            {current && (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full border border-ink/50"
                style={{ background: colorOf(current.id) }}
              />
            )}
            <span className="truncate">
              {PHASE_LABEL[state.phase]}
              {!myTurn && current && ` — ${current.name}`}
            </span>
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {state.winnerId && (
              <span className="rounded-[0.2rem] bg-mono-red px-2 py-1 text-[0.68rem] font-extrabold uppercase text-cream">
                {nameOf(state.winnerId)} gagne
              </span>
            )}
            {/* Partie finie : « fin de tour » n'a plus de sens, et c'est le
                résumé qu'on veut pouvoir rouvrir après avoir regardé la table. */}
            {over ? (
              <Button
                block={false}
                variant="secondary"
                className="tap !min-h-7 px-2 text-xs"
                onClick={() => setSummaryOpen(true)}
              >
                Résumé
              </Button>
            ) : (
              <>
                <ActionPips played={state.actionsPlayed} active={myTurn} />
                <AbortButton code={view.game.code} />
              </>
            )}
            {/* Le doute arrive en cours de partie, pas avant : les règles
                doivent être à un pouce, sans quitter la table. */}
            <RulesButton
              className="tap rounded-[0.3rem] border-2 border-ink/50 px-1.5 py-1 text-[0.68rem] font-bold transition-colors hover:bg-cream"
              label="Règles"
              mode={view.game.mode}
              onOpenChange={setRulesOpen}
            />
            <button
              onClick={() => setLogOpen((v) => !v)}
              className="tap rounded-[0.3rem] border-2 border-ink/50 px-1.5 py-1 text-[0.68rem] font-bold transition-colors hover:bg-cream"
              aria-expanded={logOpen}
            >
              Journal
            </button>
          </div>
        </header>

        <div className="safe-px relative z-10 flex min-h-0 flex-1 flex-col gap-1 pb-1 pt-1.5">
          {/* Adversaires --------------------------------------------------- */}
          {/* En colonne, chacun sa ligne : sa bande passe de 62 à une centaine
              de pixels, et ses lots deviennent lisibles sans ouvrir de fenêtre.
              En rangée, ils se partagent la largeur. */}
          {/* Le défilement ne sert qu'au cas extrême — cinq joueurs sur un
              petit téléphone, où même les bandes au plancher ne tiennent pas.
              Partout ailleurs le calcul tombe juste et rien ne défile. */}
          <section
            className={
              colonne
                ? 'no-scrollbar flex min-h-0 shrink flex-col gap-1.5 overflow-y-auto'
                : 'flex shrink-0 items-start gap-3'
            }
            aria-label="Adversaires"
          >
            {opponents.map((p) => (
              <OpponentSeat
                key={p.id}
                player={p}
                isCurrent={p.id === current?.id}
                cardWidth={scale.opponent}
                seatWidth={
                  colonne
                    ? rowWidth
                    : Math.floor((rowWidth - 12 * (opponents.length - 1)) / opponents.length)
                }
                stackHeight={bands.opponentStack}
                onOpen={() => setBoardOf(p.id)}
                color={colorOf(p.id)}
              />
            ))}
          </section>

          {colonne && (
            // Le tapis prend le milieu, comme sur une vraie table : c'est là
            // qu'on pousse une carte action, et c'est la seule bande qui
            // s'étire — à deux joueurs elle occupe tout ce que les autres
            // n'ont pas pris, au lieu de laisser un trou.
            <div
              className="flex min-h-0 flex-1 items-stretch gap-2"
              style={{ minHeight: bands.mat }}
            >
              <Zone
                ctl={ctl}
                dest="ACTION"
                active={playable}
                className="flex min-w-0 flex-1 flex-col justify-center"
                hint={
                  <span
                    className={`grid h-full w-full place-items-center rounded-card border-2 border-dashed border-ink/25 px-2 text-center text-[0.72rem] font-extrabold uppercase leading-tight tracking-tight text-ink/35 transition-opacity ${
                      playable ? 'opacity-100' : 'opacity-40'
                    }`}
                  >
                    Jouer l’action
                  </span>
                }
              />
              {/* Fin de tour : au bord droit du tapis. En bas de l'écran il
                  aurait chevauché l'éventail, qui prend ici toute la largeur. */}
              {myTurn && (state.phase === 'PLAY' || state.phase === 'DRAW') && (
                <button
                  onClick={() => void ctl.send({ type: 'END_TURN', playerId: view.viewerId })}
                  disabled={ctl.busy}
                  className="tap w-[4.2rem] shrink-0 rounded-card border-2 border-ink bg-cream text-[0.72rem] font-extrabold uppercase leading-tight tracking-tight text-ink shadow-card transition-colors hover:bg-board-dark active:translate-y-px disabled:opacity-50"
                >
                  Fin de
                  <br />
                  tour
                </button>
              )}
            </div>
          )}

          {/* Mon plateau. En rangée : propriétés à gauche, tapis au centre,
              banque à droite — les trois zones de dépôt sont les emplacements
              eux-mêmes. En colonne : chaque zone prend toute la largeur, ce qui
              en fait les plus grandes cibles tactiles de l'application. */}
          {/* `items-stretch` et non `items-end` : alignées sur leur contenu, les
              trois zones prenaient chacune une hauteur différente, et le tapis
              — qui n'a pas de contenu — tombait à zéro pixel. Il était donc
              invisible ET intouchable, au glisser comme à la tape. */}
          <section
            ref={boardRef}
            data-seat={view.viewerId}
            aria-label="Mon plateau"
            className={`flex gap-2 ${
              colonne ? 'shrink-0 flex-col' : 'min-h-0 flex-1 items-stretch'
            } ${shaken ? 'animate-shake' : ''}`}
          >
            <Zone
              ctl={ctl}
              dest="PROPERTY"
              active={playable}
              className={`flex flex-col px-1 pb-0.5 ${
                colonne ? 'shrink-0' : 'min-w-0 flex-1 justify-end'
              }`}
            >
              <h2 className="board-label mb-0.5 flex items-center gap-1.5">
                Mes propriétés
                <SetPips sets={completeColors(me).length} />
              </h2>
              <PropertyGroups
                groups={me.groups}
                cardWidth={mineWidth}
                maxHeight={bands.mineStack}
                onMoveWild={playable && !held ? ctl.moveWild : undefined}
              />
            </Zone>

            {/* Le tapis, au centre de la rangée, sous la main : c'est là qu'on
                pousse une carte action. Il porte une marque au repos, sinon
                rien ne dit qu'il est là. En colonne il a sa propre bande, plus
                haut, et n'est donc pas rendu ici. */}
            {!colonne && (
              <Zone
                ctl={ctl}
                dest="ACTION"
                active={playable}
                className="flex shrink-0 flex-col items-center justify-end pb-0.5"
                style={{ width: actionWidth }}
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
            )}

            <Zone
              ctl={ctl}
              dest="BANK"
              active={playable}
              className={`flex shrink-0 flex-col px-1 pb-0.5 ${
                colonne ? '' : 'justify-end'
              }`}
            >
              {/* Le montant est la donnée qu'on relit sans arrêt — pour payer,
                  pour jauger ce qu'on peut encaisser. Il sort du libellé. */}
              <h2
                className={`mb-0.5 flex items-baseline gap-1.5 ${
                  colonne ? '' : 'justify-end'
                }`}
              >
                <span className="board-label">Ma banque</span>
                <span className="text-[0.95rem] font-extrabold leading-none tabular-nums text-ink">
                  {bankTotal(me)} M
                </span>
              </h2>
              <BankRow cards={me.bank} cardWidth={bankWidth} maxWidth={bankShare} />
            </Zone>
          </section>
        </div>

        {/* Ma main : posée sur le tapis, sans cadre. --------------------- */}
        {/* `relative` + éventail ancré en bas : l'arc peut dépasser au-dessus
            du pied, dans le tapis vide, au lieu d'y réserver de la hauteur. */}
        {/* `isolate` : les cartes de l'éventail portent leur propre z-index —
            jusqu'à 100 pour celle qu'on relève — et sans contexte à elles,
            elles concouraient avec les fenêtres. Une carte sélectionnée se
            peignait donc PAR-DESSUS les règles ou le paiement, et restait
            cliquable à travers. Ici, ces z-index ne sortent plus du pied. */}
        <footer
          style={{ height: bands.hand, zIndex: COUCHE.main }}
          className="safe-b relative isolate shrink-0 pb-1"
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
          {/* L'éventail passe sous le bord bas : le pied ne réserve que la
              part visible de la carte, et le reste est rogné par la page. */}
          {/* Fin de tour, au pouce. Dans le coin haut-droit c'était le bouton
              le plus pressé du jeu et le plus loin de la main ; ici il tombe
              dans l'espace que l'éventail laisse libre à sa droite — une
              quatre-vingtaine de pixels, même avec sept cartes. */}
          {!colonne && myTurn && (state.phase === 'PLAY' || state.phase === 'DRAW') && (
            <button
              onClick={() => void ctl.send({ type: 'END_TURN', playerId: view.viewerId })}
              disabled={ctl.busy}
              className="absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] right-[max(0.5rem,env(safe-area-inset-right))] z-20 grid h-11 w-[3.9rem] place-items-center rounded-card border-2 border-ink bg-cream text-[0.7rem] font-extrabold uppercase leading-tight tracking-tight text-ink shadow-card transition-colors hover:bg-board-dark active:translate-y-px disabled:opacity-50"
            >
              Fin de
              <br />
              tour
            </button>
          )}

          {/* L'enfoncement recule devant la barre de geste système : sur un
              iPhone, un glisser démarré dans les vingt derniers pixels bascule
              d'application au lieu de jouer la carte. */}
          <div
            className="safe-px absolute inset-x-0"
            style={{
              bottom: `calc(env(safe-area-inset-bottom) - ${handSink(scale.hand)}px)`,
            }}
          >
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
            className="fixed inset-0 bg-ink/40"
            style={{ zIndex: COUCHE.tiroir }}
            aria-label="Fermer le journal"
            onClick={() => setLogOpen(false)}
          />
          <aside
            className="fixed inset-y-0 right-0 w-72 border-l-2 border-ink bg-cream pr-[env(safe-area-inset-right)] shadow-panel"
            style={{ zIndex: COUCHE.tiroir + 1 }}
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
        colorOf={colorOf}
        winnerId={state.winnerId}
        cueWidth={cueWidth}
      />

      <DragLayer ctl={ctl} width={scale.hand} />
      <FlightLayer ctl={ctl} width={scale.hand} />

      <PromptModal ctl={ctl} state={state} me={me} actionsLeft={left} />

      <OpponentBoard player={shown ?? null} onClose={() => setBoardOf(null)} />

      {debt && (
        <PaymentModal
          target={debt}
          state={state}
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
          state={state}
          sourceName={nameOf(state.pending.sourcePlayerId)}
          updatedAt={view.game.updated_at}
          ctl={ctl}
        />
      )}

      {mustDiscard && !over && <DiscardModal me={me} ctl={ctl} />}

      {/* Fin de partie : classement, faits marquants et porte de sortie. Vaut
          aussi pour une partie interrompue, où il n'y a rien à célébrer mais
          où il faut d'autant plus une sortie explicite. */}
      {over && summaryOpen && (
        <GameSummary
          players={state.players}
          events={state.events}
          winnerId={state.winnerId}
          viewerId={view.viewerId}
          aborted={!state.winnerId}
          onClose={() => setSummaryOpen(false)}
        />
      )}
    </div>
  );
}
