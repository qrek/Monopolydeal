/**
 * Banque d'un joueur : le total est toujours visible, le détail carte par carte
 * apparaît au survol (et au focus clavier).
 */

'use client';

import { CardFace } from '@/components/cards/CardFace';
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

/** Ma banque : les billets posés en éventail serré, montant lisible. */
export function BankRow({ cards, cardWidth }: { cards: CardId[]; cardWidth: number }) {
  if (cards.length === 0) {
    return <p className="py-1 text-[0.7rem] text-ink-soft">Banque vide</p>;
  }
  // 62 % de révélation : assez pour que le montant, centré, reste entier.
  const step = Math.round(cardWidth * 0.62);
  return (
    <div
      className="relative shrink-0"
      style={{
        width: cardWidth + step * (cards.length - 1),
        height: Math.round(cardWidth * 1.4),
      }}
    >
      {cards.map((id, i) => (
        <div key={id} className="absolute top-0" style={{ left: i * step, zIndex: i }}>
          <CardFace cardId={id} width={cardWidth} />
        </div>
      ))}
    </div>
  );
}
