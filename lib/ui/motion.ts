/**
 * Réglages d'animation partagés.
 *
 * Deux familles seulement : un ressort pour ce que le joueur manipule (la main,
 * les cartes qu'on saisit), une durée fixe pour ce que le jeu annonce (bandeaux,
 * cartes qui volent). Le ressort donne le poids, la durée donne le rythme.
 *
 * Tout reste dans la fenêtre 200–300 ms, et n'anime que `transform` et
 * `opacity` — les seules propriétés que le compositeur traite sans repasser par
 * la mise en page, ce qui compte sur un téléphone.
 */

import type { Transition } from 'framer-motion';

/** Ce que le doigt déplace : réponse immédiate, arrêt net, pas de rebond mou. */
export const SPRING: Transition = {
  type: 'spring',
  stiffness: 460,
  damping: 34,
  mass: 0.7,
};

/** Ce que le jeu annonce. */
export const EASE_OUT: Transition = {
  duration: 0.26,
  ease: [0.22, 1, 0.36, 1],
};

export const EASE_IN_OUT: Transition = {
  duration: 0.22,
  ease: [0.4, 0, 0.2, 1],
};

/** Durées d'affichage des messages de table, en millisecondes. */
export const CUE_MS = 1500;
export const TURN_BANNER_MS = 1300;
export const FLOAT_MS = 1200;
