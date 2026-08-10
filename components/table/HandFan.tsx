/**
 * Main du joueur, en éventail. Le pas et l'inclinaison se calculent d'après la
 * largeur réellement disponible, débordement d'inclinaison compris, pour que
 * l'éventail tienne à l'écran sans rogner une carte.
 *
 * Une carte se joue de deux façons : on la traîne sur une zone, ou on la tape
 * puis on tape la zone. Le second geste est le seul praticable au pouce.
 */

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { CardFace } from '@/components/cards/CardFace';
import type { PlayController } from '@/components/play/usePlayController';
import type { CardId } from '@/lib/engine';
import {
  FAN_LIFT,
  FAN_TILT,
  fanBottomBleed,
  fanHeight,
  fanSideBleed,
} from '@/lib/ui/layout';
import { destinationsFor } from '@/lib/ui/legal';
import { SPRING } from '@/lib/ui/motion';

const MIN_STEP_RATIO = 0.3;

function useAvailableWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

export function HandFan({
  cards,
  cardWidth,
  ctl,
  playable,
}: {
  cards: CardId[];
  cardWidth: number;
  ctl: PlayController;
  /** Mon tour, phase de jeu : sinon la main reste consultable mais inerte. */
  playable: boolean;
}) {
  const [ref, available] = useAvailableWidth();
  const count = cards.length;

  // Une carte inclinée déborde de sa boîte : on réserve la marge de chaque côté.
  const sideBleed = fanSideBleed(cardWidth);
  const usable = Math.max(cardWidth, available - 2 * sideBleed);
  const maxStep = cardWidth * 0.66;
  const fitted = count > 1 ? (usable - cardWidth) / (count - 1) : maxStep;
  const step = Math.max(cardWidth * MIN_STEP_RATIO, Math.min(maxStep, fitted));
  const spread = cardWidth + step * Math.max(0, count - 1);
  const height = fanHeight(cardWidth);
  // Les cartes reposent au-dessus de la réserve basse : leurs coins pivotés
  // descendent dedans au lieu de sortir de l'écran.
  const baseline = fanBottomBleed(cardWidth);

  return (
    <div ref={ref} className="w-full">
      {count === 0 ? (
        <p className="py-4 text-center text-xs text-ink-soft">Main vide</p>
      ) : (
        <div className="relative mx-auto" style={{ width: spread, height }}>
          <AnimatePresence initial={false}>
            {cards.map((id, i) => {
              const offset = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
              const chosen = ctl.selected === id;
              const usableCard = playable && destinationsFor(id).length > 0;
              return (
                <motion.div
                  key={id}
                  ref={(el) => ctl.registerCard(id, el)}
                  // L'inclinaison et le relèvement passent par Framer Motion et
                  // non par `style.transform` : Motion écrit sur la même
                  // propriété et remettait l'éventail à plat dès la fin de
                  // l'animation d'entrée.
                  initial={{ rotateY: 90, opacity: 0, y: 26, rotate: 0 }}
                  animate={{
                    rotateY: 0,
                    opacity: ctl.drag?.cardId === id ? 0.25 : 1,
                    rotate: offset * FAN_TILT,
                    // Parabole et non pente : le sommet est arrondi, comme
                    // des cartes tenues en main plutôt qu'alignées sur un toit.
                    y: -(1 - offset * offset) * FAN_LIFT - (chosen ? 20 : 0),
                    scale: chosen ? 1.06 : 1,
                  }}
                  exit={{ opacity: 0, y: -28, scale: 0.88 }}
                  transition={SPRING}
                  className={`absolute origin-bottom touch-none ${
                    usableCard ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                  } ${ctl.drag?.cardId === id ? 'will-change-transform' : ''}`}
                  style={{ left: i * step, bottom: baseline, zIndex: chosen ? 100 : i }}
                  onPointerDown={(e) => {
                    if (usableCard) ctl.beginDrag(id, e);
                  }}
                >
                  {/* Ombre portée sur l'enveloppe et non sur la carte : elle
                      épouse le coin arrondi et se peint derrière, sans
                      s'ajouter au filet noir de la face. */}
                  <div
                    className={`rounded-card shadow-hand ${
                      chosen ? 'ring-4 ring-mono-red' : ''
                    }`}
                  >
                    <CardFace cardId={id} width={cardWidth} />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
