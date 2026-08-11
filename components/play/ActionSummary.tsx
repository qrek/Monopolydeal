/**
 * Ce qu'une action est en train de faire, montré en cartes.
 *
 * Le texte seul — « Affaire douteuse », « Échange forcé » — oblige à traduire
 * un nom de carte en conséquence concrète, au moment précis où il faut décider
 * vite. On montre donc les objets : la carte jouée, et ce qui change de main.
 */

'use client';

import { CardFace } from '@/components/cards/CardFace';
import {
  COLORS,
  getCard,
  type CardId,
  type PendingAction,
  type RedactedState,
} from '@/lib/engine';
import { readableInk } from '@/lib/ui/color';

const KIND_LABEL: Record<PendingAction['kind'], string> = {
  DEAL_BREAKER: 'Coup de filet',
  SLY_DEAL: 'Affaire douteuse',
  FORCED_DEAL: 'Échange forcé',
  DEBT_COLLECTOR: 'Recouvrement',
  BIRTHDAY: 'Anniversaire',
  RENT: 'Loyer',
};

/**
 * La carte qui vient d'être jouée. Le moteur la pousse à la défausse au moment
 * où l'action commence : la dernière de la pile qui correspond au type, c'est
 * elle. Plus juste que de choisir une face au hasard parmi les exemplaires.
 */
function playedCard(state: RedactedState, kind: PendingAction['kind']): CardId | null {
  for (let i = state.discard.length - 1; i >= 0; i--) {
    const id = state.discard[i];
    if (!id) continue;
    const card = getCard(id);
    if (kind === 'RENT') {
      if (card.kind === 'RENT') return id;
      continue;
    }
    if (card.kind === 'ACTION' && card.action === kind) return id;
  }
  return null;
}

function Slot({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div className="flex items-end gap-1">{children}</div>
      <span className="text-[0.6rem] font-extrabold uppercase tracking-wide text-ink-soft">
        {label}
      </span>
    </div>
  );
}

/** Flèche de transfert : elle dit le SENS, qui est toute l'information. */
function Arrow({ both = false }: { both?: boolean }) {
  return (
    <span
      aria-hidden
      className="shrink-0 self-center px-0.5 text-lg font-extrabold leading-none text-ink-soft"
    >
      {both ? '⇄' : '→'}
    </span>
  );
}

/** Somme réclamée, quand il n'y a pas de carte à montrer. */
function Amount({ value, color }: { value: number; color?: string }) {
  return (
    <span
      className="grid h-[4.2rem] w-12 place-items-center rounded-card border-2 border-ink text-lg font-extrabold tabular-nums shadow-card"
      style={
        color
          ? { background: color, color: readableInk(color) }
          : { background: '#F7F2E4' }
      }
    >
      {value} M
    </span>
  );
}

export function ActionSummary({
  pending,
  state,
  viewerId,
  width = 56,
}: {
  pending: PendingAction;
  state: RedactedState;
  /** Point de vue : « tu » et « il » ne désignent pas les mêmes cartes. */
  viewerId: string;
  width?: number;
}) {
  const played = playedCard(state, pending.kind);
  const source = state.players.find((p) => p.id === pending.sourcePlayerId);
  const auteur = source?.id === viewerId ? 'toi' : (source?.name ?? 'Un joueur');

  // La cible qui me concerne : la mienne si j'en suis une, la première sinon.
  const target =
    pending.targets.find((t) => t.playerId === viewerId) ?? pending.targets[0];
  const victime = state.players.find((p) => p.id === target?.playerId);
  const aMoi = victime?.id === viewerId;

  const groupe = victime?.groups.find((g) => g.id === pending.groupId);
  const montant =
    pending.kind === 'RENT'
      ? (pending.amount ?? 0)
      : pending.kind === 'DEBT_COLLECTOR'
        ? 5
        : pending.kind === 'BIRTHDAY'
          ? 2
          : null;

  return (
    <div className="rounded-card border-2 border-ink/15 bg-paper p-2">
      <p className="mb-2 text-[0.7rem] font-extrabold uppercase tracking-wide text-ink-soft">
        {auteur} joue {KIND_LABEL[pending.kind]}
      </p>
      {/* Une seule rangée qui défile : en paysage, la place est horizontale. */}
      <div className="no-scrollbar flex items-start gap-2 overflow-x-auto">
        {played && (
          <Slot label="Carte jouée">
            <CardFace cardId={played} width={width} />
          </Slot>
        )}

        <Arrow both={pending.kind === 'FORCED_DEAL'} />

        {pending.kind === 'DEAL_BREAKER' && groupe && (
          <Slot label={aMoi ? 'Ton lot entier' : 'Le lot visé'}>
            {groupe.cards.map((id) => (
              <CardFace key={id} cardId={id} width={width} />
            ))}
          </Slot>
        )}

        {pending.kind === 'SLY_DEAL' && pending.targetCardId && (
          <Slot label={aMoi ? 'Il te la prend' : 'Carte prise'}>
            <CardFace cardId={pending.targetCardId} width={width} />
          </Slot>
        )}

        {pending.kind === 'FORCED_DEAL' && (
          <>
            {pending.ownCardId && (
              <Slot label={aMoi ? 'Il te donne' : 'Tu donnes'}>
                <CardFace cardId={pending.ownCardId} width={width} />
              </Slot>
            )}
            {pending.targetCardId && (
              <Slot label={aMoi ? 'Il te prend' : 'Tu prends'}>
                <CardFace cardId={pending.targetCardId} width={width} />
              </Slot>
            )}
          </>
        )}

        {montant !== null && (
          <Slot
            label={
              pending.kind === 'RENT' && pending.color
                ? `Loyer ${COLORS[pending.color].label}`
                : aMoi
                  ? 'Tu dois'
                  : 'Réclamé'
            }
          >
            <Amount
              value={montant}
              color={pending.color ? COLORS[pending.color].hex : undefined}
            />
          </Slot>
        )}
      </div>
    </div>
  );
}
