/**
 * Le plateau d'un adversaire, en grand.
 *
 * En haut de table on ne voit que des tranches de couleur : de quoi savoir
 * qu'un lot avance, pas de quoi décider si on l'attaque. Or c'est exactement la
 * question qu'on se pose avant de jouer un Coup de filet ou un Loyer — quelles
 * rues exactement, quel lot est complet, combien il a en banque.
 */

'use client';

import { BankDetail } from '@/components/table/BankStack';
import { PropertyGroups } from '@/components/table/PropertyGroups';
import { SetPips } from '@/components/table/SetPips';
import { Modal } from '@/components/ui/Modal';
import { bankTotal, completeColors, type RedactedPlayer } from '@/lib/engine';

export function OpponentBoard({
  player,
  onClose,
}: {
  player: RedactedPlayer | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(player)}
      title={player?.name ?? ''}
      subtitle={
        player
          ? `${player.handCount} carte${player.handCount > 1 ? 's' : ''} en main · ${bankTotal(player)} M en banque`
          : undefined
      }
      onClose={onClose}
    >
      {player && (
        <div className="flex flex-col gap-3">
          <section>
            <h3 className="board-label mb-1 flex items-center gap-1.5">
              Ses propriétés
              <SetPips sets={completeColors(player).length} />
            </h3>
            <PropertyGroups
              groups={player.groups}
              cardWidth={82}
              empty="Aucune propriété posée"
            />
            <p className="mt-1 text-[0.7rem] text-ink-soft">
              Appui long sur une carte pour la voir entièrement.
            </p>
          </section>

          <section>
            <h3 className="board-label mb-1">Sa banque</h3>
            <BankDetail cards={player.bank} />
          </section>
        </div>
      )}
    </Modal>
  );
}
