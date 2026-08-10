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
import { destinationsFor } from '@/lib/ui/legal';

const MAX_TILT = 6;
const MAX_LIFT = 10;
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

  const cardHeight = Math.round(cardWidth * 1.4);
  const rad = (MAX_TILT * Math.PI) / 180;
  // Une carte inclinée déborde de sa boîte : on réserve la marge de chaque côté.
  const sideBleed = Math.ceil(
    (cardHeight * Math.sin(rad) + cardWidth * Math.cos(rad) - cardWidth) / 2,
  );
  const topBleed = Math.ceil(
    cardWidth * Math.sin(rad) + cardHeight * Math.cos(rad) - cardHeight,
  );

  const usable = Math.max(cardWidth, available - 2 * sideBleed);
  const maxStep = cardWidth * 0.66;
  const fitted = count > 1 ? (usable - cardWidth) / (count - 1) : maxStep;
  const step = Math.max(cardWidth * MIN_STEP_RATIO, Math.min(maxStep, fitted));
  const spread = cardWidth + step * Math.max(0, count - 1);
  const height = cardHeight + topBleed + MAX_LIFT;

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
                  layout
                  // Une carte piochée arrive en se retournant.
                  initial={{ rotateY: 90, opacity: 0, y: 20 }}
                  animate={{ rotateY: 0, opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -24, scale: 0.9 }}
                  transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                  className={`absolute bottom-0 origin-bottom touch-none ${
                    usableCard ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                  } ${ctl.drag?.cardId === id ? 'opacity-30' : ''}`}
                  style={{
                    left: i * step,
                    zIndex: chosen ? 100 : i,
                    transform: `rotate(${offset * MAX_TILT}deg) translateY(${
                      -(1 - Math.abs(offset)) * MAX_LIFT - (chosen ? 18 : 0)
                    }px)`,
                  }}
                  onPointerDown={(e) => {
                    if (usableCard) ctl.beginDrag(id, e);
                  }}
                >
                  <div
                    className={
                      chosen
                        ? 'rounded-card ring-4 ring-mono-red transition-shadow duration-200'
                        : ''
                    }
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
