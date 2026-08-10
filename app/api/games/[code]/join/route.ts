/** POST /api/games/[code]/join — rejoint le lobby (idempotent = reconnexion). */

import { NextResponse } from 'next/server';

import { fail, readJson } from '@/app/api/_lib/respond';
import { joinRoom } from '@/lib/server/games';
import { requireUserId } from '@/lib/supabase/server';

/**
 * Exécution à Dublin, c'est-à-dire dans la région du projet Supabase
 * (eu-west-1). Sans cela chaque requête SQL traverse l'Atlantique, et un coup
 * en enchaîne plusieurs : le coût réseau dominait tout le reste.
 */
export const preferredRegion = 'dub1';

interface Ctx {
  params: Promise<{ code: string }>;
}

export async function POST(req: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    const userId = await requireUserId();
    const { code } = await ctx.params;
    const body = await readJson(req);
    const result = await joinRoom(code, userId, body.name);
    return NextResponse.json(result);
  } catch (e) {
    return fail(e);
  }
}
