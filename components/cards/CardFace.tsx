/**
 * Rendu d'une carte, entièrement en CSS/SVG — aucune image externe.
 *
 * Direction artistique Monopoly Deal : face crème cernée d'un filet noir,
 * bandeau de couleur portant le NOM DE LA RUE (et non celui de la couleur —
 * écrire « bleu » sur du bleu n'apprend rien), grille de loyers en dessous, et
 * pour les actions le texte de règle imprimé sur la carte.
 *
 * Une seule mesure pilote tout : `width`. La hauteur suit le ratio 5:7 et la
 * police est proportionnelle, si bien que les mêmes composants servent à la
 * main, aux lots et aux lots adverses.
 */

import { ActionGlyph } from '@/components/cards/ActionGlyph';
import {
  COLORS,
  HOTEL_RENT_BONUS,
  HOUSE_RENT_BONUS,
  getCard,
  type Card,
  type CardId,
  type Color,
} from '@/lib/engine';
import { ACTION_RULES, moneyHue, rentRule } from '@/lib/ui/cards';
import { readableInk } from '@/lib/ui/color';

const RATIO = 1.4;

/**
 * Le niveau de détail suit la taille : sous 46 px une carte n'est plus qu'un
 * aplat de couleur dans un lot, au-delà de 84 px elle porte tout son texte.
 */
type Detail = 'full' | 'compact' | 'minimal';

function detailFor(width: number): Detail {
  if (width >= 84) return 'full';
  if (width >= 46) return 'compact';
  return 'minimal';
}

interface CardFaceProps {
  cardId: CardId;
  width?: number;
}

/** Valeur banque, en coin haut-gauche comme sur les cartes du jeu. */
function ValueCorner({ value, detail }: { value: number; detail: Detail }) {
  if (value <= 0 || detail === 'minimal') return null;
  return (
    <span className="absolute left-[0.25em] top-[0.25em] grid h-[1.5em] min-w-[1.5em] place-items-center rounded-[0.2em] border border-ink/80 bg-cream px-[0.15em] text-[0.62em] font-extrabold leading-none text-ink">
      {value}M
    </span>
  );
}

function Frame({
  children,
  width,
  background,
}: {
  children: React.ReactNode;
  width: number;
  background: string;
}) {
  return (
    <div
      className="relative select-none overflow-hidden rounded-card border-2 border-ink shadow-card"
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

/**
 * Grille des loyers de la couleur : le loyer croît avec le nombre de cartes
 * possédées, et le lot complet ouvre les bonus de construction.
 */
function RentTable({ color, dense }: { color: Color; dense: boolean }) {
  const cfg = COLORS[color];
  return (
    // La grille occupe toute la hauteur restante : une carte à moitié vide ne
    // ressemble pas à une carte de jeu de société.
    <div className="flex min-h-0 flex-1 flex-col gap-[0.08em]">
      <span className="shrink-0 text-[0.5em] font-extrabold uppercase tracking-[0.12em] text-ink-soft">
        Loyer
      </span>
      {cfg.rents.map((rent, i) => {
        const complete = i === cfg.size - 1;
        return (
          <div
            key={rent}
            className={`flex min-h-0 flex-1 items-center justify-between rounded-[0.15em] px-[0.2em] text-[0.58em] font-bold leading-none tabular-nums ${
              complete ? 'bg-ink text-cream' : 'bg-ink/[0.07] text-ink'
            }`}
          >
            <span>
              {i + 1} carte{i > 0 ? 's' : ''}
            </span>
            <span>{rent} M</span>
          </div>
        );
      })}
      {!dense && cfg.buildable && (
        <p className="shrink-0 text-[0.46em] font-bold leading-tight text-ink-soft">
          Maison +{HOUSE_RENT_BONUS} M · Hôtel +{HOTEL_RENT_BONUS} M
        </p>
      )}
    </div>
  );
}

/** Bandeau de couleur portant le nom de la propriété. */
function NameBand({
  color,
  name,
  detail,
  heightPct,
}: {
  color: Color;
  name: string;
  detail: Detail;
  heightPct: number;
}) {
  const cfg = COLORS[color];
  const ink = readableInk(cfg.hex);
  // Un nom long doit rétrécir plutôt que déborder ou se faire tronquer.
  const scale = name.length > 26 ? 0.42 : name.length > 18 ? 0.48 : 0.55;
  return (
    <div
      className="flex items-center justify-center border-b-2 border-ink px-[0.25em] text-center"
      style={{ height: `${heightPct}%`, background: cfg.hex, color: ink }}
    >
      {detail !== 'minimal' && (
        <span
          className="font-extrabold uppercase leading-[1.1] tracking-tight"
          style={{ fontSize: `${scale}em` }}
        >
          {name}
        </span>
      )}
    </div>
  );
}

function PropertyFace({
  card,
  width,
}: {
  card: Card & { kind: 'PROPERTY' };
  width: number;
}) {
  const detail = detailFor(width);
  return (
    <Frame width={width} background="#FBF7EC">
      <NameBand
        color={card.color}
        name={card.label}
        detail={detail}
        heightPct={detail === 'minimal' ? 46 : 34}
      />
      {detail !== 'minimal' && (
        <div className="flex h-[66%] flex-col px-[0.3em] pb-[0.25em]">
          {detail === 'full' ? (
            <RentTable color={card.color} dense={false} />
          ) : (
            <RentTable color={card.color} dense />
          )}
        </div>
      )}
      <ValueCorner value={card.value} detail={detail} />
    </Frame>
  );
}

/** Joker bicolore : les deux bandeaux, chacun avec sa grille de loyers. */
function WildFace({ card, width }: { card: Card & { kind: 'WILD' }; width: number }) {
  const [a, b] = card.colors;
  const detail = detailFor(width);
  const ca = COLORS[a];
  const cb = COLORS[b];

  return (
    <Frame width={width} background="#FBF7EC">
      {/* Une moitié par couleur, chacune avec SA grille de loyers juste en
          dessous de son bandeau : sinon on ne sait pas quelle colonne va avec
          quelle couleur. */}
      <div className="flex h-full flex-col">
        {[
          { color: a, cfg: ca },
          { color: b, cfg: cb },
        ].map(({ color, cfg }, i) => (
          <div
            key={color}
            className={`flex h-1/2 flex-col ${i === 1 ? 'border-t-2 border-ink' : ''}`}
          >
            <div
              className="flex h-[30%] items-center justify-center border-b-2 border-ink px-[0.2em]"
              style={{ background: cfg.hex, color: readableInk(cfg.hex) }}
            >
              {detail !== 'minimal' && (
                <span className="text-[0.48em] font-extrabold uppercase leading-none tracking-tight">
                  {cfg.label}
                </span>
              )}
            </div>
            {detail === 'full' && (
              <div className="flex min-h-0 flex-1 flex-col px-[0.25em] pb-[0.15em]">
                <RentTable color={color} dense />
              </div>
            )}
          </div>
        ))}
      </div>
      {detail === 'compact' && (
        <span className="absolute inset-x-[0.2em] top-1/2 -translate-y-1/2 rounded-[0.15em] border border-ink bg-cream py-[0.1em] text-center text-[0.5em] font-extrabold uppercase leading-none tracking-tight text-ink">
          Joker
        </span>
      )}
      <ValueCorner value={card.value} detail={detail} />
    </Frame>
  );
}

/** Joker universel : les 10 couleurs en damier, comme sur la carte du jeu. */
function WildAnyFace({
  card,
  width,
}: {
  card: Card & { kind: 'WILD_ANY' };
  width: number;
}) {
  const detail = detailFor(width);
  const colors = Object.keys(COLORS) as Color[];
  return (
    <Frame width={width} background="#FBF7EC">
      <div className="grid h-full grid-cols-2 grid-rows-5">
        {colors.map((c) => (
          <span key={c} style={{ background: COLORS[c].hex }} />
        ))}
      </div>
      {detail !== 'minimal' && (
        <span className="absolute inset-x-[0.15em] top-1/2 -translate-y-1/2 rounded-[0.15em] border border-ink bg-cream py-[0.15em] text-center text-[0.5em] font-extrabold uppercase leading-tight tracking-tight text-ink">
          Joker
          {detail === 'full' && (
            <>
              <br />
              universel
            </>
          )}
        </span>
      )}
      <ValueCorner value={card.value} detail={detail} />
    </Frame>
  );
}

function MoneyFace({ card, width }: { card: Card & { kind: 'MONEY' }; width: number }) {
  const detail = detailFor(width);
  return (
    <Frame width={width} background={moneyHue(card.value)}>
      {/* Guilloché de billet : deux jeux de rayures CSS croisées. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, #4a3f16 0 1px, transparent 1px 7px)',
        }}
      />
      <div className="absolute inset-[0.28em] rounded-[0.2em] border border-ink/40" />
      <div className="relative grid h-full place-items-center">
        <span className="font-extrabold leading-none text-ink">
          <span className="text-[1.85em]">{card.value}</span>
          <span className="text-[0.85em]"> M</span>
        </span>
      </div>
      {detail !== 'minimal' && (
        <span className="absolute left-[0.3em] top-[0.25em] text-[0.62em] font-extrabold leading-none text-ink">
          {card.value} M
        </span>
      )}
    </Frame>
  );
}

/** La maison verte et l'hôtel rouge du plateau : deux repères universels. */
const GLYPH_TINT: Partial<Record<string, string>> = {
  HOUSE: '#1FB25A',
  HOTEL: '#ED1B24',
  JUST_SAY_NO: '#ED1B24',
};

/** En-tête rouge des cartes Action, comme la bande titre du jeu. */
function ActionBand({ label, detail }: { label: string; detail: Detail }) {
  return (
    <div className="flex h-[20%] items-center justify-center border-b-2 border-ink bg-mono-red px-[0.2em] text-center">
      {detail !== 'minimal' && (
        <span
          className="font-extrabold uppercase leading-[1.05] tracking-tight text-cream"
          style={{ fontSize: label.length > 14 ? '0.46em' : '0.54em' }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function ActionFace({ card, width }: { card: Card & { kind: 'ACTION' }; width: number }) {
  const detail = detailFor(width);
  return (
    <Frame width={width} background="#FBF7EC">
      <div className="flex h-full flex-col">
        <ActionBand label={card.label} detail={detail} />
        <div className="grid flex-1 place-items-center py-[0.15em]">
          <ActionGlyph
            kind={card.action}
            className="w-[2.4em]"
            style={{ color: GLYPH_TINT[card.action] ?? '#141414' }}
          />
        </div>
        {/* La règle imprimée sur la carte : on ne devrait jamais avoir à
            deviner ce que fait une action. */}
        {detail === 'full' && (
          <p className="mx-[0.25em] mb-[0.25em] rounded-[0.15em] border border-ink/30 bg-ink/[0.05] px-[0.25em] py-[0.2em] text-[0.44em] font-semibold leading-[1.25] text-ink">
            {ACTION_RULES[card.action]}
          </p>
        )}
      </div>
      <ValueCorner value={card.value} detail={detail} />
    </Frame>
  );
}

function RentFace({ card, width }: { card: Card & { kind: 'RENT' }; width: number }) {
  const detail = detailFor(width);
  const colors = card.universal
    ? (Object.keys(COLORS) as Color[])
    : (card.colors as Color[]);

  return (
    <Frame width={width} background="#FBF7EC">
      <div className="flex h-full flex-col">
        {/* Les couleurs concernées, en pavés — deux pour un loyer bicolore,
            les dix pour le loyer universel. */}
        <div
          className="grid h-[34%] border-b-2 border-ink"
          style={{
            gridTemplateColumns: `repeat(${card.universal ? 5 : 2}, 1fr)`,
            gridTemplateRows: card.universal ? 'repeat(2, 1fr)' : '1fr',
          }}
        >
          {colors.map((c) => (
            <span key={c} style={{ background: COLORS[c].hex }} />
          ))}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-[0.25em]">
          <span className="text-[0.7em] font-extrabold uppercase tracking-[0.1em] text-ink">
            Loyer
          </span>
          {detail === 'full' && (
            <p className="mt-[0.2em] text-center text-[0.44em] font-semibold leading-[1.25] text-ink-soft">
              {rentRule(card.universal, card.colors)}
            </p>
          )}
        </div>
      </div>
      <ValueCorner value={card.value} detail={detail} />
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
      className="relative select-none overflow-hidden rounded-card border-2 border-ink shadow-card"
      style={{
        width,
        height: Math.round(width * RATIO),
        fontSize: width * 0.115,
        background: '#ED1B24',
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, #7d0d12 0 3px, transparent 3px 10px)',
        }}
      />
      <div className="absolute inset-[0.3em] rounded-[0.2em] border border-cream/60" />
      {width >= 46 && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="rotate-[-8deg] text-center text-[0.5em] font-extrabold uppercase leading-tight tracking-tight text-cream">
            Monopoly
            <br />
            Deal
          </span>
        </div>
      )}
    </div>
  );
}
