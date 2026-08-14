/**
 * Les cartes qui bougent, montrées en mouvement.
 *
 * Jusqu'ici, un vol, un échange ou un paiement ne laissaient qu'une ligne dans
 * le journal : les cartes disparaissaient d'un plateau et réapparaissaient sur
 * un autre, entre deux rafraîchissements, sans que rien ne relie les deux. On
 * voyait le résultat, jamais le mouvement — et à trois adversaires, on ne
 * savait même pas qui avait pris à qui.
 *
 * Deux gestes, donc deux animations. Le VOL relie deux joueurs : la carte
 * traverse la table de l'un à l'autre. La POSE n'a qu'un destinataire — une
 * propriété qu'on étale devant soi — et se joue sur place : la carte tombe de
 * quelques pixels, plus grande que nature, puis s'efface en découvrant la vraie
 * carte déjà rendue dessous. C'est ce qui manquait le plus : un adversaire
 * complétait un lot sans que rien ne bouge à l'écran.
 *
 * Chaque joueur porte une ancre dans le DOM (`data-seat`). Purement décoratif :
 * le calque ne touche à rien, et `prefers-reduced-motion` le désactive.
 */

'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { CardFace } from '@/components/cards/CardFace';
import type { CardId, Color, GameEvent } from '@/lib/engine';
import { COUCHE } from '@/lib/ui/couches';

/** Durée d'un vol. Assez lent pour être suivi de l'œil, assez court pour ne pas retenir le tour. */
const VOL_MS = 520;
/** Durée d'une pose : le geste est plus court, la carte ne traverse rien. */
const POSE_MS = 420;
/** Décalage entre deux cartes d'un même paiement. */
const ECART_MS = 70;
/** Au-delà, un gros paiement transformerait la table en feu d'artifice. */
const MAX_CARTES = 4;

type Geste = 'vol' | 'pose';

interface Vol {
  id: number;
  geste: Geste;
  cardId: CardId;
  /** Couleur du lot, pour qu'un joker bicolore se pose du bon côté. */
  orient?: Color;
  from: { x: number; y: number };
  to: { x: number; y: number };
  retard: number;
}

/** Centre de l'ancre d'un joueur, en coordonnées écran. */
function ancre(playerId: string): { x: number; y: number } | null {
  const el = document.querySelector(`[data-seat="${CSS.escape(playerId)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Ce qu'un événement fait bouger, chez qui, et de quelle manière. */
function mouvements(
  e: GameEvent,
): Array<{ geste: Geste; from: string; to: string; cards: CardId[]; orient?: Color }> {
  switch (e.t) {
    case 'CARDS_STOLEN':
      return [{ geste: 'vol', from: e.fromId, to: e.toId, cards: e.cardIds }];
    case 'PAID':
      return [{ geste: 'vol', from: e.fromId, to: e.toId, cards: e.cardIds }];
    case 'CARDS_SWAPPED':
      // Un échange, c'est deux vols croisés : c'est ce croisement qu'il faut voir.
      return [
        { geste: 'vol', from: e.aId, to: e.bId, cards: [e.aCardId] },
        { geste: 'vol', from: e.bId, to: e.aId, cards: [e.bCardId] },
      ];
    case 'PROPERTY_PLACED':
      return [
        { geste: 'pose', from: e.playerId, to: e.playerId, cards: [e.cardId], orient: e.color },
      ];
    case 'WILD_MOVED':
      // Un joker qui change de lot reste chez lui, mais il change de camp de
      // couleur : la pose le signale comme une propriété qu'on repose.
      return [
        { geste: 'pose', from: e.playerId, to: e.playerId, cards: [e.cardId], orient: e.color },
      ];
    default:
      return [];
  }
}

export function TransferLayer({
  events,
  width,
  viewerId,
}: {
  events: GameEvent[];
  /** Largeur de la carte en vol : celle des lots, pas celle de la main. */
  width: number;
  /**
   * Mes propres poses sont déjà animées par le vol de la main vers la zone,
   * lancé au geste sans attendre le serveur. Les rejouer ici ferait deux
   * fantômes de la même carte, en partie superposés.
   */
  viewerId: string;
}) {
  const reduced = useReducedMotion();
  const [vols, setVols] = useState<Vol[]>([]);
  const vu = useRef<number | null>(null);
  const seq = useRef(0);

  // Repère posé au montage : on ne rejoue pas l'historique d'une partie déjà
  // commencée. Une table vide part de -1, sinon le tout premier vol de la
  // partie servirait de repère au lieu d'être montré.
  useEffect(() => {
    const dernier = events[events.length - 1];
    vu.current = dernier ? dernier.seq : -1;
    // Au montage seulement : `events` change à chaque coup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const dernier = events[events.length - 1];
    if (!dernier || vu.current === null) return;
    if (dernier.seq <= vu.current) return;
    const depuis = vu.current;
    vu.current = dernier.seq;
    if (reduced) return;

    const nouveaux: Vol[] = [];
    for (const e of events.filter((x) => x.seq > depuis)) {
      for (const t of mouvements(e)) {
        if (t.geste === 'pose' && t.to === viewerId) continue;
        const from = ancre(t.from);
        const to = ancre(t.to);
        if (!from || !to) continue;
        t.cards.slice(0, MAX_CARTES).forEach((cardId, i) => {
          nouveaux.push({
            id: ++seq.current,
            geste: t.geste,
            cardId,
            orient: t.orient,
            from,
            to,
            retard: i * ECART_MS,
          });
        });
      }
    }
    if (nouveaux.length === 0) return;
    setVols((cur) => [...cur, ...nouveaux]);
  }, [events, reduced, viewerId]);

  const fini = (id: number) => setVols((cur) => cur.filter((v) => v.id !== id));

  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: COUCHE.narration }}
      aria-hidden
    >
      <AnimatePresence>
        {vols.map((v) =>
          v.geste === 'pose' ? (
            <motion.div
              key={v.id}
              className="absolute"
              style={{ left: -width / 2, top: -width * 0.7 }}
              initial={{ x: v.to.x, y: v.to.y - 26, scale: 1.35, opacity: 0, rotate: -6 }}
              animate={{
                x: v.to.x,
                y: [v.to.y - 26, v.to.y, v.to.y],
                scale: [1.35, 1, 1],
                opacity: [0, 1, 0],
                rotate: [-6, 0, 0],
              }}
              transition={{
                duration: (v.retard + POSE_MS) / 1000,
                times: [0, 0.62, 1],
                ease: [0.22, 1, 0.36, 1],
                delay: v.retard / 1000,
              }}
              onAnimationComplete={() => fini(v.id)}
            >
              <CardFace cardId={v.cardId} width={width} orient={v.orient} />
            </motion.div>
          ) : (
            <motion.div
              key={v.id}
              className="absolute"
              style={{ left: -width / 2, top: -width * 0.7 }}
              initial={{ x: v.from.x, y: v.from.y, scale: 0.7, opacity: 0, rotate: -8 }}
              animate={{
                x: [v.from.x, v.from.x, v.to.x],
                y: [v.from.y, v.from.y, v.to.y],
                scale: [0.7, 1, 0.75],
                opacity: [0, 1, 0],
                rotate: [-8, 0, 8],
              }}
              transition={{
                duration: (v.retard + VOL_MS) / 1000,
                times: [0, v.retard / (v.retard + VOL_MS), 1],
                ease: [0.32, 0, 0.2, 1],
              }}
              onAnimationComplete={() => fini(v.id)}
            >
              <CardFace cardId={v.cardId} width={width} />
            </motion.div>
          ),
        )}
      </AnimatePresence>
    </div>
  );
}
