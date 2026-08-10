/**
 * POST /api/games/[code]/actions — le canal unique des intentions client.
 *
 * Corps : { action: GameAction } pour une intention de jeu, ou l'un des
 * messages spéciaux { type: 'START_GAME' } (hôte), { type: 'CLAIM_TIMEOUT' }
 * (fenêtre de Refus expirée), { type: 'SET_CONNECTED', connected: boolean }.
 * Le serveur valide tout via le moteur ; le client n'envoie jamais d'état.
 */

import { NextResponse } from 'next/server';

import { fail, readJson } from '@/app/api/_lib/respond';
import type { GameAction } from '@/lib/engine';
import { ApiError } from '@/lib/server/errors';
import {
  applyIntent,
  claimResponseTimeout,
  setConnected,
  startGame,
} from '@/lib/server/games';
import { requireUserId } from '@/lib/supabase/server';

interface Ctx {
  params: Promise<{ code: string }>;
}

export async function POST(req: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    const userId = await requireUserId();
    const { code } = await ctx.params;
    const body = await readJson(req);

    switch (body.type) {
      case 'START_GAME':
        await startGame(code, userId);
        break;
      case 'CLAIM_TIMEOUT':
        await claimResponseTimeout(code, userId);
        break;
      case 'SET_CONNECTED':
        await setConnected(code, userId, Boolean(body.connected));
        break;
      case undefined: {
        const action = body.action;
        if (!action || typeof action !== 'object' || typeof (action as { type?: unknown }).type !== 'string') {
          throw new ApiError(400, 'BAD_REQUEST', 'Corps attendu : { action }');
        }
        await applyIntent(code, userId, action as GameAction);
        break;
      }
      default:
        throw new ApiError(400, 'BAD_REQUEST', `Type inconnu : ${String(body.type)}`);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
