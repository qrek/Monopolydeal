/**
 * Banque d'un joueur : le total est toujours visible, le détail carte par carte
 * apparaît au survol (et au focus clavier).
 */

'use client';

import { memo } from 'react';

import { CardFace } from '@/components/cards/CardFace';
import { useLongPress } from '@/components/cards/CardInspector';
import { getCard, type CardId } from '@/lib/engine';

function total(cards: CardId[]): number {
  return cards.reduce((sum, id) => sum + getCard(id).value, 0);
}

export function BankTotal({ cards }: { cards: CardId[] }) {
  return (
    <span className="tabular-nums font-extrabold text-ink">{total(cards)} M</span>
  );
}

export function BankDetail({ cards }: { cards: CardId[] }) {
  if (cards.length === 0) {
    return <div className="text-xs text-ink-soft">Banque vide</div>;
  }
  return (
    <ul className="space-y-0.5 text-xs">
      {cards.map((id) => {
        const card = getCard(id);
        return (
          <li key={id} className="flex justify-between gap-3">
            <span className="truncate text-ink">{card.label}</span>
            <span className="shrink-0 tabular-nums font-bold text-ink-soft">
              {card.value} M
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Un billet posé. À part pour porter l'appui long, qui ouvre la loupe. */
function BankNote({
  cardId,
  width,
  left,
  depth,
}: {
  cardId: CardId;
  width: number;
  left: number;
  depth: number;
}) {
  const press = useLongPress(cardId);
  return (
    <div
      {...press}
      className="absolute top-0 touch-none"
      style={{ left, zIndex: depth }}
      title="Appui long pour agrandir"
    >
      <CardFace cardId={cardId} width={width} />
    </div>
  );
}

/** Ma banque : les billets posés en éventail serré, montant lisible. */
export const BankRow = memo(function BankRow({
  cards,
  cardWidth,
  maxWidth,
}: {
  cards: CardId[];
  cardWidth: number;
  /** Largeur disponible : au-delà, les billets se recouvrent davantage. */
  maxWidth?: number;
}) {
  if (cards.length === 0) {
    return <p className="py-1 text-[0.7rem] text-ink-soft">Banque vide</p>;
  }
  // 62 % de révélation : assez pour que le montant, centré, reste entier. Une
  // banque bien remplie se resserre plutôt que de pousser mes propriétés
  // hors de l'écran, sans jamais descendre sous le coin lisible du billet.
  const gaps = Math.max(1, cards.length - 1);
  const step = Math.max(
    Math.round(cardWidth * 0.2),
    Math.min(
      Math.round(cardWidth * 0.62),
      maxWidth ? Math.floor((maxWidth - cardWidth) / gaps) : Infinity,
    ),
  );
  return (
    <div
      className="relative shrink-0"
      style={{
        width: cardWidth + step * (cards.length - 1),
        height: Math.round(cardWidth * 1.4),
      }}
    >
      {cards.map((id, i) => (
        <BankNote key={id} cardId={id} width={cardWidth} left={i * step} depth={i} />
      ))}
    </div>
  );
});
