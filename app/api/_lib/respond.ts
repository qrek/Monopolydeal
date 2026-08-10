/** Conversion des erreurs de la couche service en réponses JSON. */

import { NextResponse } from 'next/server';

import { ApiError } from '@/lib/server/errors';

export function fail(e: unknown): NextResponse {
  if (e instanceof ApiError) {
    return NextResponse.json(
      { error: e.code, message: e.message },
      { status: e.status },
    );
  }
  console.error('[api]', e);
  return NextResponse.json(
    { error: 'INTERNAL', message: 'Erreur interne' },
    { status: 500 },
  );
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await req.json()) as unknown;
    return body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
