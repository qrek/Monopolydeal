/** GET /api/games/[code] — vue de la partie pour le joueur authentifié. */

import { NextResponse } from 'next/server';

import { fail } from '@/app/api/_lib/respond';
import { getGameView } from '@/lib/server/games';
import { requireUserId } from '@/lib/supabase/server';

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
