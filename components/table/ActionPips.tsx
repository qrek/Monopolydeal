/**
 * Compteur d'actions : trois pastilles qui s'éteignent. C'est l'information la
 * plus consultée d'un tour, elle reste donc grande et toujours au même endroit.
 */

import { MAX_ACTIONS_PER_TURN } from '@/lib/engine';

interface ActionPipsProps {
  played: number;
  /** Grisé quand ce n'est pas notre tour : le compteur n'est plus le nôtre. */
  active?: boolean;
}

export function ActionPips({ played, active = true }: ActionPipsProps) {
  const remaining = Math.max(0, MAX_ACTIONS_PER_TURN - played);
  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label={`${remaining} action${remaining > 1 ? 's' : ''} sur ${MAX_ACTIONS_PER_TURN} restantes`}
    >
      {Array.from({ length: MAX_ACTIONS_PER_TURN }, (_, i) => {
        const spent = i < played;
        return (
          <span
            key={i}
            aria-hidden
            className={[
              'size-3.5 rounded-full transition-all duration-200',
              spent
                ? 'scale-90 bg-white/10'
                : active
                  ? 'bg-gold shadow-[0_0_10px_-2px_theme(colors.gold)]'
                  : 'bg-white/25',
            ].join(' ')}
          />
        );
      })}
    </div>
  );
}
