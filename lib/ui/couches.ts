/**
 * L'échelle des couches, en un seul endroit.
 *
 * Elles étaient réparties dans une douzaine de fichiers, chacun choisissant son
 * nombre au jugé — d'où des empilements faux : une carte relevée de l'éventail
 * passait par-dessus toutes les fenêtres, et l'animation d'un vol se peignait
 * sur les règles ouvertes. Un ordre n'existe que s'il est écrit quelque part.
 *
 * La règle de lecture : plus on monte, plus c'est passager. Le tapis est
 * permanent, la loupe dure le temps d'un appui.
 *
 * Deux pièges à connaître :
 *  - une couche ne vaut que dans son contexte d'empilement. Le pied de table
 *    est `isolate` : les z-index des cartes de la main y restent enfermés, au
 *    lieu de concourir avec les fenêtres.
 *  - `position` doit être autre que `static` pour qu'un z-index s'applique.
 */

export const COUCHE = {
  /** Feutre, marque en filigrane. */
  tapis: 0,
  /** Bandeau, plateaux, adversaires. */
  plateau: 10,
  /** Mon éventail et les boutons du pied. */
  main: 20,
  /** Ce que la table raconte : cartes en vol, transferts, retours de coup. */
  narration: 30,
  /** Tiroir du journal. */
  tiroir: 40,
  /** Fenêtres : règles, questions, paiement, refus, plateau adverse. */
  fenetre: 50,
  /** Résumé de fin de partie : il passe au-dessus de la fanfare. */
  resume: 70,
  /** Loupe : elle s'ouvre depuis une fenêtre, donc elle la dépasse. */
  loupe: 80,
  /** Invitation à tourner le téléphone : elle remplace la table. */
  rotation: 90,
} as const;
