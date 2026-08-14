/**
 * Les questions posées avant d'envoyer une intention : couleur d'un joker, lot
 * à construire, adversaire et carte visés. Une seule modale, un contenu par
 * type de question.
 *
 * Ces écrans ne décident de rien : ils composent une intention que le moteur
 * validera. Ils se contentent de ne proposer que des cibles plausibles.
 */

'use client';

import { useState } from 'react';

import { CardFace } from '@/components/cards/CardFace';
import type { PlayController, Prompt } from '@/components/play/usePlayController';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  COLORS,
  RATP_CHECK_AMOUNT,
  bankTotal,
  bestRentForColor,
  completeColors,
  getCard,
  possibleColors,
  type CardId,
  type Color,
  type PropertyGroup,
  type RedactedPlayer,
  type RedactedState,
} from '@/lib/engine';
import { actionLabel } from '@/lib/ui/cards';
import { readableInk } from '@/lib/ui/color';
import {
  buildableGroups,
  completeGroupsOf,
  isDoubleRent,
  landableGroups,
  opponentsOfView,
  rentableColors,
  stealableCards,
} from '@/lib/ui/legal';

// ---------------------------------------------------------------------------
// Briques de choix
// ---------------------------------------------------------------------------

function Choice({
  selected,
  onClick,
  children,
  disabled,
}: {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex min-h-11 items-center gap-2 rounded-card border-2 px-3 py-2 text-left text-sm font-bold transition-all duration-200',
        selected
          ? 'border-mono-red bg-mono-red/12'
          : 'border-ink/25 bg-paper hover:border-ink/60',
        disabled ? 'cursor-not-allowed opacity-40' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function ColorChip({ color, label }: { color: Color; label?: string }) {
  const cfg = COLORS[color];
  return (
    <span
      className="inline-flex items-center rounded-[0.2em] border border-ink/70 px-1.5 py-0.5 text-[0.7rem] font-extrabold uppercase leading-none"
      style={{ background: cfg.hex, color: readableInk(cfg.hex) }}
    >
      {label ?? cfg.label}
    </span>
  );
}

function GroupLine({ group }: { group: PropertyGroup }) {
  const cfg = COLORS[group.color];
  return (
    <>
      <ColorChip color={group.color} />
      <span className="tabular-nums text-ink-soft">
        {group.cards.length}/{cfg.size}
      </span>
      {group.house && <span className="text-[#1FB25A]">⌂</span>}
      {group.hotel && <span className="text-mono-red">⌂⌂</span>}
    </>
  );
}

function PlayerLine({ player }: { player: RedactedPlayer }) {
  return (
    <>
      <Avatar name={player.name} seed={player.id} size={28} />
      <span className="min-w-0 flex-1 truncate">{player.name}</span>
      <span className="shrink-0 text-xs font-bold text-ink-soft">
        {player.handCount} en main · {bankTotal(player)}M
      </span>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 last:mb-0">
      <h3 className="board-label mb-1.5">{title}</h3>
      {children}
    </section>
  );
}

/** Rangée de cartes cliquables — pour désigner une propriété précise. */
function CardRow({
  cards,
  selected,
  onPick,
}: {
  cards: CardId[];
  selected: CardId | null;
  onPick: (id: CardId) => void;
}) {
  if (cards.length === 0) {
    return <p className="text-sm text-ink-soft">Aucune carte volable ici.</p>;
  }
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {cards.map((id) => (
        <button
          key={id}
          onClick={() => onPick(id)}
          className={`shrink-0 rounded-card transition-transform duration-200 ${
            selected === id ? 'scale-105 ring-4 ring-mono-red' : 'hover:scale-105'
          }`}
        >
          <CardFace cardId={id} width={64} />
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contenus
// ---------------------------------------------------------------------------

/** Poser ou déplacer un joker : quelle couleur, dans quel lot. */
function ColorPrompt({
  prompt,
  me,
  ctl,
}: {
  prompt: Extract<Prompt, { kind: 'COLOR' }>;
  me: RedactedPlayer;
  ctl: PlayController;
}) {
  const { cardId, move } = prompt;
  const colors = possibleColors(cardId);
  const groups = landableGroups(me, cardId).filter((g) =>
    // Déplacer un joker vers son propre lot n'a aucun sens.
    move ? !g.cards.includes(cardId) : true,
  );

  const send = (payload: { groupId?: string; color?: Color; newGroup?: boolean }) => {
    ctl.closePrompt();
    // Deux envois explicites plutôt qu'un `type` calculé : au-delà d'une
    // vingtaine de combinaisons, TypeScript renonce à discriminer une union
    // dont plusieurs propriétés sont elles-mêmes des unions, et le catalogue
    // de couleurs vient de franchir ce seuil.
    const base = { playerId: me.id, cardId, ...payload };
    void ctl.send(
      move ? { type: 'MOVE_WILD', ...base } : { type: 'PLAY_PROPERTY', ...base },
    );
  };

  return (
    <>
      {groups.length > 0 && (
        <Section title="Rejoindre un lot existant">
          <div className="grid gap-2 sm:grid-cols-2">
            {groups.map((g) => (
              <Choice key={g.id} onClick={() => send({ groupId: g.id })}>
                <GroupLine group={g} />
              </Choice>
            ))}
          </div>
        </Section>
      )}
      <Section title="Ouvrir un nouveau lot">
        <div className="grid gap-2 sm:grid-cols-2">
          {colors.map((c) => (
            <Choice key={c} onClick={() => send({ color: c, newGroup: true })}>
              <ColorChip color={c} />
              <span className="text-ink-soft">lot vide</span>
            </Choice>
          ))}
        </div>
      </Section>
    </>
  );
}

/** Maison ou Hôtel : sur lequel de mes lots complets. */
function BuildingPrompt({
  prompt,
  me,
  ctl,
}: {
  prompt: Extract<Prompt, { kind: 'BUILDING' }>;
  me: RedactedPlayer;
  ctl: PlayController;
}) {
  const card = getCard(prompt.cardId);
  const kind =
    card.kind === 'ACTION' && card.action === 'HOTEL' ? 'HOTEL' : 'HOUSE';
  const groups = buildableGroups(me, kind);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        {kind === 'HOUSE'
          ? 'Aucun lot complet constructible. Les Gares et les Compagnies n’acceptent pas de construction.'
          : 'Aucun lot complet portant déjà une Maison.'}
      </p>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {groups.map((g) => (
        <Choice
          key={g.id}
          onClick={() => {
            ctl.closePrompt();
            void ctl.send({
              type: 'PLAY_BUILDING',
              playerId: me.id,
              cardId: prompt.cardId,
              groupId: g.id,
            });
          }}
        >
          <GroupLine group={g} />
        </Choice>
      ))}
    </div>
  );
}

/** Coup de filet : quel lot complet, chez qui. */
function DealBreakerPrompt({
  prompt,
  state,
  me,
  ctl,
}: {
  prompt: Extract<Prompt, { kind: 'DEAL_BREAKER' }>;
  state: RedactedState;
  me: RedactedPlayer;
  ctl: PlayController;
}) {
  const opponents = opponentsOfView(state, me.id);
  const targets = opponents.flatMap((p) =>
    completeGroupsOf(p).map((g) => ({ player: p, group: g })),
  );

  if (targets.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Personne n’a de lot complet à prendre.
      </p>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {targets.map(({ player, group }) => (
        <Choice
          key={group.id}
          onClick={() => {
            ctl.closePrompt();
            void ctl.send({
              type: 'PLAY_DEAL_BREAKER',
              playerId: me.id,
              cardId: prompt.cardId,
              targetPlayerId: player.id,
              targetGroupId: group.id,
            });
          }}
        >
          <Avatar name={player.name} seed={player.id} size={26} />
          <span className="truncate">{player.name}</span>
          <GroupLine group={group} />
        </Choice>
      ))}
    </div>
  );
}

/** Affaire douteuse : une propriété hors lot complet, chez un adversaire. */
function SlyDealPrompt({
  prompt,
  state,
  me,
  ctl,
}: {
  prompt: Extract<Prompt, { kind: 'SLY_DEAL' }>;
  state: RedactedState;
  me: RedactedPlayer;
  ctl: PlayController;
}) {
  const opponents = opponentsOfView(state, me.id);
  const [victim, setVictim] = useState<string | null>(null);
  const target = opponents.find((p) => p.id === victim);

  return (
    <>
      <Section title="Chez qui">
        <div className="grid gap-2 sm:grid-cols-2">
          {opponents.map((p) => (
            <Choice key={p.id} selected={p.id === victim} onClick={() => setVictim(p.id)}>
              <PlayerLine player={p} />
            </Choice>
          ))}
        </div>
      </Section>
      {target && (
        <Section title="Quelle propriété">
          <CardRow
            cards={stealableCards(target)}
            selected={null}
            onPick={(cardId) => {
              ctl.closePrompt();
              void ctl.send({
                type: 'PLAY_SLY_DEAL',
                playerId: me.id,
                cardId: prompt.cardId,
                targetPlayerId: target.id,
                targetCardId: cardId,
              });
            }}
          />
        </Section>
      )}
    </>
  );
}

/** Échange forcé : ma carte contre la sienne, aucune des deux dans un lot complet. */
function ForcedDealPrompt({
  prompt,
  state,
  me,
  ctl,
}: {
  prompt: Extract<Prompt, { kind: 'FORCED_DEAL' }>;
  state: RedactedState;
  me: RedactedPlayer;
  ctl: PlayController;
}) {
  const opponents = opponentsOfView(state, me.id);
  const [mine, setMine] = useState<CardId | null>(null);
  const [victim, setVictim] = useState<string | null>(null);
  const [theirs, setTheirs] = useState<CardId | null>(null);
  const target = opponents.find((p) => p.id === victim);
  const ready = mine && target && theirs;

  return (
    <>
      <Section title="Ta propriété">
        <CardRow cards={stealableCards(me)} selected={mine} onPick={setMine} />
      </Section>
      <Section title="Chez qui">
        <div className="grid gap-2 sm:grid-cols-2">
          {opponents.map((p) => (
            <Choice
              key={p.id}
              selected={p.id === victim}
              onClick={() => {
                setVictim(p.id);
                setTheirs(null);
              }}
            >
              <PlayerLine player={p} />
            </Choice>
          ))}
        </div>
      </Section>
      {target && (
        <Section title="Sa propriété">
          <CardRow cards={stealableCards(target)} selected={theirs} onPick={setTheirs} />
        </Section>
      )}
      <Button
        disabled={!ready}
        onClick={() => {
          if (!ready) return;
          ctl.closePrompt();
          void ctl.send({
            type: 'PLAY_FORCED_DEAL',
            playerId: me.id,
            cardId: prompt.cardId,
            targetPlayerId: target.id,
            targetCardId: theirs,
            ownCardId: mine,
          });
        }}
      >
        Échanger
      </Button>
    </>
  );
}

function DebtCollectorPrompt({
  prompt,
  state,
  me,
  ctl,
}: {
  prompt: Extract<Prompt, { kind: 'DEBT_COLLECTOR' }>;
  state: RedactedState;
  me: RedactedPlayer;
  ctl: PlayController;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {opponentsOfView(state, me.id).map((p) => (
        <Choice
          key={p.id}
          onClick={() => {
            ctl.closePrompt();
            void ctl.send({
              type: 'PLAY_DEBT_COLLECTOR',
              playerId: me.id,
              cardId: prompt.cardId,
              targetPlayerId: p.id,
            });
          }}
        >
          <PlayerLine player={p} />
        </Choice>
      ))}
    </div>
  );
}

/**
 * Les trois actions du tête-à-tête ne demandent qu'une chose : qui. Elles
 * partagent donc un même écran, avec la phrase qui change — c'est elle qui dit
 * ce qu'on s'apprête à faire, et elle vaut mieux qu'un titre générique.
 */
function TargetPrompt({
  prompt,
  state,
  me,
  ctl,
}: {
  prompt: Extract<Prompt, { kind: 'FINE' | 'RATP_CHECK' | 'TAIL' }>;
  state: RedactedState;
  me: RedactedPlayer;
  ctl: PlayController;
}) {
  const envoyer = (targetPlayerId: string) => {
    ctl.closePrompt();
    const base = { playerId: me.id, cardId: prompt.cardId, targetPlayerId };
    if (prompt.kind === 'FINE') void ctl.send({ type: 'PLAY_FINE', ...base });
    else if (prompt.kind === 'RATP_CHECK') {
      void ctl.send({ type: 'PLAY_RATP_CHECK', ...base });
    } else void ctl.send({ type: 'PLAY_TAIL', ...base });
  };

  const adversaires = opponentsOfView(state, me.id);
  const mesLots = completeColors(me).length;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {adversaires.map((p) => {
        // On dit ce qui va se passer chez lui, et ce qui l'empêcherait : le
        // moteur refusera de toute façon, autant le savoir avant de taper.
        const sesLots = completeColors(p).length;
        const mene =
          sesLots > mesLots || (sesLots === mesLots && bankTotal(p) > bankTotal(me));
        const bloque =
          (prompt.kind === 'RATP_CHECK' && !mene) ||
          (prompt.kind === 'TAIL' && p.handCount === 0);
        const raison =
          prompt.kind === 'RATP_CHECK'
            ? bloque
              ? 'ne mène pas'
              : `mène — ${RATP_CHECK_AMOUNT} M`
            : prompt.kind === 'TAIL'
              ? bloque
                ? 'main vide'
                : `${p.handCount} cartes en main`
              : `${p.handCount} cartes en main`;
        return (
          <Choice key={p.id} onClick={() => envoyer(p.id)} disabled={bloque}>
            <PlayerLine player={p} />
            <span className="text-ink-soft">{raison}</span>
          </Choice>
        );
      })}
    </div>
  );
}

/** Loyer : couleur réclamée, adversaire visé, Double loyer éventuel. */
function RentPrompt({
  prompt,
  state,
  me,
  ctl,
  actionsLeft,
}: {
  prompt: Extract<Prompt, { kind: 'RENT' }>;
  state: RedactedState;
  me: RedactedPlayer;
  ctl: PlayController;
  actionsLeft: number;
}) {
  const colors = rentableColors(me, prompt.cardId);
  const card = getCard(prompt.cardId);
  const universal = card.kind === 'RENT' && card.universal;
  const opponents = opponentsOfView(state, me.id);
  const doubles = me.hand.filter(isDoubleRent);
  const [color, setColor] = useState<Color | null>(colors[0] ?? null);
  const [victim, setVictim] = useState<string | null>(null);
  const [picked, setPicked] = useState<CardId[]>([]);

  if (colors.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Tu ne possèdes aucune carte dans les couleurs de cette carte Loyer.
      </p>
    );
  }

  // Le loyer coûte 1 action, chaque Double loyer une de plus.
  const cost = 1 + picked.length;
  const affordable = cost <= actionsLeft;
  // Le montant vient du moteur, pas d'un calcul parallèle. Recopié ici, il
  // oubliait Maison et Hôtel : la fenêtre annonçait 6 M là où l'adversaire en
  // payait 13, et les constructions semblaient sans effet.
  const base = color ? bestRentForColor(me, color) : 0;
  const amount = base * 2 ** picked.length;

  return (
    <>
      <Section title="Couleur réclamée">
        <div className="flex flex-wrap gap-2">
          {colors.map((c) => (
            <Choice key={c} selected={c === color} onClick={() => setColor(c)}>
              <ColorChip color={c} />
            </Choice>
          ))}
        </div>
      </Section>

      {doubles.length > 0 && (
        <Section title="Double loyer">
          <div className="flex flex-wrap gap-2">
            {doubles.map((id) => {
              const on = picked.includes(id);
              return (
                <Choice
                  key={id}
                  selected={on}
                  disabled={!on && 1 + picked.length + 1 > actionsLeft}
                  onClick={() =>
                    setPicked((cur) =>
                      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
                    )
                  }
                >
                  ×2 <span className="text-ink-soft">(1 action de plus)</span>
                </Choice>
              );
            })}
          </div>
        </Section>
      )}

      {universal ? (
        <Section title="À qui">
          <div className="grid gap-2 sm:grid-cols-2">
            {opponents.map((p) => (
              <Choice key={p.id} selected={p.id === victim} onClick={() => setVictim(p.id)}>
                <PlayerLine player={p} />
              </Choice>
            ))}
          </div>
        </Section>
      ) : (
        <Section title="À qui">
          <p className="text-sm font-bold">
            À tous les adversaires — {opponents.length} joueur
            {opponents.length > 1 ? 's' : ''}, {amount} M chacun.
          </p>
        </Section>
      )}

      <div className="mb-3 rounded-card border-2 border-ink/20 bg-paper px-3 py-2 text-sm font-bold">
        Loyer réclamé :{' '}
        <span className="text-mono-red">{amount} M</span>
        <span className="ml-2 font-semibold text-ink-soft">
          — {cost} action{cost > 1 ? 's' : ''} sur {actionsLeft} restantes
        </span>
      </div>

      <Button
        disabled={!color || (universal && !victim) || !affordable || amount === 0}
        onClick={() => {
          if (!color || (universal && !victim)) return;
          ctl.closePrompt();
          void ctl.send({
            type: 'PLAY_RENT',
            playerId: me.id,
            cardId: prompt.cardId,
            color,
            ...(universal && victim ? { targetPlayerId: victim } : {}),
            doubleCardIds: picked,
          });
        }}
      >
        Réclamer {amount} M{!universal && opponents.length > 1 ? ' à chacun' : ''}
      </Button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Aiguillage
// ---------------------------------------------------------------------------

const TITLES: Record<Prompt['kind'], string> = {
  COLOR: 'Dans quel lot ?',
  BUILDING: 'Sur quel lot ?',
  DEAL_BREAKER: 'Quel lot complet ?',
  SLY_DEAL: 'Quelle propriété ?',
  FORCED_DEAL: 'Quel échange ?',
  DEBT_COLLECTOR: 'Qui paie ?',
  FINE: 'Qui écope ?',
  RATP_CHECK: 'Qui contrôle-t-on ?',
  TAIL: 'Qui file-t-on ?',
  RENT: 'Quel loyer ?',
};

export function PromptModal({
  ctl,
  state,
  me,
  actionsLeft,
}: {
  ctl: PlayController;
  state: RedactedState;
  me: RedactedPlayer;
  actionsLeft: number;
}) {
  const prompt = ctl.prompt;
  const subtitle = prompt ? cardTitle(prompt.cardId) : undefined;

  return (
    <Modal
      open={Boolean(prompt)}
      title={prompt ? TITLES[prompt.kind] : ''}
      subtitle={subtitle}
      onClose={ctl.closePrompt}
    >
      {prompt?.kind === 'COLOR' && <ColorPrompt prompt={prompt} me={me} ctl={ctl} />}
      {prompt?.kind === 'BUILDING' && (
        <BuildingPrompt prompt={prompt} me={me} ctl={ctl} />
      )}
      {prompt?.kind === 'DEAL_BREAKER' && (
        <DealBreakerPrompt prompt={prompt} state={state} me={me} ctl={ctl} />
      )}
      {prompt?.kind === 'SLY_DEAL' && (
        <SlyDealPrompt prompt={prompt} state={state} me={me} ctl={ctl} />
      )}
      {prompt?.kind === 'FORCED_DEAL' && (
        <ForcedDealPrompt prompt={prompt} state={state} me={me} ctl={ctl} />
      )}
      {prompt?.kind === 'DEBT_COLLECTOR' && (
        <DebtCollectorPrompt prompt={prompt} state={state} me={me} ctl={ctl} />
      )}
      {(prompt?.kind === 'FINE' ||
        prompt?.kind === 'RATP_CHECK' ||
        prompt?.kind === 'TAIL') && (
        <TargetPrompt prompt={prompt} state={state} me={me} ctl={ctl} />
      )}
      {prompt?.kind === 'RENT' && (
        <RentPrompt
          prompt={prompt}
          state={state}
          me={me}
          ctl={ctl}
          actionsLeft={actionsLeft}
        />
      )}
    </Modal>
  );
}

function cardTitle(cardId: CardId): string {
  const card = getCard(cardId);
  return card.kind === 'ACTION' ? actionLabel(card.action) : card.label;
}
