/**
 * Lots de propriétés d'un joueur, avec leur complétion (2/3) et leurs
 * constructions. Un joueur peut détenir plusieurs lots d'une même couleur : on
 * rend donc les lots, jamais un compteur par couleur.
 */

'use client';

import { memo } from 'react';

import { CardFace } from '@/components/cards/CardFace';
import {
  COLORS,
  getCard,
  groupRent,
  isGroupComplete,
  type CardId,
  type PropertyGroup,
} from '@/lib/engine';
import { readableInk } from '@/lib/ui/color';

interface GroupProps {
  group: PropertyGroup;
  cardWidth: number;
  /** Hauteur disponible : l'empilement se resserre pour y tenir. */
  maxHeight?: number;
  /** Déplacer un joker déjà posé : geste gratuit, réservé à mon tour. */
  onMoveWild?: (cardId: CardId) => void;
}

function isWild(id: CardId): boolean {
  const k = getCard(id).kind;
  return k === 'WILD' || k === 'WILD_ANY';
}

export const GroupStack = memo(function GroupStack({
  group,
  cardWidth,
  maxHeight,
  onMoveWild,
}: GroupProps) {
  const cfg = COLORS[group.color];
  const complete = isGroupComplete(group);
  const rent = groupRent(group);
  const cardHeight = Math.round(cardWidth * 1.4);
  const gaps = Math.max(1, group.cards.length - 1);
  // Les cartes se chevauchent : seul le bandeau du dessous dépasse. Un lot de
  // Gares en compte 4 ; plutôt que de déborder de sa bande, l'empilement se
  // resserre jusqu'au recouvrement minimum.
  const step = Math.max(
    4,
    Math.min(
      Math.round(cardWidth * 0.26),
      maxHeight ? Math.floor((maxHeight - cardHeight) / gaps) : Infinity,
    ),
  );
  const height = cardHeight + step * Math.max(0, group.cards.length - 1);

  return (
    <div className="relative flex shrink-0 flex-col items-center gap-1">
      <div className="relative" style={{ width: cardWidth, height }}>
        {group.cards.map((id, i) => {
          const movable = onMoveWild && isWild(id);
          return (
            <div
              key={id}
              className={`absolute left-0 transition-transform duration-200 ${
                movable ? 'cursor-pointer hover:-translate-y-1' : ''
              }`}
              style={{ top: i * step, zIndex: i }}
              onClick={movable ? () => onMoveWild(id) : undefined}
              title={movable ? 'Déplacer ce joker (gratuit)' : undefined}
            >
              <CardFace cardId={id} width={cardWidth} />
            </div>
          );
        })}
      </div>

      <div
        // La pastille passe SUR l'empilement : posée dessous, elle coûtait
        // 16 px par rangée, qu'un téléphone en paysage n'a pas.
        // z-10 car les cartes portent un z-index croissant et passeraient
        // sinon par-dessus.
        className="pointer-events-none absolute bottom-0.5 z-10 flex items-center gap-0.5"
      >
        <span
          className={`rounded-[0.2rem] border border-ink/70 px-1 py-px text-[0.6rem] font-extrabold leading-none tabular-nums ${
            complete ? '' : 'bg-cream text-ink-soft'
          }`}
          style={
            complete ? { background: cfg.hex, color: readableInk(cfg.hex) } : undefined
          }
          title={
            complete
              ? `Lot complet — loyer ${rent} M`
              : `${group.cards.length} sur ${cfg.size} — loyer ${rent} M`
          }
        >
          {group.cards.length}/{cfg.size}
        </span>
        {group.house && (
          <span className="text-[0.7rem] leading-none text-[#1FB25A]" title="Maison : +3 M">
            ⌂
          </span>
        )}
        {group.hotel && (
          <span className="text-[0.7rem] leading-none text-mono-red" title="Hôtel : +4 M">
            ⌂⌂
          </span>
        )}
      </div>
    </div>
  );
});

export function PropertyGroups({
  groups,
  cardWidth,
  maxHeight,
  onMoveWild,
  empty = 'Aucune propriété',
}: {
  groups: PropertyGroup[];
  cardWidth: number;
  maxHeight?: number;
  onMoveWild?: (cardId: CardId) => void;
  empty?: string;
}) {
  if (groups.length === 0) {
    return <p className="py-1 text-[0.7rem] text-ink-soft">{empty}</p>;
  }
  return (
    <div className="no-scrollbar flex items-start gap-1.5 overflow-x-auto">
      {groups.map((g) => (
        <GroupStack
          key={g.id}
          group={g}
          cardWidth={cardWidth}
          maxHeight={maxHeight}
          onMoveWild={onMoveWild}
        />
      ))}
    </div>
  );
}
