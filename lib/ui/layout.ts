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

// --- Géométrie de l'éventail ------------------------------------------------
// Partagée entre la main (qui la dessine) et le pied (qui la loge) : deux
// valeurs séparées finissaient par diverger et réservaient du vide sous mes
// propriétés.

/** Inclinaison de la carte la plus excentrée, en degrés. */
export const FAN_TILT = 10;
/** Relèvement de la carte centrale : c'est lui qui creuse l'arc. */
export const FAN_LIFT = 15;

/**
 * Débordement vers le BAS d'une carte pivotée autour de son bord inférieur :
 * ses coins bas descendent sous la ligne de base. Sans cette réserve, l'arc
 * poussait les coins des cartes de bord hors de l'écran.
 */
export function fanBottomBleed(cardWidth: number): number {
  const rad = (FAN_TILT * Math.PI) / 180;
  return Math.ceil((cardWidth / 2) * Math.sin(rad));
}

/** Débordement d'une carte inclinée, de chaque côté. */
export function fanSideBleed(cardWidth: number): number {
  const h = cardWidth * CARD_RATIO;
  const rad = (FAN_TILT * Math.PI) / 180;
  return Math.ceil((h * Math.sin(rad) + cardWidth * Math.cos(rad) - cardWidth) / 2);
}

/** Hauteur réelle de l'éventail, arc et inclinaison compris. */
export function fanHeight(cardWidth: number): number {
  const h = Math.round(cardWidth * CARD_RATIO);
  const rad = (FAN_TILT * Math.PI) / 180;
  const topBleed = Math.ceil(cardWidth * Math.sin(rad) + h * Math.cos(rad) - h);
  return h + topBleed + FAN_LIFT + fanBottomBleed(cardWidth);
}

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
 * Mes cartes posées, au plus grand : une fraction des cartes en main. Mon
 * plateau ne doit ni voler la vedette à ce que je tiens, ni écraser la bande
 * adverse — c'est là qu'on lit ce qui menace, et un lot qui avance chez le
 * voisin compte autant que le sien.
 */
const MINE_CAP_RATIO = 0.6;
/** Les lots adverses, eux, restent plus petits que les miens. */
const OPPONENT_CAP_RATIO = 0.75;

/** Hauteur naturelle d'un empilement de lots, à une largeur de carte donnée. */
function stackHeight(cardWidth: number): number {
  return Math.round(cardWidth * CARD_RATIO) + MAX_STACK_GAPS * MIN_STACK_STEP;
}

/**
 * Répartition de la hauteur. La main sert d'abord, MON plateau ensuite ; les
 * adversaires ne prennent que ce qu'ils montrent vraiment.
 *
 * C'était l'inverse, et le résultat se voyait : la bande adverse s'étirait sur
 * une centaine de pixels de vide pendant que mes propriétés et ma banque
 * restaient minuscules, tassées en bas.
 */
export function bandHeights(scale: TableScale, viewportHeight: number): Bands {
  // Le pied ne loge que la carte et une petite marge : l'arc de l'éventail
  // déborde vers le HAUT, dans le tapis vide au-dessus de la main. Réserver sa
  // hauteur complète ici repoussait mes propriétés et ma banque loin des cartes
  // pour rien.
  const hand =
    Math.round(scale.hand * CARD_RATIO) + fanBottomBleed(scale.hand) + 12;

  const middle = Math.max(60, viewportHeight - HEADER - hand - GAPS);

  // Mon plateau prend sa part, plafonnée : au-delà mes cartes ne grandiraient
  // plus (voir `useTable`) et la bande n'ajouterait que du vide.
  const mineStack = Math.min(
    stackHeight(Math.round(scale.hand * MINE_CAP_RATIO)),
    Math.max(
      stackHeight(scale.mine),
      middle - (OPPONENT_CHROME + stackHeight(scale.opponent)) - MINE_LABEL,
    ),
  );

  // Tout le reste va aux adversaires, au lieu de rester en vide au milieu.
  const opponentStack = Math.min(
    stackHeight(Math.round(scale.hand * MINE_CAP_RATIO * OPPONENT_CAP_RATIO)),
    Math.max(
      stackHeight(scale.opponent),
      middle - MINE_LABEL - mineStack - OPPONENT_CHROME,
    ),
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
  const base = scaleFor(viewport.height);
  const bands = bandHeights(base, viewport.height);

  // Les cartes posées remplissent la bande qui leur revient, au lieu de
  // flotter au milieu d'un vide.
  const fill = (stack: number, floor: number, cap: number): number =>
    Math.min(
      cap,
      Math.max(floor, Math.floor((stack - MAX_STACK_GAPS * MIN_STACK_STEP) / CARD_RATIO)),
    );

  const mine = fill(bands.mineStack, base.mine, Math.round(base.hand * MINE_CAP_RATIO));
  const opponent = fill(
    bands.opponentStack,
    base.opponent,
    Math.round(base.hand * MINE_CAP_RATIO * OPPONENT_CAP_RATIO),
  );

  return { scale: { ...base, mine, opponent }, bands, viewport };
}
