/** POST /api/games — crée une partie, renvoie son code à 4 lettres. */

import { NextResponse } from 'next/server';

import { fail, readJson } from '@/app/api/_lib/respond';
import { createRoom } from '@/lib/server/games';
import { requireUserId } from '@/lib/supabase/server';

/**
 * Exécution à Dublin, c'est-à-dire dans la région du projet Supabase
 * (eu-west-1). Sans cela chaque requête SQL traverse l'Atlantique, et un coup
 * en enchaîne plusieurs : le coût réseau dominait tout le reste.
 */
export const preferredRegion = 'dub1';

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
