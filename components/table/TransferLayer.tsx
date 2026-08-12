/**
 * Les cartes qui changent de mains, montrées en vol.
 *
 * Jusqu'ici, un vol, un échange ou un paiement ne laissaient qu'une ligne dans
 * le journal : les cartes disparaissaient d'un plateau et réapparaissaient sur
 * un autre, entre deux rafraîchissements, sans que rien ne relie les deux. On
 * voyait le résultat, jamais le mouvement — et à trois adversaires, on ne
 * savait même pas qui avait pris à qui.
 *
 * Chaque joueur porte donc une ancre dans le DOM (`data-seat`), et ce calque
 * fait voyager la carte de l'une à l'autre. Purement décoratif : le calque ne
 * touche à rien, et `prefers-reduced-motion` le désactive entièrement.
 */

'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { CardFace } from '@/components/cards/CardFace';
import type { CardId, GameEvent } from '@/lib/engine';
import { COUCHE } from '@/lib/ui/couches';

/** Durée d'un vol. Assez lent pour être suivi de l'œil, assez court pour ne pas retenir le tour. */
const VOL_MS = 520;
/** Décalage entre deux cartes d'un même paiement. */
const ECART_MS = 70;
/** Au-delà, un gros paiement transformerait la table en feu d'artifice. */
const MAX_CARTES = 4;

interface Vol {
  id: number;
  cardId: CardId;
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

/** Ce qu'un événement fait voyager, et entre qui. */
function transferts(e: GameEvent): Array<{ from: string; to: string; cards: CardId[] }> {
  switch (e.t) {
    case 'CARDS_STOLEN':
      return [{ from: e.fromId, to: e.toId, cards: e.cardIds }];
    case 'PAID':
      return [{ from: e.fromId, to: e.toId, cards: e.cardIds }];
    case 'CARDS_SWAPPED':
      // Un échange, c'est deux vols croisés : c'est ce croisement qu'il faut voir.
      return [
        { from: e.aId, to: e.bId, cards: [e.aCardId] },
        { from: e.bId, to: e.aId, cards: [e.bCardId] },
      ];
    default:
      return [];
  }
}

export function TransferLayer({
  events,
  width,
}: {
  events: GameEvent[];
  /** Largeur de la carte en vol : celle des lots, pas celle de la main. */
  width: number;
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
      for (const t of transferts(e)) {
        const from = ancre(t.from);
        const to = ancre(t.to);
        if (!from || !to) continue;
        t.cards.slice(0, MAX_CARTES).forEach((cardId, i) => {
          nouveaux.push({ id: ++seq.current, cardId, from, to, retard: i * ECART_MS });
        });
      }
    }
    if (nouveaux.length === 0) return;
    setVols((cur) => [...cur, ...nouveaux]);
  }, [events, reduced]);

  const fini = (id: number) => setVols((cur) => cur.filter((v) => v.id !== id));

  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: COUCHE.narration }}
      aria-hidden
    >
      <AnimatePresence>
        {vols.map((v) => (
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
        ))}
      </AnimatePresence>
    </div>
  );
}
