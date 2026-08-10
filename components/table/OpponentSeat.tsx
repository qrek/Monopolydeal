/**
 * Un adversaire, vu depuis notre siège : cartes en main (comptées, jamais
 * révélées — la vue serveur ne les contient pas), banque avec son détail au
 * survol, et lots avec leur état de complétion.
 */

'use client';

import { BankDetail, BankTotal } from '@/components/table/BankStack';
import { PropertyGroups } from '@/components/table/PropertyGroups';
import { SetPips } from '@/components/table/SetPips';
import { Avatar } from '@/components/ui/Avatar';
import { completeColors, type RedactedPlayer } from '@/lib/engine';

const CARD_WIDTH = 36;

export function OpponentSeat({
  player,
  isCurrent,
}: {
  player: RedactedPlayer;
  isCurrent: boolean;
}) {
  const sets = completeColors(player).length;

  return (
    <article
      className={[
        'panel min-w-0 p-2.5 transition-colors duration-200 lg:min-w-[11rem] lg:flex-1',
        isCurrent ? 'border-gold/60 bg-felt-light/80' : '',
      ].join(' ')}
    >
      <header className="flex items-center gap-2">
        <Avatar name={player.name} seed={player.id} size={32} offline={!player.connected} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold leading-tight">{player.name}</p>
          {/* Un div, pas un p : le détail de la banque contient une liste. */}
          <div className="flex items-center gap-2 text-[0.7rem] leading-tight text-muted">
            <span title={`${player.handCount} cartes en main`}>
              ✋ {player.handCount}
            </span>
            {/* Le détail de la banque au survol, sans quitter la table. */}
            <div className="group relative cursor-default" tabIndex={0}>
              <BankTotal cards={player.bank} />
              <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden w-44 -translate-x-1/2 rounded-card border border-white/10 bg-table/95 p-2 text-left shadow-panel group-hover:block group-focus:block">
                <BankDetail cards={player.bank} />
              </div>
            </div>
          </div>
        </div>
        <SetPips sets={sets} />
      </header>

      <div className="mt-3">
        <PropertyGroups
          groups={player.groups}
          cardWidth={CARD_WIDTH}
          empty="Pas encore de propriété"
        />
      </div>
    </article>
  );
}
