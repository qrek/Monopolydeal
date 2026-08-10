/**
 * Compteur d'actions : trois pastilles qui s'éteignent. C'est l'information la
 * plus consultée d'un tour, elle reste grande et toujours au même endroit.
 *
 * Une pastille qui s'éteint le fait en claquant — c'est la seule confirmation
 * qu'un coup a bien été compté.
 */

'use client';

import { motion } from 'framer-motion';

import { MAX_ACTIONS_PER_TURN } from '@/lib/engine';
import { SPRING } from '@/lib/ui/motion';

interface ActionPipsProps {
  played: number;
  /** Grisé hors de mon tour : le compteur n'est plus le mien. */
  active?: boolean;
}

export function ActionPips({ played, active = true }: ActionPipsProps) {
  const remaining = Math.max(0, MAX_ACTIONS_PER_TURN - played);
  return (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label={`${remaining} action${remaining > 1 ? 's' : ''} sur ${MAX_ACTIONS_PER_TURN} restantes`}
    >
      {Array.from({ length: MAX_ACTIONS_PER_TURN }, (_, i) => {
        const spent = i < played;
        return (
          <motion.span
            key={i}
            aria-hidden
            className={`size-3.5 rounded-full border-2 border-ink ${
              spent ? 'bg-transparent' : active ? 'bg-mono-red' : 'bg-ink/25'
            }`}
            animate={{ scale: spent ? 0.72 : 1, opacity: spent ? 0.4 : 1 }}
            transition={SPRING}
          />
        );
      })}
    </div>
  );
}
