/**
 * Compteur d'actions : les pastilles du tour, qui s'éteignent une à une. C'est
 * l'information la plus consultée d'un tour, elle reste grande et toujours au
 * même endroit.
 *
 * Une pastille qui s'éteint le fait en claquant — c'est la seule confirmation
 * qu'un coup a bien été compté.
 *
 * Le nombre de pastilles n'est PAS constant : une Contravention en retire une
 * pour un tour. Elles étaient au nombre de trois en dur, si bien qu'un joueur
 * verbalisé voyait trois cases, en jouait deux, et se prenait un refus du
 * serveur au troisième coup sans comprendre pourquoi. La case retirée reste
 * donc affichée, barrée : ce qui manque doit se voir, sinon c'est le jeu qui a
 * l'air cassé.
 */

'use client';

import { motion } from 'framer-motion';

import { MAX_ACTIONS_PER_TURN } from '@/lib/engine';
import { SPRING } from '@/lib/ui/motion';

interface ActionPipsProps {
  played: number;
  /** Actions permises ce tour-ci : trois, sauf Contravention. */
  allowed?: number;
  /** Grisé hors de mon tour : le compteur n'est plus le mien. */
  active?: boolean;
}

export function ActionPips({
  played,
  allowed = MAX_ACTIONS_PER_TURN,
  active = true,
}: ActionPipsProps) {
  const remaining = Math.max(0, allowed - played);
  const retirees = Math.max(0, MAX_ACTIONS_PER_TURN - allowed);
  return (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label={
        retirees > 0
          ? `${remaining} action${remaining > 1 ? 's' : ''} sur ${allowed}, contravention en cours`
          : `${remaining} action${remaining > 1 ? 's' : ''} sur ${allowed} restantes`
      }
      title={retirees > 0 ? 'Contravention : une action de moins ce tour-ci' : undefined}
    >
      {Array.from({ length: MAX_ACTIONS_PER_TURN }, (_, i) => {
        const retiree = i >= allowed;
        const spent = i < played;
        if (retiree) {
          return (
            <span
              key={i}
              aria-hidden
              className="grid size-3.5 place-items-center rounded-full border-2 border-dashed border-ink/40 text-[0.6rem] font-extrabold leading-none text-ink/50"
            >
              ×
            </span>
          );
        }
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
