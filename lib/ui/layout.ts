/**
 * Le jeu se joue en paysage sur un téléphone : la contrainte n'est pas la
 * largeur mais la HAUTEUR, qui doit loger d'un seul tenant la rangée
 * d'adversaires, mon plateau et ma main.
 *
 * Tout part de la main. C'est la carte qu'on lit vraiment — nom de rue, grille
 * de loyers, texte de règle — donc elle prend sa part d'abord et les autres
 * bandes se partagent le reste. L'inverse donnait des cartes de 64 px où le nom
 * de rue tombait à 3,6 px : présent, mais illisible.
 */

'use client';

import { useEffect, useState } from 'react';

/** Ratio hauteur/largeur d'une carte, partagé avec les faces. */
const CARD_RATIO = 1.4;
/** Recouvrement minimum entre deux cartes d'un même lot. */
const MIN_STACK_STEP = 4;
/** Un lot de Gares compte 4 cartes : c'est lui qui fixe la hauteur d'une rangée. */
const MAX_STACK_GAPS = 3;

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
 * haut) et un grand écran (900 px). Entre les deux, tout glisse.
 */
export function scaleFor(height: number): TableScale {
  return {
    hand: between(height, 360, 900, 92, 132),
    mine: between(height, 360, 900, 36, 62),
    opponent: between(height, 360, 900, 24, 40),
    pile: between(height, 360, 900, 28, 46),
  };
}

export interface Bands {
  /** Hauteur du pied qui porte la main. */
  hand: number;
  /** Hauteur laissée aux cartes d'un de MES lots. */
  mineStack: number;
  /** Hauteur laissée aux cartes d'un lot adverse. */
  opponentStack: number;
}

const HEADER = 32;
/** Libellé de section au-dessus de mes lots. */
const MINE_LABEL = 16;
/** Ligne pseudo/argent d'un adversaire, plus les marges. */
const OPPONENT_CHROME = 30;
const GAPS = 10;

/**
 * Répartition de la hauteur. La main sert d'abord, puis mes lots ; les
 * adversaires prennent ce qui reste — c'est la bande la moins critique, on n'y
 * lit que des couleurs et un compteur.
 */
export function bandHeights(scale: TableScale, viewportHeight: number): Bands {
  const cardH = Math.round(scale.hand * CARD_RATIO);
  // cartes + relèvement de l'éventail + débordement d'inclinaison + marges
  const hand = cardH + 36;

  const mineStack =
    Math.round(scale.mine * CARD_RATIO) + MAX_STACK_GAPS * MIN_STACK_STEP;

  const middle = Math.max(60, viewportHeight - HEADER - hand - GAPS);
  const opponentStack = Math.max(
    Math.round(scale.opponent * CARD_RATIO),
    middle - (MINE_LABEL + mineStack) - OPPONENT_CHROME,
  );

  return { hand, mineStack, opponentStack };
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
        // Écran étroit ET plus haut que large : téléphone debout, la table n'y
        // tient pas.
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

export function useTable(): { scale: TableScale; bands: Bands; viewport: Viewport } {
  const viewport = useViewport();
  const scale = scaleFor(viewport.height);
  return { scale, bands: bandHeights(scale, viewport.height), viewport };
}
