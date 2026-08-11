/**
 * Paiement d'une dette. Sélection multi-cartes avec le total courant face au
 * total dû ; le bouton ne s'active qu'une fois la dette couverte — ou si l'on
 * donne littéralement tout ce qu'on possède, seul cas où payer moins est permis.
 *
 * On ne rend pas la monnaie : payer plus que dû reste possible et le reste
 * indique clairement ce qu'on offre en trop.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import { CardFace } from '@/components/cards/CardFace';
import { ActionSummary } from '@/components/play/ActionSummary';
import type { PlayController } from '@/components/play/usePlayController';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  getCard,
  payableCards,
  type CardId,
  type PendingTarget,
  type RedactedPlayer,
  type RedactedState,
} from '@/lib/engine';

function total(ids: CardId[]): number {
  return ids.reduce((s, id) => s + getCard(id).value, 0);
}

export function PaymentModal({
  target,
  me,
  state,
  creditorName,
  ctl,
}: {
  target: PendingTarget | undefined;
  me: RedactedPlayer;
  state: RedactedState;
  creditorName: string;
  ctl: PlayController;
}) {
  const payable = useMemo(() => payableCards(me), [me]);
  const [picked, setPicked] = useState<CardId[]>([]);

  // Une nouvelle dette repart d'une sélection vide.
  useEffect(() => {
    setPicked([]);
  }, [target?.playerId, target?.debt]);

  if (!target) return <Modal open={false} title="" children={null} />;

  const due = target.debt;
  const sum = total(picked);
  const everything = picked.length === payable.length && payable.length > 0;
  const enough = sum >= due || everything;
  const broke = payable.length === 0;

  const toggle = (id: CardId) =>
    setPicked((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  return (
    <Modal
      open
      title={`Tu dois ${due} M`}
      subtitle={`à ${creditorName}`}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1 text-sm font-bold">
            <span
              className={
                enough ? 'text-[#0F7A3D]' : 'text-mono-red'
              }
            >
              {sum} M
            </span>
            <span className="text-ink-soft"> offerts sur {due} M dus</span>
            {sum > due && (
              <span className="ml-2 text-ink-soft">
                (+{sum - due} M — on ne rend pas la monnaie)
              </span>
            )}
          </div>
          <Button
            block={false}
            className="sm:w-56"
            disabled={!enough && !broke}
            loading={ctl.busy}
            onClick={() =>
              void ctl.send({ type: 'PAY', playerId: me.id, cardIds: picked })
            }
          >
            {broke ? 'Je n’ai rien à donner' : everything && sum < due ? 'Tout donner' : 'Payer'}
          </Button>
        </div>
      }
    >
      {broke ? (
        <p className="text-sm text-ink-soft">
          Tu n’as ni banque ni propriété : la dette s’éteint.
        </p>
      ) : (
        <>
          {/* D'où vient la dette, en cartes : sans ça, on paie sans savoir
              ce qu'on vient de subir. */}
          {state.pending && (
            <div className="mb-3">
              <ActionSummary pending={state.pending} state={state} viewerId={me.id} width={48} />
            </div>
          )}
          <p className="mb-3 text-sm text-ink-soft">
            Choisis dans ta banque et tes propriétés. Ta main est intouchable.
          </p>
          {/* Une seule rangée : en paysage la place est horizontale, et une
              grille obligeait à faire défiler la modale verticalement. */}
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {payable.map((id) => {
              const on = picked.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => toggle(id)}
                  className={`shrink-0 rounded-card transition-transform duration-200 ${
                    on ? '-translate-y-1.5 ring-4 ring-mono-red' : 'hover:-translate-y-1'
                  }`}
                  aria-pressed={on}
                >
                  <CardFace cardId={id} width={64} />
                </button>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}
