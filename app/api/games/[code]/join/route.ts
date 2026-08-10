/** POST /api/games/[code]/join — rejoint le lobby (idempotent = reconnexion). */

import { NextResponse } from 'next/server';

import { fail, readJson } from '@/app/api/_lib/respond';
import { joinRoom } from '@/lib/server/games';
import { requireUserId } from '@/lib/supabase/server';

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
