/**
 * Banque d'un joueur : le total est toujours visible, le détail carte par carte
 * apparaît au survol (et au focus clavier, et au tap sur mobile via <details>).
 */

import { CardFace } from '@/components/cards/CardFace';
import { getCard, type CardId } from '@/lib/engine';

function total(cards: CardId[]): number {
  return cards.reduce((sum, id) => sum + getCard(id).value, 0);
}

export function BankTotal({ cards }: { cards: CardId[] }) {
  return (
    <span className="tabular-nums font-extrabold text-gold">{total(cards)}M</span>
  );
}

/** Détail au survol : la liste des cartes et leur valeur. */
export function BankDetail({ cards }: { cards: CardId[] }) {
  if (cards.length === 0) {
    return <div className="text-xs text-muted">Banque vide</div>;
  }
  return (
    <ul className="space-y-0.5 text-xs">
      {cards.map((id) => {
        const card = getCard(id);
        return (
          <li key={id} className="flex justify-between gap-3">
            <span className="truncate text-ink/80">{card.label}</span>
            <span className="shrink-0 tabular-nums font-bold text-gold">
              {card.value}M
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Banque du joueur du bas : les cartes sont posées, en éventail serré. */
export function BankRow({ cards, cardWidth }: { cards: CardId[]; cardWidth: number }) {
  if (cards.length === 0) {
    return <p className="py-2 text-xs text-muted">Banque vide</p>;
  }
  // 62 % de révélation : assez pour que le montant, centré, reste entier.
  const step = Math.round(cardWidth * 0.62);
  return (
    <div
      className="relative"
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
