/**
 * Contrôleur d'intentions côté table.
 *
 * Il tient trois choses : l'envoi des intentions au serveur (avec le message
 * d'erreur de règle qui remonte tel quel), la carte en cours de manipulation
 * (sélectionnée au doigt ou traînée à la souris), et la question qui reste à
 * poser avant de pouvoir envoyer — couleur d'un joker, cible d'une action.
 *
 * Rien n'est appliqué localement : le serveur reste seul maître de l'état.
 */

'use client';

import { useCallback, useRef, useState } from 'react';

import { api, RequestError } from '@/lib/client/api';
import { getCard, type CardId, type GameAction } from '@/lib/engine';
import {
  destinationsFor,
  isBuilding,
  type Destination,
} from '@/lib/ui/legal';

/** Ce qu'il reste à demander au joueur avant d'envoyer l'intention. */
export type Prompt =
  | { kind: 'COLOR'; cardId: CardId; move: boolean }
  | { kind: 'BUILDING'; cardId: CardId }
  | { kind: 'DEAL_BREAKER'; cardId: CardId }
  | { kind: 'SLY_DEAL'; cardId: CardId }
  | { kind: 'FORCED_DEAL'; cardId: CardId }
  | { kind: 'DEBT_COLLECTOR'; cardId: CardId }
  | { kind: 'RENT'; cardId: CardId };

export interface DragState {
  cardId: CardId;
  x: number;
  y: number;
  over: Destination | null;
}

/** Une carte en vol, de la main vers la zone où elle vient d'être jouée. */
export interface Flight {
  id: number;
  cardId: CardId;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** Où atterrit visuellement chaque intention portant une carte. */
function destinationOf(action: GameAction): Destination | null {
  switch (action.type) {
    case 'PLAY_MONEY':
      return 'BANK';
    case 'PLAY_PROPERTY':
    case 'MOVE_WILD':
      return 'PROPERTY';
    case 'PLAY_BUILDING':
    case 'PLAY_PASS_GO':
    case 'PLAY_DEAL_BREAKER':
    case 'PLAY_SLY_DEAL':
    case 'PLAY_FORCED_DEAL':
    case 'PLAY_DEBT_COLLECTOR':
    case 'PLAY_BIRTHDAY':
    case 'PLAY_RENT':
      return 'ACTION';
    default:
      return null;
  }
}

function center(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export interface PlayController {
  busy: boolean;
  error: string | null;
  clearError: () => void;

  /** Carte choisie au doigt : les zones de dépôt deviennent des boutons. */
  selected: CardId | null;
  select: (cardId: CardId | null) => void;

  drag: DragState | null;
  /** À brancher sur `onPointerDown` d'une carte de la main. */
  beginDrag: (cardId: CardId, e: React.PointerEvent) => void;
  registerZone: (d: Destination, el: HTMLElement | null) => void;
  /** Position des cartes en main, pour faire partir le vol du bon endroit. */
  registerCard: (cardId: CardId, el: HTMLElement | null) => void;
  flights: Flight[];
  endFlight: (id: number) => void;

  prompt: Prompt | null;
  closePrompt: () => void;

  /** Envoie une intention brute (fin de tour, défausse, paiement, refus…). */
  send: (action: GameAction) => Promise<boolean>;
  /** Achemine une carte vers une destination, en posant les questions utiles. */
  play: (cardId: CardId, destination: Destination) => void;
  /** Déplacement gratuit d'un joker déjà posé. */
  moveWild: (cardId: CardId) => void;
}

const DRAG_THRESHOLD = 6;

export function usePlayController(
  code: string,
  playerId: string,
  refresh: () => Promise<void>,
): PlayController {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CardId | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  const [flights, setFlights] = useState<Flight[]>([]);
  const zones = useRef<Partial<Record<Destination, HTMLElement>>>({});
  const cards = useRef<Record<CardId, HTMLElement>>({});
  const origin = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const flightSeq = useRef(0);

  const registerZone = useCallback((d: Destination, el: HTMLElement | null) => {
    if (el) zones.current[d] = el;
    else delete zones.current[d];
  }, []);

  const registerCard = useCallback((cardId: CardId, el: HTMLElement | null) => {
    if (el) cards.current[cardId] = el;
    else delete cards.current[cardId];
  }, []);

  const endFlight = useCallback((id: number) => {
    setFlights((cur) => cur.filter((f) => f.id !== id));
  }, []);

  /**
   * Lance le vol AVANT l'aller-retour serveur : la carte doit décoller au
   * geste, pas après la latence réseau. Si le coup est refusé, elle est encore
   * en main au rafraîchissement suivant.
   */
  const launchFlight = useCallback((action: GameAction) => {
    if (!('cardId' in action) || typeof action.cardId !== 'string') return;
    const dest = destinationOf(action);
    if (!dest) return;
    const cardEl = cards.current[action.cardId];
    const zoneEl = zones.current[dest];
    if (!cardEl || !zoneEl) return;
    const id = ++flightSeq.current;
    setFlights((cur) => [
      ...cur,
      { id, cardId: action.cardId as CardId, from: center(cardEl), to: center(zoneEl) },
    ]);
  }, []);

  const send = useCallback(
    async (action: GameAction): Promise<boolean> => {
      launchFlight(action);
      setBusy(true);
      setError(null);
      try {
        await api.sendAction(code, action);
        await refresh();
        return true;
      } catch (e) {
        // Les erreurs de règle du moteur arrivent en clair : on les montre.
        setError(e instanceof RequestError ? e.message : 'Coup impossible');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [code, refresh, launchFlight],
  );

  /**
   * Achemine une carte. Quand tout est déterminé, on envoie ; sinon on ouvre
   * la question correspondante et l'envoi se fera à la réponse.
   */
  const play = useCallback(
    (cardId: CardId, destination: Destination) => {
      setSelected(null);
      const card = getCard(cardId);

      if (destination === 'BANK') {
        void send({ type: 'PLAY_MONEY', playerId, cardId });
        return;
      }

      if (destination === 'PROPERTY') {
        const colors =
          card.kind === 'PROPERTY' ? [card.color] : null;
        // Une propriété classique n'a qu'une couleur : rien à demander.
        if (colors) {
          void send({ type: 'PLAY_PROPERTY', playerId, cardId, color: colors[0] });
        } else {
          setPrompt({ kind: 'COLOR', cardId, move: false });
        }
        return;
      }

      // destination === 'ACTION'
      if (isBuilding(cardId)) {
        setPrompt({ kind: 'BUILDING', cardId });
        return;
      }
      if (card.kind === 'RENT') {
        setPrompt({ kind: 'RENT', cardId });
        return;
      }
      if (card.kind === 'ACTION') {
        switch (card.action) {
          case 'PASS_GO':
            void send({ type: 'PLAY_PASS_GO', playerId, cardId });
            return;
          case 'BIRTHDAY':
            void send({ type: 'PLAY_BIRTHDAY', playerId, cardId });
            return;
          case 'DEAL_BREAKER':
            setPrompt({ kind: 'DEAL_BREAKER', cardId });
            return;
          case 'SLY_DEAL':
            setPrompt({ kind: 'SLY_DEAL', cardId });
            return;
          case 'FORCED_DEAL':
            setPrompt({ kind: 'FORCED_DEAL', cardId });
            return;
          case 'DEBT_COLLECTOR':
            setPrompt({ kind: 'DEBT_COLLECTOR', cardId });
            return;
          default:
            setError('Cette carte ne se joue pas ainsi');
        }
      }
    },
    [playerId, send],
  );

  const moveWild = useCallback((cardId: CardId) => {
    setPrompt({ kind: 'COLOR', cardId, move: true });
  }, []);

  /**
   * Rectangles des zones, relevés UNE FOIS au début du geste : les zones ne
   * bougent pas pendant un glisser, et `getBoundingClientRect` à chaque
   * `pointermove` force une reprise de mise en page à chaque image.
   */
  const zoneRects = useRef<Array<{ d: Destination; r: DOMRect }>>([]);

  const snapshotZones = useCallback((cardId: CardId) => {
    zoneRects.current = destinationsFor(cardId)
      .map((d) => {
        const el = zones.current[d];
        return el ? { d, r: el.getBoundingClientRect() } : null;
      })
      .filter((z): z is { d: Destination; r: DOMRect } => z !== null);
  }, []);

  const hitZone = useCallback((x: number, y: number): Destination | null => {
    for (const { d, r } of zoneRects.current) {
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return d;
    }
    return null;
  }, []);

  const beginDrag = useCallback(
    (cardId: CardId, e: React.PointerEvent) => {
      // Un clic droit ou un geste de défilement ne doit pas saisir une carte.
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      origin.current = { x: e.clientX, y: e.clientY, moved: false };
      snapshotZones(cardId);

      // Un doigt émet bien plus d'événements que l'écran n'affiche d'images.
      // Sans ce filtre, chaque `pointermove` déclenchait un rendu complet de la
      // table — c'est ce qui faisait ramer le glisser sur téléphone.
      let frame = 0;
      let last: { x: number; y: number } | null = null;

      const onMove = (ev: PointerEvent) => {
        const o = origin.current;
        if (!o) return;
        const far =
          Math.abs(ev.clientX - o.x) > DRAG_THRESHOLD ||
          Math.abs(ev.clientY - o.y) > DRAG_THRESHOLD;
        if (!o.moved && !far) return;
        o.moved = true;
        last = { x: ev.clientX, y: ev.clientY };
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (!last) return;
          setSelected(null);
          setDrag({ cardId, x: last.x, y: last.y, over: hitZone(last.x, last.y) });
        });
      };

      const onUp = (ev: PointerEvent) => {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        target.releasePointerCapture?.(ev.pointerId);
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', onUp);
        target.removeEventListener('pointercancel', onUp);
        const o = origin.current;
        origin.current = null;
        setDrag(null);
        if (!o) return;
        if (!o.moved) {
          // Simple tape : on sélectionne, les zones deviennent cliquables.
          setSelected((cur) => (cur === cardId ? null : cardId));
          return;
        }
        const zone = hitZone(ev.clientX, ev.clientY);
        if (zone) play(cardId, zone);
      };

      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', onUp);
      target.addEventListener('pointercancel', onUp);
    },
    [hitZone, snapshotZones, play],
  );

  return {
    busy,
    error,
    clearError: () => setError(null),
    selected,
    select: setSelected,
    drag,
    beginDrag,
    registerZone,
    registerCard,
    flights,
    endFlight,
    prompt,
    closePrompt: () => setPrompt(null),
    send,
    play,
    moveWild,
  };
}
