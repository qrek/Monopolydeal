/**
 * Ce que la table raconte, pour qui ne la voit pas.
 *
 * Le bandeau de tour, la révélation du coup adverse et les montants flottants
 * sont tous purement visuels : un lecteur d'écran ne dit jamais à qui c'est le
 * tour ni ce qui vient d'être joué. Cette région reprend les phrases déjà
 * fabriquées pour le journal — aucune formulation en double — et les annonce.
 *
 * `polite` et non `assertive` : une partie enchaîne les événements, et couper
 * la parole à chaque coup rendrait la table inaudible.
 */

'use client';

import { useEffect, useRef, useState } from 'react';

import type { GameEvent } from '@/lib/engine';
import { describeEvent } from '@/lib/ui/log';

export function LiveRegion({
  events,
  nameOf,
}: {
  events: GameEvent[];
  nameOf: (id: string) => string;
}) {
  const [phrase, setPhrase] = useState('');
  const seen = useRef(-1);

  useEffect(() => {
    const last = events[events.length - 1];
    if (!last || last.seq <= seen.current) return;
    seen.current = last.seq;
    const ligne = describeEvent(last, nameOf);
    if (ligne) setPhrase(ligne.text);
  }, [events, nameOf]);

  return (
    <p
      aria-live="polite"
      aria-atomic="true"
      // Hors de l'écran mais dans l'arbre : `display:none` ou `hidden` retirent
      // l'élément de l'arbre d'accessibilité, et l'annonce ne part jamais.
      className="pointer-events-none absolute -m-px size-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]"
    >
      {phrase}
    </p>
  );
}
