/**
 * Abonnement Realtime d'une partie. Le client ne reçoit jamais d'état par ce
 * canal : il apprend seulement que la version a changé, et refetch la vue
 * filtrée via l'API. Le serveur reste la seule source de vérité.
 *
 * On écoute une diffusion (« broadcast ») émise par le serveur après chaque
 * écriture, et non les `postgres_changes` de la table `games` : mesuré sur le
 * déploiement, le flux de réplication cessait de livrer après deux événements
 * alors que le canal se déclarait toujours `joined`. Le joueur d'en face ne
 * voyait alors plus rien jusqu'à ce qu'il agisse lui-même — c'est ce qui
 * donnait ce long silence entre deux tours.
 *
 * Deux filets sous le canal, car une partie ne doit jamais rester figée :
 *   — un rappel périodique discret,
 *   — un rappel au retour de l'onglet au premier plan (le canal meurt souvent
 *     quand le téléphone se verrouille).
 */

'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';

import { browserClient } from '@/lib/supabase/client';

export interface GameSubscription {
  unsubscribe: () => void;
}

/**
 * Filet de sécurité derrière le Broadcast : assez court pour sauver un tour,
 * assez lâche pour ne pas peser. Il ne bat vite que quand il peut servir.
 */
const POLL_MS = 5000;
/** Partie terminée : plus rien ne bougera, le rappel n'a plus d'objet. */
const POLL_OFF = 0;

/** Ce que le filet doit savoir de la partie pour régler son rythme. */
export interface PollHint {
  /** La partie est finie : on relit un résumé, pas une table vivante. */
  over: boolean;
}

export function subscribeToGame(
  gameId: string,
  onChange: () => void,
  hint?: () => PollHint,
): GameSubscription {
  const supabase = browserClient();

  const channel: RealtimeChannel = supabase
    .channel(`game-${gameId}`)
    .on('broadcast', { event: 'sync' }, () => onChange())
    .subscribe();

  const poll = setInterval(() => {
    // Inutile de recharger une table que personne ne regarde…
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    // …ni une partie qui ne bougera plus.
    if (hint?.().over) return;
    onChange();
  }, POLL_MS);

  const onVisible = () => {
    if (document.visibilityState === 'visible') onChange();
  };
  document.addEventListener('visibilitychange', onVisible);

  return {
    unsubscribe: () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    },
  };
}
