/** GET /api/games/[code] — vue de la partie pour le joueur authentifié. */

import { NextResponse } from 'next/server';

import { fail } from '@/app/api/_lib/respond';
import { getGameView } from '@/lib/server/games';
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

export async function GET(_req: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    const userId = await requireUserId();
    const { code } = await ctx.params;
    const view = await getGameView(code, userId);
    return NextResponse.json(view);
  } catch (e) {
    return fail(e);
  }
}
