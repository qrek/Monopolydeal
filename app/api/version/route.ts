/**
 * GET /api/version — quelle version le serveur sert-il en ce moment.
 *
 * La réponse est celle du déploiement courant ; le client compare avec la
 * sienne, compilée dans son propre paquet. Deux valeurs différentes veulent
 * dire que l'onglet exécute du code périmé.
 */

import { NextResponse } from 'next/server';

import { BUILD_ID } from '@/lib/build';

/** Jamais de réponse figée : c'est précisément la fraîcheur qu'on mesure. */
export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  return NextResponse.json(
    { build: BUILD_ID },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
