/**
 * GET /api/stats — le classement, et les statistiques d'un pseudo si on en
 * passe un (`?pseudo=Théo`). Lecture publique : un classement se consulte sans
 * compte, c'est tout son intérêt.
 */

import { NextResponse } from 'next/server';

import { fail } from '@/app/api/_lib/respond';
import { leaderboard, statsFor } from '@/lib/server/stats';

export const preferredRegion = 'dub1';
/** Le classement bouge à chaque fin de partie : jamais de cache figé. */
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const pseudo = new URL(req.url).searchParams.get('pseudo');
    const [classement, moi] = await Promise.all([
      leaderboard(),
      pseudo ? statsFor(pseudo) : Promise.resolve(null),
    ]);
    return NextResponse.json(
      { classement, moi },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
