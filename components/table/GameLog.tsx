/**
 * Journal de partie, alimenté par `state.events` — le log append-only du moteur.
 * Latéral sur grand écran, tiroir sur mobile.
 */

'use client';

import { useEffect, useRef } from 'react';

import type { GameEvent } from '@/lib/engine';
import { describeEvent, type LogTone } from '@/lib/ui/log';

const TONE: Record<LogTone, string> = {
  neutral: 'text-muted',
  gain: 'text-[#7fd1a0]',
  loss: 'text-[#f0a08a]',
  strong: 'text-ink font-bold',
};

export function GameLog({
  events,
  nameOf,
}: {
  events: GameEvent[];
  nameOf: (id: string) => string;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  // Le journal suit l'action : on colle au dernier événement.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [events.length]);

  return (
    <div>
      <ol className="space-y-1.5 text-xs leading-snug">
        {events.map((e) => {
          const line = describeEvent(e, nameOf);
          return (
            <li key={e.seq} className={TONE[line.tone]}>
              {line.text}
            </li>
          );
        })}
      </ol>
      {/* Ancre de défilement : hors du <ol>, qui n'accepte que des <li>. */}
      <div ref={endRef} />
    </div>
  );
}
