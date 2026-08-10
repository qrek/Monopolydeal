/**
 * Fin de tour au-dessus de la limite de main : il faut défausser jusqu'à 7
 * cartes, ni plus ni moins. La modale ne se ferme pas — le tour ne peut pas
 * avancer tant que ce n'est pas fait.
 */

'use client';

import { useState } from 'react';

import { CardFace } from '@/components/cards/CardFace';
import type { PlayController } from '@/components/play/usePlayController';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { HAND_LIMIT, type CardId, type RedactedPlayer } from '@/lib/engine';

export function DiscardModal({
  me,
  ctl,
}: {
  me: RedactedPlayer;
  ctl: PlayController;
}) {
  const [picked, setPicked] = useState<CardId[]>([]);
  const required = Math.max(0, me.hand.length - HAND_LIMIT);
  const ready = picked.length === required;

  const toggle = (id: CardId) =>
    setPicked((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  return (
    <Modal
      open
      title={`Défausse ${required} carte${required > 1 ? 's' : ''}`}
      subtitle={`On ne garde que ${HAND_LIMIT} cartes en fin de tour`}
      footer={
        <Button
          disabled={!ready}
          loading={ctl.busy}
          onClick={() =>
            void ctl.send({ type: 'DISCARD', playerId: me.id, cardIds: picked })
          }
        >
          {ready
            ? 'Défausser et passer la main'
            : `${picked.length} sur ${required} choisie${required > 1 ? 's' : ''}`}
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {me.hand.map((id) => {
          const on = picked.includes(id);
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={`rounded-card transition-transform duration-200 ${
                on ? '-translate-y-1.5 ring-4 ring-mono-red' : 'hover:-translate-y-1'
              }`}
              aria-pressed={on}
            >
              <CardFace cardId={id} width={68} />
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
