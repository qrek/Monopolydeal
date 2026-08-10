/**
 * Un adversaire, vu depuis notre siège : cartes en main (comptées, jamais
 * révélées — la vue serveur ne les contient pas), banque avec son détail au
 * survol, et lots avec leur état de complétion.
 *
 * En paysage, les sièges s'alignent en haut de table : la tuile est donc large
 * et basse, jamais haute.
 */

'use client';

import { BankDetail, BankTotal } from '@/components/table/BankStack';
import { PropertyGroups } from '@/components/table/PropertyGroups';
import { SetPips } from '@/components/table/SetPips';
import { Avatar } from '@/components/ui/Avatar';
import { completeColors, type RedactedPlayer } from '@/lib/engine';

export function OpponentSeat({
  player,
  isCurrent,
  cardWidth,
  stackHeight,
}: {
  player: RedactedPlayer;
  isCurrent: boolean;
  cardWidth: number;
  /** Hauteur laissée aux lots dans cette tuile. */
  stackHeight: number;
}) {
  const sets = completeColors(player).length;

  return (
    <article
      className={[
        'flex min-w-0 flex-1 flex-col rounded-panel border-2 bg-cream/85 p-1.5 transition-colors duration-200',
        isCurrent ? 'border-mono-red bg-cream' : 'border-ink/30',
      ].join(' ')}
    >
      <header className="flex items-center gap-1.5">
        <Avatar name={player.name} seed={player.id} size={24} offline={!player.connected} />
        <span className="min-w-0 flex-1 truncate text-xs font-extrabold leading-tight">
          {player.name}
        </span>
        <SetPips sets={sets} />
      </header>

      <div className="mt-1 flex items-center gap-2 text-[0.65rem] leading-none text-ink-soft">
        <span title={`${player.handCount} cartes en main`} className="font-bold">
          ✋ {player.handCount}
        </span>
        {/* Le détail de la banque au survol, sans quitter la table. */}
        <div className="group relative cursor-default" tabIndex={0}>
          <BankTotal cards={player.bank} />
          <div className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-44 rounded-card border-2 border-ink bg-cream p-2 text-left shadow-panel group-hover:block group-focus:block">
            <BankDetail cards={player.bank} />
          </div>
        </div>
        {!player.connected && (
          <span className="ml-auto font-bold uppercase tracking-wide">absent</span>
        )}
      </div>

      <div className="mt-1 min-h-0 flex-1 overflow-hidden">
        <PropertyGroups
          groups={player.groups}
          cardWidth={cardWidth}
          maxHeight={stackHeight}
          empty="Pas de propriété"
        />
      </div>
    </article>
  );
}
