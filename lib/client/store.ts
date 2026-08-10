/**
 * Store Zustand : cache client de la vue serveur + plomberie de synchro.
 * Jamais une source de vérité — tout est dérivé de GET /api/games/[code],
 * rafraîchi quand le Realtime signale un changement de version.
 */

'use client';

import { create } from 'zustand';

import { api, RequestError } from '@/lib/client/api';
import { subscribeToGame, type GameSubscription } from '@/lib/client/realtime';
import type { GameView } from '@/lib/server/games';
import { ensureSession } from '@/lib/supabase/client';

interface GameStore {
  view: GameView | null;
  code: string | null;
  loading: boolean;
  error: string | null;
  /** Rejoint (ou re-rejoint) la partie puis maintient la vue à jour. */
  connect: (code: string, name: string) => Promise<void>;
  refresh: () => Promise<void>;
  disconnect: () => void;
}

let subscription: GameSubscription | null = null;

export const useGameStore = create<GameStore>((set, get) => ({
  view: null,
  code: null,
  loading: false,
  error: null,

  connect: async (code, name) => {
    set({ loading: true, error: null, code });
    try {
      await ensureSession();
      const { gameId } = await api.joinGame(code, name);
      const view = await api.getView(code);
      subscription?.unsubscribe();
      subscription = subscribeToGame(gameId, () => {
        void get().refresh();
      });
      set({ view, loading: false });
    } catch (e) {
      const message =
        e instanceof RequestError ? e.message : 'Connexion impossible';
      set({ error: message, loading: false });
      throw e;
    }
  },

  refresh: async () => {
    const code = get().code;
    if (!code) return;
    try {
      const view = await api.getView(code);
      set({ view });
    } catch {
      // Erreur transitoire : le prochain événement Realtime relancera un fetch.
    }
  },

  disconnect: () => {
    subscription?.unsubscribe();
    subscription = null;
    set({ view: null, code: null, error: null });
  },
}));
