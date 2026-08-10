/**
 * Abonnement Realtime d'une partie. Le client ne reçoit jamais d'état par ce
 * canal : il apprend seulement que `games.version` (ou le lobby) a changé, et
 * refetch la vue filtrée via l'API. Le serveur reste la seule source de vérité.
 */

'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';

import { browserClient } from '@/lib/supabase/client';

export interface GameSubscription {
  unsubscribe: () => void;
}

export function subscribeToGame(
  gameId: string,
  onChange: () => void,
): GameSubscription {
  const supabase = browserClient();
  const channel: RealtimeChannel = supabase
    .channel(`game-${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      },
      onChange,
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'game_players',
        filter: `game_id=eq.${gameId}`,
      },
      onChange,
    )
    .subscribe();
  return {
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}
