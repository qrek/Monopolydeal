/**
 * Main du joueur, en éventail. Le pas et l'angle sont calculés d'après la
 * largeur disponible : à 375 px comme à 1200 px, la main tient sans déborder et
 * chaque carte reste identifiable.
 *
 * Étape 4 : rendu statique. Le glisser-déposer arrive à l'étape 5.
 */

'use client';

import { useEffect, useRef, useState } from 'react';

import { CardFace } from '@/components/cards/CardFace';
import type { CardId } from '@/lib/engine';

const CARD_WIDTH = 96;
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.4);
/** Écartement maximum entre deux cartes ; en dessous, elles se chevauchent. */
const MAX_STEP = 62;
const MIN_STEP = 26;
/** Inclinaison de la carte la plus excentrée, en degrés. */
const MAX_TILT = 6;
/** Relèvement des cartes de bord, qui donne la courbe de l'éventail. */
const MAX_LIFT = 10;

/**
 * Une carte inclinée déborde de sa boîte : on réserve la marge correspondante
 * de chaque côté, sinon l'éventail sort de l'écran à 375 px.
 */
const RAD = (MAX_TILT * Math.PI) / 180;
const SIDE_BLEED = Math.ceil(
  (CARD_HEIGHT * Math.sin(RAD) + CARD_WIDTH * Math.cos(RAD) - CARD_WIDTH) / 2,
);
const TOP_BLEED = Math.ceil(
  CARD_WIDTH * Math.sin(RAD) + CARD_HEIGHT * Math.cos(RAD) - CARD_HEIGHT,
);

function useAvailableWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(360);

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

export function HandFan({ cards }: { cards: CardId[] }) {
  const [ref, available] = useAvailableWidth();
  const count = cards.length;

  // Pas idéal : tout étalé. Sinon on resserre jusqu'à tenir dans la largeur,
  // débordement d'inclinaison déduit.
  const usable = available - 2 * SIDE_BLEED;
  const fitted = count > 1 ? (usable - CARD_WIDTH) / (count - 1) : MAX_STEP;
  const step = Math.max(MIN_STEP, Math.min(MAX_STEP, fitted));
  const spread = CARD_WIDTH + step * Math.max(0, count - 1);
  const height = CARD_HEIGHT + TOP_BLEED + MAX_LIFT;

  return (
    <div ref={ref} className="w-full">
      {count === 0 ? (
        <p className="py-6 text-center text-xs text-muted">Main vide</p>
      ) : (
        <div className="relative mx-auto" style={{ width: spread, height }}>
          {cards.map((id, i) => {
            // -1 à gauche, +1 à droite : l'éventail s'ouvre depuis le centre.
            const offset = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
            return (
              <div
                key={id}
                className="absolute bottom-0 origin-bottom transition-transform duration-200"
                style={{
                  left: i * step,
                  zIndex: i,
                  // Le centre monte, les bords restent bas : l'arc se forme
                  // vers le haut, jamais sous le bord de l'écran.
                  transform: `rotate(${offset * MAX_TILT}deg) translateY(${
                    -(1 - Math.abs(offset)) * MAX_LIFT
                  }px)`,
                }}
              >
                <CardFace cardId={id} width={CARD_WIDTH} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
