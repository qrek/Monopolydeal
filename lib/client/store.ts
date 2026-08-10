/**
 * Store Zustand : cache client de la vue serveur + plomberie de synchro.
 * Jamais une source de vérité — tout est dérivé de GET /api/games/[code],
 * rafraîchi quand le Realtime signale un changement de version.
 *
 * Cycle de vie d'un écran de partie :
 *   attach(code)  → session anonyme, puis GET de la vue.
 *                   403 NOT_A_PLAYER ⇒ statut `needs-join` (formulaire pseudo).
 *   join(code, n) → POST join, puis attach.
 *   detach()      → coupe l'abonnement Realtime.
 */

'use client';

import { create } from 'zustand';

import { api, RequestError } from '@/lib/client/api';
import { subscribeToGame, type GameSubscription } from '@/lib/client/realtime';
import type { GameView } from '@/lib/server/games';
import { ensureSession } from '@/lib/supabase/client';

export type ConnectionStatus =
  | 'idle'
  /** Session + première lecture en cours. */
  | 'loading'
  /** La partie existe mais on n'en fait pas partie : il faut choisir un pseudo. */
  | 'needs-join'
  /** Vue chargée et abonnement Realtime actif. */
  | 'ready'
  | 'error';

interface GameStore {
  code: string | null;
  view: GameView | null;
  status: ConnectionStatus;
  error: string | null;
  /** Code d'erreur API brut, pour distinguer 404 / partie démarrée / complète. */
  errorCode: string | null;
  /** Adopte une vue reçue en réponse d'une action, sans aller la rechercher. */
  applyView: (view: GameView) => void;
  attach: (code: string) => Promise<void>;
  join: (code: string, name: string) => Promise<void>;
  refresh: () => Promise<void>;
  detach: () => void;
}

let subscription: GameSubscription | null = null;
let subscribedTo: string | null = null;

function messageOf(e: unknown): string {
  return e instanceof RequestError ? e.message : 'Connexion impossible';
}

function codeOf(e: unknown): string {
  return e instanceof RequestError ? e.code : 'NETWORK';
}

export const useGameStore = create<GameStore>((set, get) => ({
  code: null,
  view: null,
  status: 'idle',
  error: null,
  errorCode: null,

  applyView: (view) => set({ view, status: 'ready' }),

  attach: async (code) => {
    set({ code, status: 'loading', error: null, errorCode: null });
    try {
      await ensureSession();
      const view = await api.getView(code);

      // Un seul abonnement par partie : attach() est ré-appelé après un join.
      if (subscribedTo !== view.game.id) {
        subscription?.unsubscribe();
        subscribedTo = view.game.id;
        subscription = subscribeToGame(view.game.id, () => {
          void get().refresh();
        });
      }
      set({ view, status: 'ready' });
    } catch (e) {
      if (e instanceof RequestError && e.code === 'NOT_A_PLAYER') {
        set({ status: 'needs-join', view: null });
        return;
      }
      set({ status: 'error', error: messageOf(e), errorCode: codeOf(e) });
    }
  },

  join: async (code, name) => {
    set({ code, status: 'loading', error: null, errorCode: null });
    try {
      await ensureSession();
      await api.joinGame(code, name);
    } catch (e) {
      set({ status: 'error', error: messageOf(e), errorCode: codeOf(e) });
      return;
    }
    await get().attach(code);
  },

  refresh: async () => {
    const code = get().code;
    if (!code) return;
    try {
      const view = await api.getView(code);
      set({ view, status: 'ready' });
    } catch {
      // Erreur transitoire : le prochain événement Realtime relancera un fetch.
    }
  },

  detach: () => {
    subscription?.unsubscribe();
    subscription = null;
    subscribedTo = null;
    set({ view: null, code: null, status: 'idle', error: null, errorCode: null });
  },
}));
