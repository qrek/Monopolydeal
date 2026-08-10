/** Appels REST typés vers la couche API. */

'use client';

import type { GameAction } from '@/lib/engine';
import type { GameView } from '@/lib/server/games';

export class RequestError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
    this.code = code;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new RequestError(
      res.status,
      body.error ?? 'UNKNOWN',
      body.message ?? `HTTP ${res.status}`,
    );
  }
  return body as T;
}

export const api = {
  createGame: (name: string) =>
    call<{ code: string; gameId: string }>('/api/games', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  joinGame: (code: string, name: string) =>
    call<{ gameId: string }>(`/api/games/${code}/join`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  getView: (code: string) => call<GameView>(`/api/games/${code}`),

  startGame: (code: string) =>
    call<{ ok: true }>(`/api/games/${code}/actions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'START_GAME' }),
    }),

  sendAction: (code: string, action: GameAction) =>
    call<{ ok: true }>(`/api/games/${code}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  claimTimeout: (code: string) =>
    call<{ ok: true }>(`/api/games/${code}/actions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'CLAIM_TIMEOUT' }),
    }),

  setConnected: (code: string, connected: boolean) =>
    call<{ ok: true }>(`/api/games/${code}/actions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'SET_CONNECTED', connected }),
    }),
};
