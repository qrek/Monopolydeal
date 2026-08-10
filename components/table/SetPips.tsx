/**
 * Progression vers la victoire : une maison par lot complet requis.
 *
 * Volontairement figuratif plutôt que numérique — un « 1/3 » posé à côté des
 * « 2/3 » de complétion des lots voulait dire deux choses différentes au même
 * endroit.
 */

import { SETS_TO_WIN } from '@/lib/engine';

export function SetPips({ sets }: { sets: number }) {
  return (
    <span
      className="flex shrink-0 items-center gap-0.5"
      title={`${sets} lot${sets > 1 ? 's' : ''} complet${sets > 1 ? 's' : ''} sur les ${SETS_TO_WIN} qui font gagner`}
      aria-label={`${sets} lots complets sur ${SETS_TO_WIN}`}
    >
      {Array.from({ length: SETS_TO_WIN }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 12 12"
          aria-hidden
          className="size-3.5"
          fill={i < sets ? '#1FB25A' : 'none'}
          stroke="#141414"
          strokeWidth={1.2}
          strokeLinejoin="round"
        >
          <path d="M1.5 5.2 6 1.5l4.5 3.7V10.5H1.5Z" />
        </svg>
      ))}
    </span>
  );
}
