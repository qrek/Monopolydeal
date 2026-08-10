/**
 * Présence : tient `game_players.connected` à jour pour que la salle d'attente
 * distingue « parti » de « en train de recharger ». Purement cosmétique — la
 * reconnexion, elle, ne dépend que de la session anonyme et du join idempotent.
 */

'use client';

import { useEffect } from 'react';

import { api } from '@/lib/client/api';

/** `pagehide` ne laisse pas le temps à un fetch d'aboutir : on passe par un beacon. */
function beaconDisconnect(code: string): void {
  const body = new Blob([JSON.stringify({ type: 'SET_CONNECTED', connected: false })], {
    type: 'application/json',
  });
  navigator.sendBeacon?.(`/api/games/${code}/actions`, body);
}

export function usePresence(code: string | null, active: boolean): void {
  useEffect(() => {
    if (!code || !active) return;

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void api.setConnected(code, true).catch(() => {});
      }
    };
    const onPageHide = () => beaconDisconnect(code);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [code, active]);
}
