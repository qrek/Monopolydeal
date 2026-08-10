/**
 * Rendu d'une carte, entièrement en CSS/SVG — aucune image externe.
 *
 * Une seule mesure pilote tout : `width`. La hauteur suit le ratio 5:7 et la
 * taille de police est proportionnelle, si bien que les mêmes composants
 * servent à la main (grande), aux lots (petite) et à la banque (minuscule).
 */

import { ActionGlyph } from '@/components/cards/ActionGlyph';
import { COLORS, getCard, type Card, type CardId, type Color } from '@/lib/engine';
import { readableInk } from '@/lib/ui/color';

const RATIO = 1.4;

/** En dessous d'une certaine largeur, le texte devient illisible : on l'enlève. */
type Detail = 'full' | 'compact' | 'minimal';

function detailFor(width: number): Detail {
  if (width >= 80) return 'full';
  if (width >= 46) return 'compact';
  return 'minimal';
}

interface CardFaceProps {
  cardId: CardId;
  width?: number;
}

/**
 * Valeur banque, en pastille. Réservée au grand format : dans un lot, les
 * cartes se chevauchent et la même pastille répétée trois fois n'est que du
 * bruit. Les écrans qui en ont besoin (paiement) afficheront les montants.
 */
function ValueBadge({ value, detail }: { value: number; detail: Detail }) {
  if (value <= 0 || detail !== 'full') return null;
  return (
    <span className="absolute right-[0.35em] top-[0.35em] grid size-[1.8em] place-items-center rounded-full bg-black/75 text-[0.72em] font-extrabold leading-none text-white">
      {value}
    </span>
  );
}

function Frame({
  children,
  width,
  background,
  className = '',
}: {
  children: React.ReactNode;
  width: number;
  background: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[0.55em] border border-black/25 shadow-lift ${className}`}
      style={{
        width,
        height: Math.round(width * RATIO),
        fontSize: width * 0.115,
        background,
      }}
    >
      {children}
    </div>
  );
}

/** Échelle de loyers de la couleur : 1 carte → 1M, 2 → 2M, 3 → 4M… */
function RentLadder({ color, ink }: { color: Color; ink: string }) {
  return (
    <ul
      className="mt-auto space-y-[0.12em] text-[0.62em] font-bold leading-tight"
      style={{ color: ink }}
    >
      {COLORS[color].rents.map((rent, i) => (
        <li key={rent} className="flex justify-between tabular-nums opacity-80">
          <span>{i + 1}</span>
          <span>{rent}M</span>
        </li>
      ))}
    </ul>
  );
}

function PropertyFace({ card, width }: { card: Card & { kind: 'PROPERTY' }; width: number }) {
  const cfg = COLORS[card.color];
  const ink = readableInk(cfg.hex);
  const detail = detailFor(width);

  return (
    <Frame width={width} background="#f4f2e9">
      <div
        className="flex h-[42%] items-center justify-center px-[0.4em] text-center"
        style={{ background: cfg.hex, color: ink }}
      >
        {/* En lot, les cartes se chevauchent et seule la bande dépasse :
            répéter « VERT » trois fois n'apprend rien et devient illisible.
            Le nom de la couleur n'apparaît donc qu'en grand format. */}
        {detail === 'full' && (
          <span className="text-[0.66em] font-extrabold uppercase tracking-wide leading-none">
            {cfg.label}
          </span>
        )}
      </div>
      {detail !== 'minimal' && (
        <div className="flex h-[58%] flex-col p-[0.4em] text-[#141a16]">
          <p className="text-[0.7em] font-extrabold leading-[1.15] line-clamp-3">
            {card.label}
          </p>
          {detail === 'full' && <RentLadder color={card.color} ink="#141a16" />}
        </div>
      )}
      <ValueBadge value={card.value} detail={detail} />
    </Frame>
  );
}

function WildFace({ card, width }: { card: Card & { kind: 'WILD' }; width: number }) {
  const [a, b] = card.colors;
  const ca = COLORS[a];
  const cb = COLORS[b];
  const detail = detailFor(width);

  return (
    <Frame
      width={width}
      // Coupe franche en diagonale : deux aplats, aucun dégradé.
      background={`linear-gradient(115deg, ${ca.hex} 0 50%, ${cb.hex} 50% 100%)`}
    >
      {detail !== 'minimal' && (
        <div className="flex h-full flex-col justify-between p-[0.4em]">
          <span
            className="text-[0.62em] font-extrabold uppercase leading-none"
            style={{ color: readableInk(ca.hex) }}
          >
            {ca.label}
          </span>
          <span className="self-center text-[0.68em] font-extrabold uppercase tracking-widest text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            Joker
          </span>
          <span
            className="self-end text-right text-[0.62em] font-extrabold uppercase leading-none"
            style={{ color: readableInk(cb.hex) }}
          >
            {cb.label}
          </span>
        </div>
      )}
      <ValueBadge value={card.value} detail={detail} />
    </Frame>
  );
}

/** Les 10 couleurs en bandes franches : le joker qui prend n'importe quel lot. */
const RAINBOW = `linear-gradient(90deg, ${(Object.keys(COLORS) as Color[])
  .map((c, i, all) => `${COLORS[c].hex} ${(i / all.length) * 100}% ${((i + 1) / all.length) * 100}%`)
  .join(', ')})`;

function WildAnyFace({ card, width }: { card: Card & { kind: 'WILD_ANY' }; width: number }) {
  const detail = detailFor(width);
  return (
    <Frame width={width} background={RAINBOW}>
      {detail !== 'minimal' && (
        <div className="grid h-full place-items-center p-[0.3em]">
          <span className="rounded-[0.3em] bg-black/75 px-[0.4em] py-[0.3em] text-center text-[0.6em] font-extrabold uppercase leading-tight tracking-wide text-white">
            Joker
            {detail === 'full' && (
              <>
                <br />
                universel
              </>
            )}
          </span>
        </div>
      )}
    </Frame>
  );
}

function MoneyFace({ card, width }: { card: Card & { kind: 'MONEY' }; width: number }) {
  return (
    <Frame width={width} background="#e9dcae">
      {/* Trame de billet : de simples rayures CSS. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, #8a7a44 0 1px, transparent 1px 6px)',
        }}
      />
      {/* Repère d'angle : en éventail, seule la tranche gauche de la carte
          dépasse, et un billet ne se reconnaît qu'à son montant. */}
      <span className="absolute left-[0.35em] top-[0.25em] text-[0.8em] font-extrabold leading-none text-[#4a3f16]">
        {card.value}M
      </span>
      <div className="relative grid h-full place-items-center">
        <span className="text-[1.9em] font-extrabold leading-none text-[#4a3f16]">
          {card.value}
          <span className="text-[0.5em]">M</span>
        </span>
      </div>
    </Frame>
  );
}

function ActionFace({ card, width }: { card: Card & { kind: 'ACTION' }; width: number }) {
  const detail = detailFor(width);
  return (
    <Frame width={width} background="#1b2420">
      <div className="flex h-full flex-col items-center justify-center gap-[0.3em] p-[0.35em] text-center">
        <ActionGlyph kind={card.action} className="w-[2.6em] text-gold" />
        {detail !== 'minimal' && (
          <span className="text-[0.62em] font-extrabold uppercase leading-tight tracking-wide text-ink">
            {card.label}
          </span>
        )}
      </div>
      <ValueBadge value={card.value} detail={detail} />
    </Frame>
  );
}

function RentFace({ card, width }: { card: Card & { kind: 'RENT' }; width: number }) {
  const detail = detailFor(width);
  // Un loyer non universel porte toujours exactement deux couleurs imprimées.
  const first = card.colors[0];
  const second = card.colors[1];
  const background =
    card.universal || !first || !second
      ? RAINBOW
      : `linear-gradient(180deg, ${COLORS[first].hex} 0 50%, ${COLORS[second].hex} 50% 100%)`;

  return (
    <Frame width={width} background={background}>
      <div className="grid h-full place-items-center p-[0.3em]">
        <span className="rounded-[0.3em] bg-black/75 px-[0.45em] py-[0.3em] text-center text-[0.62em] font-extrabold uppercase leading-tight tracking-widest text-white">
          Loyer
          {detail === 'full' && card.universal && (
            <>
              <br />
              <span className="tracking-normal">universel</span>
            </>
          )}
        </span>
      </div>
      <ValueBadge value={card.value} detail={detail} />
    </Frame>
  );
}

export function CardFace({ cardId, width = 96 }: CardFaceProps) {
  const card = getCard(cardId);

  switch (card.kind) {
    case 'PROPERTY':
      return <PropertyFace card={card} width={width} />;
    case 'WILD':
      return <WildFace card={card} width={width} />;
    case 'WILD_ANY':
      return <WildAnyFace card={card} width={width} />;
    case 'MONEY':
      return <MoneyFace card={card} width={width} />;
    case 'ACTION':
      return <ActionFace card={card} width={width} />;
    case 'RENT':
      return <RentFace card={card} width={width} />;
  }
}

/** Dos de carte : pioche, défausse et mains adverses. */
export function CardBack({ width = 96 }: { width?: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-[0.55em] border border-white/15 shadow-lift"
      style={{
        width,
        height: Math.round(width * RATIO),
        fontSize: width * 0.115,
        background: '#173026',
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, #2b4a39 0 3px, transparent 3px 9px)',
        }}
      />
      <div className="absolute inset-[0.35em] rounded-[0.35em] border border-gold/30" />
    </div>
  );
}
