/**
 * Retour haptique.
 *
 * Sur un téléphone, une vibration de vingt millisecondes au moment où la carte
 * se pose confirme le geste avant même que le serveur réponde — ce qu'aucune
 * animation ne fait aussi vite. Les motifs restent courts et rares : une
 * vibration qu'on remarque est une vibration de trop.
 *
 * Silencieux là où l'API n'existe pas, ce qui inclut tout iOS. Ce n'est pas une
 * raison de s'en passer : le jeu s'installe aussi sur Android, et rien ici ne
 * dépend du retour.
 */

'use client';

/** Les seuls motifs du jeu. Un vocabulaire court se reconnaît. */
const MOTIFS = {
  /** Une carte quitte la main et se pose. */
  pose: [18],
  /** Mon tour commence. */
  tour: [30, 60, 30],
  /** On me prend quelque chose. */
  perte: [40, 50, 40],
  /** J'encaisse. */
  gain: [12, 40, 22],
  /** Coup refusé par le moteur. */
  refus: [50],
} as const;

export type Motif = keyof typeof MOTIFS;

/** Réglage retenu entre deux parties ; muet est un choix qu'on ne réexplique pas. */
const CLE = 'haptique';

export function haptiqueActive(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(CLE) !== 'off';
}

export function setHaptique(actif: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CLE, actif ? 'on' : 'off');
}

export function vibrer(motif: Motif): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  if (!haptiqueActive()) return;
  try {
    navigator.vibrate([...MOTIFS[motif]]);
  } catch {
    // Certains navigateurs refusent hors interaction utilisateur : sans effet.
  }
}
