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

import { useCallback, useEffect, useRef, useState } from 'react';

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

/**
 * Part de la carte en main qui reste au-dessus du bord de l'écran.
 *
 * Le bas d'une carte ne porte rien qui l'identifie : la valeur est en haut à
 * gauche, le nom de rue sur le bandeau, le pictogramme au milieu. On laisse
 * donc le pied de l'éventail passer sous le bord, et l'appui long donne le
 * détail complet quand on en a besoin. Une trentaine de pixels rendus au reste
 * de la table, là où la hauteur est la ressource rare.
 */
const HAND_VISIBLE = 0.8;

/** De combien l'éventail descend sous le bord bas. */
export function handSink(cardWidth: number): number {
  return Math.round(cardWidth * CARD_RATIO * (1 - HAND_VISIBLE));
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
const MINE_CAP_RATIO = 0.68;
/** Les lots adverses, eux, restent un peu plus petits que les miens. */
const OPPONENT_CAP_RATIO = 0.88;

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
    Math.round(scale.hand * CARD_RATIO) -
    handSink(scale.hand) +
    fanBottomBleed(scale.hand) +
    12;

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

// --- Ajustement en largeur ---------------------------------------------------
// La hauteur fixe une taille de carte confortable ; encore faut-il que le
// contenu tienne EN LARGEUR. Un joueur en fin de partie aligne cinq ou six lots
// et une dizaine de billets : à taille fixe, les lots débordaient dans un
// défilement qu'on ne voyait pas, et la banque mangeait un tiers de l'écran.

/** Écart entre deux lots posés côte à côte. */
const GROUP_GAP = 6;
/**
 * Plancher de rétrécissement. À 22 px une carte n'est plus qu'un bandeau de
 * couleur surmonté de sa pastille d'avancement — c'est peu, mais on voit
 * encore QUE le lot existe et où il en est, alors qu'au-delà il disparaissait
 * purement et simplement dans un défilement sans barre.
 */
const MIN_CARD = 22;
/** Recouvrement des billets : au-delà, le montant centré serait rogné. */
const BANK_REVEAL = 0.62;

/** Largeur de carte qui fait tenir `count` lots côte à côte dans `available`. */
export function fitGroups(available: number, count: number, max: number): number {
  if (count <= 1) return max;
  const each = Math.floor((available - GROUP_GAP * (count - 1)) / count);
  return Math.max(MIN_CARD, Math.min(max, each));
}

/**
 * Largeur de billet qui fait tenir une banque de `count` cartes. On rétrécit la
 * carte plutôt que de resserrer l'éventail : le montant est centré sur le
 * billet, un recouvrement plus fort le couperait en deux.
 */
export function fitBank(available: number, count: number, max: number): number {
  if (count <= 1) return max;
  const span = 1 + BANK_REVEAL * (count - 1);
  return Math.max(MIN_CARD, Math.min(max, Math.floor(available / span)));
}

/**
 * Largeur réellement offerte par un élément.
 *
 * Déduire la place disponible de `window.innerWidth` moins une marge supposée
 * ne marche que sur un écran rectangulaire. Sur un téléphone à encoche tenu en
 * paysage, `env(safe-area-inset-left/right)` réserve une cinquantaine de
 * pixels de chaque côté au lieu des huit attendus : la centaine de pixels
 * manquante retombait entièrement sur mes propriétés, qui débordaient d'un lot
 * entier sans que rien ne le montre. On mesure donc, au lieu de deviner.
 */
export function useMeasuredWidth(
  fallback: number,
): [(el: HTMLElement | null) => void, number] {
  const [width, setWidth] = useState(0);
  const node = useRef<HTMLElement | null>(null);

  const read = useCallback(() => {
    const el = node.current;
    if (el) setWidth(el.clientWidth);
  }, []);

  const ref = useCallback(
    (el: HTMLElement | null) => {
      node.current = el;
      read();
    },
    [read],
  );

  useEffect(() => {
    const el = node.current;
    if (!el) return;
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [read]);

  // Avant la première mesure — le rendu serveur, puis la première frame — on
  // se rabat sur l'estimation, qui n'est fausse que sur les écrans à encoche.
  return [ref, width > 0 ? width : fallback];
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
