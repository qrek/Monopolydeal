/**
 * Les destinations d'une carte ne sont plus trois boîtes alignées quelque part :
 * ce sont les endroits eux-mêmes. Mes propriétés à gauche, ma banque à droite,
 * le tapis au centre pour jouer une action. On pousse la carte vers l'endroit
 * où elle va vraiment.
 *
 * Deux gestes mènent au même résultat : traîner la carte, ou la taper puis
 * taper la zone — un pouce n'a pas à viser au pixel près.
 */

'use client';

import { motion } from 'framer-motion';

import { CardFace } from '@/components/cards/CardFace';
import type { PlayController } from '@/components/play/usePlayController';
import type { CardId } from '@/lib/engine';
import { DESTINATION_LABEL, destinationsFor, type Destination } from '@/lib/ui/legal';
import { SPRING } from '@/lib/ui/motion';

/**
 * Enveloppe une zone de la table. Tant qu'aucune carte n'est en main, elle est
 * parfaitement transparente et laisse passer les clics (déplacer un joker, par
 * exemple) ; dès qu'une carte est tenue, un calque de dépôt apparaît par-dessus.
 */
export function Zone({
  ctl,
  dest,
  active,
  className = '',
  style,
  hint,
  children,
}: {
  ctl: PlayController;
  dest: Destination;
  /** Faux hors de mon tour : la zone reste visible mais inerte. */
  active: boolean;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Marque au repos, pour les zones qui n'ont aucun contenu propre — le tapis
   * n'était rien du tout tant qu'on ne tenait pas de carte, donc rien ne disait
   * qu'on pouvait y jouer une action. Elle s'efface dès que le calque de dépôt
   * prend le relais.
   */
  hint?: React.ReactNode;
  /** Absent pour le tapis : la zone n'est qu'une cible, sans contenu propre. */
  children?: React.ReactNode;
}) {
  const held = ctl.drag?.cardId ?? ctl.selected;
  const usable = active && Boolean(held) && destinationsFor(held as CardId).includes(dest);
  const hovered = ctl.drag?.over === dest;

  return (
    <div
      ref={(el) => ctl.registerZone(dest, el)}
      style={style}
      className={`relative rounded-panel transition-all duration-200 ${
        hovered
          ? 'bg-mono-red/15 ring-2 ring-mono-red'
          : usable
            ? 'ring-2 ring-dashed ring-ink/40'
            : ''
      } ${className}`}
    >
      {children}
      {hint && !usable && hint}

      {usable && (
        <button
          onClick={() => held && ctl.play(held, dest)}
          className="absolute inset-0 z-20 grid place-items-center rounded-panel"
        >
          <span
            className={`rounded-card border-2 border-ink px-2 py-1 text-[0.62rem] font-extrabold uppercase leading-none tracking-tight shadow-card transition-colors ${
              hovered ? 'bg-mono-red text-cream' : 'bg-cream text-ink'
            }`}
          >
            {DESTINATION_LABEL[dest]}
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * La carte qui suit le pointeur pendant un glisser. Elle grossit et se redresse
 * au-dessus d'une zone valide : c'est le seul retour qui dise « lâche ici ».
 */
export function DragLayer({ ctl, width }: { ctl: PlayController; width: number }) {
  const drag = ctl.drag;
  if (!drag) return null;
  return (
    <motion.div
      className="pointer-events-none fixed z-[70] shadow-drag will-change-transform"
      style={{ left: drag.x, top: drag.y, x: '-50%', y: '-50%' }}
      animate={{ rotate: drag.over ? 0 : -5, scale: drag.over ? 1.1 : 1 }}
      transition={SPRING}
    >
      <CardFace cardId={drag.cardId} width={width} />
    </motion.div>
  );
}
