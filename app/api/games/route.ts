/** POST /api/games — crée une partie, renvoie son code à 4 lettres. */

import { NextResponse } from 'next/server';

import { fail, readJson } from '@/app/api/_lib/respond';
import { createRoom } from '@/lib/server/games';
import { requireUserId } from '@/lib/supabase/server';

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const userId = await requireUserId();
    const body = await readJson(req);
    const room = await createRoom(userId, body.name);
    return NextResponse.json(room, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
