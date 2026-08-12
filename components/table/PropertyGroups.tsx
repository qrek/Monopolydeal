/**
 * Lots de propriétés d'un joueur, avec leur complétion (2/3) et leurs
 * constructions. Un joueur peut détenir plusieurs lots d'une même couleur : on
 * rend donc les lots, jamais un compteur par couleur.
 */

'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { CardFace } from '@/components/cards/CardFace';
import { useLongPress } from '@/components/cards/CardInspector';
import {
  COLORS,
  getCard,
  groupRent,
  isGroupComplete,
  type CardId,
  type Color,
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

/**
 * Une carte d'un lot. Composant à part parce qu'un appui long y ouvre la
 * loupe, et qu'un hook ne se déclare pas dans une boucle.
 */
function StackedCard({
  cardId,
  width,
  top,
  depth,
  color,
  onMoveWild,
}: {
  cardId: CardId;
  width: number;
  top: number;
  depth: number;
  /** Couleur du lot : c'est elle qui met le joker bicolore à l'endroit. */
  color: Color;
  onMoveWild?: (cardId: CardId) => void;
}) {
  const press = useLongPress(cardId);
  return (
    <div
      {...press}
      className={`absolute left-0 touch-none transition-transform duration-200 ${
        onMoveWild ? 'cursor-pointer hover:-translate-y-1' : ''
      }`}
      style={{ top, zIndex: depth }}
      onClick={(e) => {
        // L'appui long a déjà ouvert la loupe : ce clic n'est qu'un résidu.
        press.onClick(e);
        if (!e.defaultPrevented) onMoveWild?.(cardId);
      }}
      title={onMoveWild ? 'Déplacer ce joker (gratuit)' : 'Appui long pour agrandir'}
    >
      <CardFace cardId={cardId} width={width} orient={color} />
    </div>
  );
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
        {group.cards.map((id, i) => (
          <StackedCard
            key={id}
            cardId={id}
            width={cardWidth}
            top={i * step}
            depth={i}
            color={group.color}
            onMoveWild={onMoveWild && isWild(id) ? onMoveWild : undefined}
          />
        ))}
      </div>

      <div
        // La pastille passe SUR l'empilement : posée dessous, elle coûtait
        // 16 px par rangée, qu'un téléphone en paysage n'a pas.
        // z-10 car les cartes portent un z-index croissant et passeraient
        // sinon par-dessus.
        className="pointer-events-none absolute bottom-0.5 z-10 flex items-center gap-0.5"
      >
        <span
          // L'avancement d'un lot est ce qu'on scrute chez soi comme chez les
          // autres : il mérite d'être lisible d'un coup d'œil.
          className={`rounded-[0.25rem] border-2 border-ink/80 px-1 py-0.5 text-[0.7rem] font-extrabold leading-none tabular-nums shadow-card ${
            complete ? '' : 'bg-cream text-ink'
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

/**
 * Combien de lots restent hors champ, à droite.
 *
 * Le défilement horizontal existait déjà, mais sans barre : passé un certain
 * nombre de lots, les derniers disparaissaient purement et simplement, sans que
 * rien ne dise qu'il y avait quelque chose à voir. Un compteur et un dégradé
 * valent mieux qu'un défilement qu'on ne soupçonne pas.
 */
function useHiddenCount(): [
  (el: HTMLDivElement | null) => void,
  number,
] {
  const el = useRef<HTMLDivElement | null>(null);
  const [hidden, setHidden] = useState(0);

  const read = useCallback(() => {
    const node = el.current;
    if (!node) return;
    const bord = node.getBoundingClientRect().right;
    let n = 0;
    for (const enfant of node.children) {
      // Un lot rogné de plus de deux pixels compte comme caché : sous ce seuil
      // c'est un arrondi de mise en page, pas une carte qu'on rate.
      if (enfant.getBoundingClientRect().right > bord + 2) n++;
    }
    setHidden(n);
  }, []);

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      el.current = node;
      read();
    },
    [read],
  );

  // Après CHAQUE rendu, et pas seulement au redimensionnement : un lot qui
  // s'ajoute ne change pas la taille du conteneur, donc l'observateur ne se
  // déclenchait pas et le compteur restait à zéro toute la partie — c'est-à-dire
  // exactement dans le cas qu'il est censé signaler. `setHidden` avec la même
  // valeur ne provoque pas de nouveau rendu : la boucle se referme d'elle-même.
  useEffect(read);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const ro = new ResizeObserver(read);
    ro.observe(node);
    node.addEventListener('scroll', read, { passive: true });
    return () => {
      ro.disconnect();
      node.removeEventListener('scroll', read);
    };
  }, [read]);

  return [ref, hidden];
}

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
  const [scroller, hidden] = useHiddenCount();

  if (groups.length === 0) {
    return <p className="py-1 text-[0.7rem] text-ink-soft">{empty}</p>;
  }
  return (
    <div className="relative min-w-0">
      <div ref={scroller} className="no-scrollbar flex items-start gap-1.5 overflow-x-auto">
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

      {hidden > 0 && (
        <>
          {/* Dégradé au bord : il dit qu'on peut faire glisser, sans occuper de
              place ni intercepter le doigt. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-board to-transparent"
          />
          <span
            className="pointer-events-none absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-[0.25rem] border-2 border-ink bg-cream px-1 py-0.5 text-[0.6rem] font-extrabold leading-none tabular-nums text-ink shadow-card"
            title={`${hidden} lot${hidden > 1 ? 's' : ''} hors champ — faites glisser`}
          >
            +{hidden}
          </span>
        </>
      )}
    </div>
  );
}
