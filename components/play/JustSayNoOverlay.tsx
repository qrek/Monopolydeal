/**
 * Fenêtre de Refus : 8 secondes pour opposer un Refus catégorique à une action
 * qui te vise. Le silence vaut acceptation.
 *
 * Le compte à rebours affiché n'est qu'indicatif — il part de `updated_at`
 * renvoyé par le serveur, et c'est le serveur qui tranche : lui seul accepte le
 * `CLAIM_TIMEOUT`, et il le refuse tant que la fenêtre court vraiment.
 */

'use client';

import { useEffect, useState } from 'react';

import { CardFace } from '@/components/cards/CardFace';
import type { PlayController } from '@/components/play/usePlayController';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/client/api';
import {
  JUST_SAY_NO_WINDOW_MS,
  type PendingAction,
  type PendingTarget,
  type RedactedPlayer,
} from '@/lib/engine';
import { handHasJustSayNo } from '@/lib/ui/legal';

const KIND_LABEL: Record<PendingAction['kind'], string> = {
  DEAL_BREAKER: 'Coup de filet',
  SLY_DEAL: 'Affaire douteuse',
  FORCED_DEAL: 'Échange forcé',
  DEBT_COLLECTOR: 'Recouvrement',
  BIRTHDAY: 'Anniversaire',
  RENT: 'Loyer',
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
  sourceName,
  updatedAt,
  ctl,
}: {
  pending: PendingAction;
  target: PendingTarget;
  me: RedactedPlayer;
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

  return (
    <Modal
      open
      title={counter ? 'Ton action a été refusée' : `${sourceName} te vise`}
      subtitle={KIND_LABEL[pending.kind]}
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="shrink-0">
          <CardFace cardId={jsn ?? 'act-just_say_no-0'} width={92} />
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold">
            {counter
              ? 'Tu peux jouer un Refus pour rétablir ton action.'
              : 'Tu peux jouer un Refus catégorique pour l’annuler.'}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Sans réponse, l’action passe : le silence vaut acceptation.
          </p>

          {/* Compte à rebours : la barre dit l'urgence mieux qu'un nombre. */}
          <div
            className="mt-4 h-3 overflow-hidden rounded-full border-2 border-ink bg-paper"
            role="timer"
            aria-label={`${seconds} secondes restantes`}
          >
            <div
              className="h-full bg-mono-red transition-[width] duration-100 ease-linear"
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
          <p className="mt-1 text-right text-xs font-extrabold tabular-nums">
            {seconds} s
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={!jsn}
              loading={ctl.busy}
              onClick={() => {
                if (!jsn) return;
                void ctl.send({
                  type: 'RESPOND_JUST_SAY_NO',
                  playerId: me.id,
                  cardId: jsn,
                  againstPlayerId: target.playerId,
                });
              }}
            >
              {jsn ? 'Refuser' : 'Pas de Refus en main'}
            </Button>
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
              Accepter
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
