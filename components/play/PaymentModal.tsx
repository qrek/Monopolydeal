/**
 * Paiement d'une dette. Sélection multi-cartes avec le total courant face au
 * total dû ; le bouton ne s'active qu'une fois la dette couverte — ou si l'on
 * donne littéralement tout ce qu'on possède, seul cas où payer moins est permis.
 *
 * On ne rend pas la monnaie : payer plus que dû reste possible et le reste
 * indique clairement ce qu'on offre en trop.
 *
 * Deux rangées, et pas une seule : la banque et le plateau ne se donnent pas du
 * tout de la même façon. Un billet, on le lâche sans réfléchir ; une propriété,
 * elle, casse un lot qu'on a mis trois tours à monter. Mélangées dans une même
 * file, elles se valaient visuellement — et on donnait une rue en croyant
 * donner de l'argent.
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

/**
 * Une source de paiement : son titre, ce qu'elle pèse, et ses cartes en une
 * rangée qui défile. En paysage la place est horizontale — une grille
 * obligeait à faire défiler la modale elle-même.
 */
function Rangee({
  titre,
  resume,
  cartes,
  picked,
  onToggle,
  vide,
  avertissement = false,
}: {
  titre: string;
  resume: string;
  cartes: CardId[];
  picked: CardId[];
  onToggle: (id: CardId) => void;
  vide: string;
  /** Le plateau se donne à contrecœur : son résumé le dit. */
  avertissement?: boolean;
}) {
  const pris = cartes.filter((id) => picked.includes(id));
  return (
    <section className="mb-3 last:mb-0">
      <h3 className="mb-1.5 flex items-baseline gap-2">
        <span className="board-label">{titre}</span>
        <span
          className={`text-[0.7rem] font-bold ${
            avertissement ? 'text-mono-red/80' : 'text-ink-soft'
          }`}
        >
          {resume}
        </span>
        {pris.length > 0 && (
          <span className="ml-auto text-[0.7rem] font-extrabold tabular-nums text-ink">
            {pris.length} carte{pris.length > 1 ? 's' : ''} · {total(pris)} M
          </span>
        )}
      </h3>
      {cartes.length === 0 ? (
        <p className="text-xs text-ink-soft">{vide}</p>
      ) : (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {cartes.map((id) => {
            const on = picked.includes(id);
            return (
              <button
                key={id}
                onClick={() => onToggle(id)}
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
      )}
    </section>
  );
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
  // La banque d'abord, le plateau ensuite : c'est l'ordre dans lequel on paie.
  const banque = useMemo(() => [...me.bank], [me.bank]);
  const plateau = useMemo(
    () => payable.filter((id) => !me.bank.includes(id)),
    [payable, me.bank],
  );
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
            Ta main est intouchable : on paie avec la banque, ou avec le plateau.
          </p>

          <Rangee
            titre="Ma banque"
            resume={`${total(banque)} M en billets`}
            cartes={banque}
            picked={picked}
            onToggle={toggle}
            vide="Banque vide."
          />

          <Rangee
            titre="Mon plateau"
            resume="donner une carte casse le lot"
            avertissement
            cartes={plateau}
            picked={picked}
            onToggle={toggle}
            vide="Aucune propriété posée."
          />
        </>
      )}
    </Modal>
  );
}
