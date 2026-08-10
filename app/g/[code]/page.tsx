import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { GameRoom } from '@/components/game/GameRoom';

interface Props {
  params: Promise<{ code: string }>;
}

/** Même contrainte que la colonne `games.code` en base. */
const ROOM_CODE = /^[A-Z]{4}$/;

export const metadata: Metadata = {
  title: 'Partie — Lotissime',
};

export default async function GamePage({ params }: Props) {
  const { code } = await params;
  // Les liens partagés survivent à un copier-coller en minuscules.
  const normalized = code.toUpperCase();
  if (!ROOM_CODE.test(normalized)) notFound();
  return <GameRoom code={normalized} />;
}
