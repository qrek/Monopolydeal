/**
 * Fenêtre de Refus : 8 secondes pour opposer un Refus catégorique à une action
 * qui te vise. Le silence vaut acceptation.
 *
 * Le compte à rebours affiché n'est qu'indicatif — il part de `updated_at`
 * renvoyé par le serveur, et c'est le serveur qui tranche : lui seul accepte le
 * `CLAIM_TIMEOUT`, et il le refuse tant que la fenêtre court vraiment.
 */

'use client';

import { useEffect, useRef, useState } from 'react';

import { CardFace } from '@/components/cards/CardFace';
import { ActionSummary } from '@/components/play/ActionSummary';
import type { PlayController } from '@/components/play/usePlayController';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/client/api';
import {
  JUST_SAY_NO_WINDOW_MS,
  type CardId,
  type PendingAction,
  type PendingTarget,
  type RedactedPlayer,
  type RedactedState,
} from '@/lib/engine';
import { handHasJustSayNo, handHasReflect, isReflectable } from '@/lib/ui/legal';

const KIND_LABEL: Record<PendingAction['kind'], string> = {
  DEAL_BREAKER: 'Coup de filet',
  SLY_DEAL: 'Affaire douteuse',
  FORCED_DEAL: 'Échange forcé',
  DEBT_COLLECTOR: 'Recouvrement',
  BIRTHDAY: 'Anniversaire',
  RENT: 'Loyer',
  FINE: 'Contravention',
  RATP_CHECK: 'Contrôle RATP',
  TAIL: 'Filature',
};

/** Millisecondes restantes, d'après l'horodatage serveur du dernier coup. */
function useCountdown(since: string): number {
  const [left, setLeft] = useState(JUST_SAY_NO_WINDOW_MS);
  useEffect(() => {
    const start = new Date(since).getTime();
    const tick = () => {
      setLeft(Math.max(0, JUST_SAY_NO_WINDOW_MS - (Date.now() - start)));
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [since]);
  return left;
}

/**
 * Une fois la fenêtre écoulée, quelqu'un doit réclamer le dénouement. La source
 * de l'action s'en charge ; les autres prennent le relais un peu plus tard, au
 * cas où elle aurait fermé son onglet.
 */
export function useTimeoutClaim(
  code: string,
  pending: PendingAction | null,
  viewerId: string,
  updatedAt: string,
  refresh: () => Promise<void>,
): void {
  useEffect(() => {
    if (!pending) return;
    const waiting = pending.targets.some((t) => t.status === 'AWAITING_RESPONSE');
    if (!waiting) return;

    const isSource = pending.sourcePlayerId === viewerId;
    const elapsed = Date.now() - new Date(updatedAt).getTime();
    const delay =
      Math.max(0, JUST_SAY_NO_WINDOW_MS - elapsed) + (isSource ? 400 : 3400);

    const id = setTimeout(() => {
      void api
        .claimTimeout(code)
        .then(refresh)
        .catch(() => {
          // 425 tant que la fenêtre court : un autre client réessaiera.
        });
    }, delay);
    return () => clearTimeout(id);
  }, [code, pending, viewerId, updatedAt, refresh]);
}

export function JustSayNoOverlay({
  pending,
  target,
  me,
  state,
  sourceName,
  updatedAt,
  ctl,
}: {
  pending: PendingAction;
  target: PendingTarget;
  me: RedactedPlayer;
  state: RedactedState;
  sourceName: string;
  updatedAt: string;
  ctl: PlayController;
}) {
  const left = useCountdown(updatedAt);
  const seconds = Math.ceil(left / 1000);
  const ratio = left / JUST_SAY_NO_WINDOW_MS;
  const jsn = handHasJustSayNo(me);
  // Refuser un Refus, c'est rétablir son action : le mot change de sens.
  const counter = target.jsnChain.length > 0;
  // Le Renvoi ne s'offre qu'à la cible d'une demande d'argent, avant tout
  // Refus : passé ce point, la question n'est plus qui paie mais qui a le
  // dernier mot.
  const renvoi =
    !counter && target.playerId === me.id && isReflectable(state)
      ? handHasReflect(me)
      : null;

  /**
   * Sans Refus en main, il n'y a rien à décider : la fenêtre n'offrait qu'un
   * bouton grisé et huit secondes d'attente pour tout le monde. On accepte
   * donc aussitôt, et la partie continue. Le repère de session évite de
   * renvoyer la même acceptation à chaque rendu.
   */
  const accepte = useRef<string | null>(null);
  useEffect(() => {
    if (jsn || renvoi) return;
    const cle = `${target.playerId}:${target.jsnChain.length}`;
    if (accepte.current === cle) return;
    accepte.current = cle;
    void ctl.send({
      type: 'RESPOND_ACCEPT',
      playerId: me.id,
      againstPlayerId: target.playerId,
    });
  }, [jsn, renvoi, target.playerId, target.jsnChain.length, ctl, me.id]);

  if (!jsn && !renvoi) return null;

  return (
    <Modal
      open
      title={counter ? 'Ton action a été refusée' : `${sourceName} te vise`}
      subtitle={KIND_LABEL[pending.kind]}
      // Les deux boutons vivent dans le pied : en paysage, le corps de la
      // modale défile, et une décision de huit secondes ne doit pas se
      // chercher au bout d'un défilement.
      footer={
        <div className="flex flex-col gap-2">
          {/* Le compte à rebours vit avec les boutons : c'est lui qui dit
              l'urgence de la décision qu'ils portent. */}
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-ink bg-paper"
              role="timer"
              aria-label={`${seconds} secondes restantes`}
            >
              <div
                className="h-full bg-mono-red transition-[width] duration-100 ease-linear"
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs font-extrabold tabular-nums">
              {seconds} s
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {renvoi && (
              <Button
                loading={ctl.busy}
                onClick={() => {
                  void ctl.send({
                    type: 'RESPOND_REFLECT',
                    playerId: me.id,
                    cardId: renvoi,
                    againstPlayerId: target.playerId,
                  });
                }}
              >
                Renvoyer
              </Button>
            )}
            {jsn && (
              <Button
                variant={renvoi ? 'secondary' : 'primary'}
                loading={ctl.busy}
                onClick={() => {
                  void ctl.send({
                    type: 'RESPOND_JUST_SAY_NO',
                    playerId: me.id,
                    cardId: jsn,
                    againstPlayerId: target.playerId,
                  });
                }}
              >
                {counter ? 'Rétablir mon action' : 'Refuser'}
              </Button>
            )}
            <Button
              variant="secondary"
              loading={ctl.busy}
              onClick={() =>
                void ctl.send({
                  type: 'RESPOND_ACCEPT',
                  playerId: me.id,
                  againstPlayerId: target.playerId,
                })
              }
            >
              {counter ? 'Laisser tomber' : 'Laisser passer'}
            </Button>
          </div>
        </div>
      }
    >
      {/* Ce que l'action fait, en cartes : c'est là-dessus qu'on décide. */}
      <ActionSummary pending={pending} state={state} viewerId={me.id} />

      <div className="mt-3 flex items-center gap-3">
        <div className="shrink-0">
          <CardFace cardId={(renvoi ?? jsn) as CardId} width={56} />
        </div>
        <p className="text-sm font-semibold">
          {renvoi
            ? 'Renvoie la demande à son auteur : c’est lui qui paiera, au même montant. Il pourra encore la refuser.'
            : counter
              ? 'Joue ce Refus pour rétablir ton action. Sans réponse, elle reste annulée.'
              : 'Joue ce Refus pour annuler l’action. Sans réponse, elle passe : le silence vaut acceptation.'}
        </p>
      </div>
    </Modal>
  );
}
