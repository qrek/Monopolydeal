/** POST /api/games/[code]/color — choisir sa couleur, avant le lancement. */

import { NextResponse } from 'next/server';

import { fail, readJson } from '@/app/api/_lib/respond';
import { setPlayerColor } from '@/lib/server/games';
import { requireUserId } from '@/lib/supabase/server';

/** Même région que le projet Supabase : voir la route de création. */
export const preferredRegion = 'dub1';

interface Ctx {
  params: Promise<{ code: string }>;
}

export async function POST(req: Request, ctx: Ctx): Promise<NextResponse> {
  try {
    const userId = await requireUserId();
    const { code } = await ctx.params;
    const body = await readJson(req);
    await setPlayerColor(code, userId, body.color);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
