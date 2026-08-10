/**
 * Les trois destinations d'une carte : Banque, Mes propriétés, Jouer l'action.
 *
 * Elles servent aux deux gestes. À la souris on y traîne la carte ; au doigt on
 * tape la carte puis la zone — le glisser reste possible mais n'est jamais
 * obligatoire, un pouce n'a pas à viser au pixel près.
 */

'use client';

import { CardFace } from '@/components/cards/CardFace';
import type { PlayController } from '@/components/play/usePlayController';
import type { CardId } from '@/lib/engine';
import { DESTINATION_LABEL, destinationsFor, type Destination } from '@/lib/ui/legal';

const ORDER: Destination[] = ['BANK', 'PROPERTY', 'ACTION'];

const HINT: Record<Destination, string> = {
  BANK: 'Vaut sa valeur en M',
  PROPERTY: 'Pose dans un lot',
  ACTION: 'Déclenche son effet',
};

export function DropZones({
  ctl,
  active,
  vertical = false,
}: {
  ctl: PlayController;
  /** Faux hors de mon tour : les zones restent visibles mais inertes. */
  active: boolean;
  /** En paysage, les zones s'empilent à gauche de la main. */
  vertical?: boolean;
}) {
  const held = ctl.drag?.cardId ?? ctl.selected;
  const allowed = held ? destinationsFor(held) : [];

  return (
    <div className={`flex gap-1 ${vertical ? 'h-full flex-col' : 'h-full'}`}>
      {ORDER.map((d) => {
        const usable = active && Boolean(held) && allowed.includes(d);
        const hovered = ctl.drag?.over === d;
        return (
          <button
            key={d}
            ref={(el) => ctl.registerZone(d, el)}
            disabled={!usable}
            onClick={() => held && usable && ctl.play(held, d)}
            className={[
              // min-h-0 : sans lui, le texte impose une hauteur plancher et la
              // troisième zone passe sous le bord du pied.
              'flex min-h-0 flex-1 flex-col items-center justify-center rounded-panel border-2 border-dashed px-1 py-1 text-center transition-all duration-200',
              hovered
                ? 'scale-[1.03] border-solid border-mono-red bg-mono-red/15'
                : usable
                  ? 'border-ink/70 bg-cream/80 animate-pulse-ring'
                  : 'border-ink/20 bg-cream/30 opacity-60',
            ].join(' ')}
          >
            <span className="text-[0.62rem] font-extrabold uppercase leading-tight tracking-tight text-ink">
              {DESTINATION_LABEL[d]}
            </span>
            {/* En colonne, la place manque : le libellé se suffit. */}
            {!vertical && (
              <span className="hidden text-[0.55rem] leading-tight text-ink-soft sm:block">
                {HINT[d]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** La carte qui suit le pointeur pendant un glisser. */
export function DragLayer({ ctl, width }: { ctl: PlayController; width: number }) {
  const drag = ctl.drag;
  if (!drag) return null;
  return (
    <div
      className="pointer-events-none fixed z-[70] shadow-drag"
      style={{
        left: drag.x,
        top: drag.y,
        transform: `translate(-50%, -50%) rotate(-4deg) scale(${drag.over ? 1.06 : 1})`,
        transition: 'transform 160ms ease-out',
      }}
    >
      <CardFace cardId={drag.cardId as CardId} width={width} />
    </div>
  );
}
