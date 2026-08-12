/**
 * Un adversaire : son pseudo, son argent, ses cartes. Rien d'autre.
 *
 * Pas de cadre ni de fond — quatre panneaux cernés en haut de table alourdissent
 * l'écran sans rien apprendre. Ce sont les cartes qu'on regarde ; le reste doit
 * se faire oublier.
 */

'use client';

import { memo } from 'react';

import { BankTotal } from '@/components/table/BankStack';
import { PropertyGroups } from '@/components/table/PropertyGroups';
import { SetPips } from '@/components/table/SetPips';
import { Avatar } from '@/components/ui/Avatar';
import { completeColors, type RedactedPlayer } from '@/lib/engine';
import { fitGroups } from '@/lib/ui/layout';

export const OpponentSeat = memo(function OpponentSeat({
  player,
  isCurrent,
  cardWidth,
  seatWidth,
  stackHeight,
  onOpen,
  color,
}: {
  player: RedactedPlayer;
  isCurrent: boolean;
  cardWidth: number;
  /** Largeur qui revient à ce joueur dans la rangée. */
  seatWidth: number;
  /** Hauteur laissée aux lots. */
  stackHeight: number;
  /** Ouvre son plateau en détail. */
  onOpen: () => void;
  /** Couleur choisie dans le salon, ou null. */
  color?: string | null;
}) {
  const sets = completeColors(player).length;

  return (
    // Toute la place de l'adversaire ouvre son plateau : en paysage il n'y a
    // pas de place pour un bouton dédié, et c'est là qu'on tape naturellement.
    <article
      // Ancre du joueur : c'est d'ici que partent et arrivent les cartes en vol.
      data-seat={player.id}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Voir le plateau de ${player.name}`}
      className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 rounded-panel transition-colors hover:bg-ink/5"
    >
      <header className="flex items-center gap-1.5">
        <Avatar
          name={player.name}
          seed={player.id}
          size={20}
          color={color}
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

        <span className="shrink-0 text-[0.72rem] font-bold leading-none text-ink-soft">
          ✋{player.handCount}
        </span>
        {/* Le détail de la banque vit maintenant dans son plateau ouvert : une
            infobulle au survol ne sert à rien sur un écran tactile. Ce qui
            compte ici, c'est le montant — c'est lui qui dit si une action
            passera ou non. */}
        <span className="shrink-0 text-[0.85rem] leading-none">
          <BankTotal cards={player.bank} />
        </span>

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
          // Ses lots rétrécissent pour tenir dans sa place plutôt que de partir
          // dans un défilement horizontal que personne ne voit.
          cardWidth={fitGroups(seatWidth, player.groups.length, cardWidth)}
          maxHeight={stackHeight}
          empty="—"
        />
      </div>
    </article>
  );
});
