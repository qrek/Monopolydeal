/**
 * Un adversaire : son pseudo, son argent, ses cartes. Rien d'autre.
 *
 * Pas de cadre ni de fond — quatre panneaux cernés en haut de table alourdissent
 * l'écran sans rien apprendre. Ce sont les cartes qu'on regarde ; le reste doit
 * se faire oublier.
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
  /** Hauteur laissée aux lots. */
  stackHeight: number;
}) {
  const sets = completeColors(player).length;

  return (
    <article className="flex min-w-0 flex-1 flex-col gap-1">
      <header className="flex items-center gap-1.5">
        <Avatar
          name={player.name}
          seed={player.id}
          size={20}
          offline={!player.connected}
        />
        <span
          className={`min-w-0 truncate text-[0.72rem] font-extrabold leading-none ${
            isCurrent ? 'text-mono-red' : 'text-ink'
          }`}
        >
          {player.name}
        </span>
        {/* Le tour en cours se signale par un point, pas par un cadre. */}
        {isCurrent && (
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-mono-red" />
        )}

        <span className="shrink-0 text-[0.68rem] font-bold leading-none text-ink-soft">
          ✋{player.handCount}
        </span>
        {/* Le détail de la banque au survol, sans quitter la table. */}
        <div className="group relative shrink-0 cursor-default text-[0.68rem]" tabIndex={0}>
          <BankTotal cards={player.bank} />
          <div className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-40 rounded-card border-2 border-ink bg-cream p-2 text-left shadow-panel group-hover:block group-focus:block">
            <BankDetail cards={player.bank} />
          </div>
        </div>

        <SetPips sets={sets} />

        {!player.connected && (
          <span className="shrink-0 text-[0.6rem] font-bold uppercase text-ink-soft">
            absent
          </span>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <PropertyGroups
          groups={player.groups}
          cardWidth={cardWidth}
          maxHeight={stackHeight}
          empty="—"
        />
      </div>
    </article>
  );
}
