/**
 * Progression vers la victoire : un jeton par lot complet requis.
 *
 * Volontairement figuratif plutôt que numérique — un « 1/3 » posé à côté des
 * « 2/3 » de complétion des lots voulait dire deux choses différentes au même
 * endroit.
 */

import { SETS_TO_WIN } from '@/lib/engine';

export function SetPips({ sets }: { sets: number }) {
  return (
    <span
      className="flex shrink-0 items-center gap-1"
      title={`${sets} lot${sets > 1 ? 's' : ''} complet${sets > 1 ? 's' : ''} sur les ${SETS_TO_WIN} qui font gagner`}
      aria-label={`${sets} lots complets sur ${SETS_TO_WIN}`}
    >
      {Array.from({ length: SETS_TO_WIN }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`size-2.5 rotate-45 rounded-[1px] ${
            i < sets ? 'bg-gold' : 'border border-white/25'
          }`}
        />
      ))}
    </span>
  );
}
