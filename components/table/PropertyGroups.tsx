/**
 * Lots de propriétés d'un joueur, avec l'état de complétion (2/3) et les
 * constructions. Un joueur peut détenir plusieurs lots d'une même couleur :
 * on rend donc les lots, jamais un compteur par couleur.
 */

import { CardFace } from '@/components/cards/CardFace';
import {
  COLORS,
  groupRent,
  isGroupComplete,
  type PropertyGroup,
} from '@/lib/engine';
import { readableInk } from '@/lib/ui/color';

interface GroupProps {
  group: PropertyGroup;
  cardWidth: number;
}

export function GroupStack({ group, cardWidth }: GroupProps) {
  const cfg = COLORS[group.color];
  const complete = isGroupComplete(group);
  const rent = groupRent(group);
  // Les cartes se chevauchent : seule la bande de couleur du dessous dépasse.
  const step = Math.round(cardWidth * 0.34);
  const height = Math.round(cardWidth * 1.4) + step * Math.max(0, group.cards.length - 1);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: cardWidth, height }}>
        {group.cards.map((id, i) => (
          <div key={id} className="absolute left-0" style={{ top: i * step, zIndex: i }}>
            <CardFace cardId={id} width={cardWidth} />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <span
          className={`rounded-full px-1.5 py-0.5 text-[0.65rem] font-extrabold tabular-nums leading-none ${
            complete ? '' : 'bg-white/10 text-muted'
          }`}
          style={
            complete
              ? { background: cfg.hex, color: readableInk(cfg.hex) }
              : undefined
          }
          title={
            complete
              ? `Lot complet — loyer ${rent}M`
              : `${group.cards.length} sur ${cfg.size} — loyer ${rent}M`
          }
        >
          {group.cards.length}/{cfg.size}
        </span>
        {group.house && (
          <span
            className="text-[0.65rem] leading-none text-gold"
            title="Maison : +3M de loyer"
          >
            ⌂
          </span>
        )}
        {group.hotel && (
          <span
            className="text-[0.65rem] font-extrabold leading-none text-gold"
            title="Hôtel : +4M de loyer"
          >
            ⌂⌂
          </span>
        )}
      </div>
    </div>
  );
}

export function PropertyGroups({
  groups,
  cardWidth,
  empty = 'Aucune propriété',
}: {
  groups: PropertyGroup[];
  cardWidth: number;
  empty?: string;
}) {
  if (groups.length === 0) {
    return <p className="py-2 text-xs text-muted">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap items-start gap-2">
      {groups.map((g) => (
        <GroupStack key={g.id} group={g} cardWidth={cardWidth} />
      ))}
    </div>
  );
}
