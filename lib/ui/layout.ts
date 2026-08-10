/**
 * Le jeu se joue en paysage : la contrainte n'est plus la largeur mais la
 * HAUTEUR disponible, qui doit loger d'un seul tenant la rangée d'adversaires,
 * mon plateau et ma main. Toutes les tailles de carte en découlent.
 */

'use client';

import { useEffect, useState } from 'react';

export interface TableScale {
  /** Cartes de la main, en bas. */
  hand: number;
  /** Mes lots et ma banque. */
  mine: number;
  /** Lots des adversaires. */
  opponent: number;
  /** Pioche et défausse. */
  pile: number;
}

/** Interpolation bornée entre deux paliers de hauteur d'écran. */
function between(h: number, lo: number, hi: number, a: number, b: number): number {
  if (h <= lo) return a;
  if (h >= hi) return b;
  return Math.round(a + ((h - lo) / (hi - lo)) * (b - a));
}

/**
 * Paliers calés sur les deux cas réels : un téléphone en paysage (375 px de
 * haut) et un écran d'ordinateur (900 px). Entre les deux, tout glisse.
 */
export function scaleFor(height: number): TableScale {
  return {
    hand: between(height, 360, 900, 64, 124),
    mine: between(height, 360, 900, 36, 62),
    opponent: between(height, 360, 900, 24, 40),
    pile: between(height, 360, 900, 28, 46),
  };
}

/** Ratio hauteur/largeur d'une carte, partagé avec les faces. */
const CARD_RATIO = 1.4;

/** Libellé de section + marges du panneau (la pastille est en surimpression). */
const GROUP_CHROME = 28;
/** Recouvrement minimum entre deux cartes d'un même lot. */
const MIN_STACK_STEP = 4;

/**
 * Hauteurs réservées aux deux bandes fixes. Elles sont calculées et non
 * laissées au flux : sans cela, la main et les adversaires se partagent tout et
 * mon plateau s'écrase à zéro sur un téléphone en paysage.
 *
 * On réserve de quoi empiler un lot de Gares — 4 cartes, le plus haut du jeu —
 * sinon la pastille « 1/4 » passe sous le bord de la bande.
 */
export function bandHeights(scale: TableScale): {
  mine: number;
  hand: number;
  /** Hauteur utile laissée aux cartes d'un lot, hors libellé et pastille. */
  mineStack: number;
} {
  const stack = Math.round(scale.mine * CARD_RATIO) + 3 * MIN_STACK_STEP;
  return {
    mineStack: stack,
    mine: stack + GROUP_CHROME,
    // cartes + débordement d'inclinaison + marges
    hand: Math.round(scale.hand * CARD_RATIO) + 46,
  };
}

/** Place réellement disponible pour la rangée d'adversaires. */
export function opponentBand(
  viewportHeight: number,
  bands: { mine: number; hand: number },
): number {
  const HEADER = 32;
  const GAPS = 14;
  return Math.max(70, viewportHeight - HEADER - bands.mine - bands.hand - GAPS);
}

/** Hauteur laissée aux cartes dans une tuile adverse (en-tête et compteurs ôtés). */
export function opponentStack(band: number): number {
  // en-tête, ligne main/banque et marges — la pastille étant en surimpression
  const TILE_CHROME = 44;
  return Math.max(30, band - TILE_CHROME);
}

export interface Viewport {
  width: number;
  height: number;
  /** Téléphone tenu à la verticale : le jeu demande de tourner l'écran. */
  portraitPhone: boolean;
}

export function useViewport(): Viewport {
  const [v, setV] = useState<Viewport>({
    width: 812,
    height: 375,
    portraitPhone: false,
  });

  useEffect(() => {
    const read = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setV({
        width,
        height,
        // Un écran étroit ET plus haut que large : on est sur un téléphone
        // debout, la table n'y tient pas.
        portraitPhone: width < 700 && height > width,
      });
    };
    read();
    window.addEventListener('resize', read);
    window.addEventListener('orientationchange', read);
    return () => {
      window.removeEventListener('resize', read);
      window.removeEventListener('orientationchange', read);
    };
  }, []);

  return v;
}

export function useTableScale(): TableScale {
  const { height } = useViewport();
  return scaleFor(height);
}
