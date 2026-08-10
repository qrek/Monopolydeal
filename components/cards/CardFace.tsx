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
 *
 * `memo` n'est pas cosmétique ici : une carte pèse une trentaine de nœuds, une
 * table en affiche facilement quarante, et le moindre changement d'état — dont
 * chaque `pointermove` d'un glisser — reconstruisait tout l'arbre.
 */

'use client';

import { memo } from 'react';

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
function RentTable({
  color,
  dense,
  showColor = false,
}: {
  color: Color;
  dense: boolean;
  /** Nommer la couleur n'a de sens que sur un joker, qui en porte deux. */
  showColor?: boolean;
}) {
  const cfg = COLORS[color];
  return (
    // La grille occupe toute la hauteur restante : une carte à moitié vide ne
    // ressemble pas à une carte de jeu de société. Le filet de couleur à gauche
    // rattache la grille à SA couleur — sur un joker bicolore, deux grilles
    // nues ne disaient pas laquelle allait avec laquelle.
    <div
      className="flex min-h-0 flex-1 flex-col gap-[0.08em] pl-[0.25em]"
      style={{ borderLeft: `0.3em solid ${cfg.hex}` }}
    >
      <span className="mb-[0.15em] shrink-0 text-[0.56em] font-extrabold uppercase leading-none tracking-[0.14em] text-ink-soft">
        Loyer{showColor ? ` ${cfg.label}` : ''}
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
  // Un nom long rétrécit et passe à la ligne, mais reste lisible : en dessous
  // de ~0,5em il n'est plus qu'une trace grise sur l'aplat de couleur.
  const scale = name.length > 26 ? 0.52 : name.length > 18 ? 0.62 : 0.72;
  return (
    <div
      className="flex items-center justify-center border-b-2 border-ink px-[0.25em] text-center"
      style={{ height: `${heightPct}%`, background: cfg.hex, color: ink }}
    >
      {detail !== 'minimal' && (
        // min-w-0 : sans lui l'enfant flex refuse de rétrécir, le nom reste sur
        // une ligne et « Avenue des Champs-Élysées » se fait couper au bord.
        <span
          className="min-w-0 font-extrabold uppercase leading-[1.05] tracking-tight [overflow-wrap:anywhere] [hyphens:auto]"
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
        heightPct={detail === 'minimal' ? 46 : 38}
      />
      {detail !== 'minimal' && (
        <div className="flex h-[62%] flex-col px-[0.3em] pb-[0.25em] pt-[0.1em]">
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

/**
 * Joker bicolore. Une moitié par couleur : le bandeau nomme la couleur, les
 * loyers viennent juste dessous.
 *
 * Ni sous-titre « LOYER », ni bonus de construction, ni filet de couleur ici :
 * la carte doit loger deux échelles complètes (jusqu'à 4 lignes pour les Gares)
 * dans la hauteur d'une seule carte. Tout ce qui n'est pas un chiffre est
 * supprimé pour que les chiffres respirent.
 */
function WildFace({ card, width }: { card: Card & { kind: 'WILD' }; width: number }) {
  const [a, b] = card.colors;
  const detail = detailFor(width);

  return (
    <Frame width={width} background="#FBF7EC">
      <div className="flex h-full flex-col">
        {[a, b].map((color, i) => {
          const cfg = COLORS[color];
          return (
            <div
              key={color}
              className={`flex h-1/2 flex-col ${i === 1 ? 'border-t-2 border-ink' : ''}`}
            >
              <div
                className="flex h-[26%] shrink-0 items-center justify-center border-b border-ink/70 px-[0.2em]"
                style={{ background: cfg.hex, color: readableInk(cfg.hex) }}
              >
                {detail !== 'minimal' && (
                  <span className="text-[0.5em] font-extrabold uppercase leading-none tracking-tight">
                    {cfg.label}
                  </span>
                )}
              </div>
              {detail === 'full' && (
                <div className="flex min-h-0 flex-1 flex-col gap-px p-[0.15em]">
                  {cfg.rents.map((rent, r) => {
                    const complete = r === cfg.size - 1;
                    return (
                      <div
                        key={rent}
                        className={`flex min-h-0 flex-1 items-center justify-between rounded-[0.12em] px-[0.25em] text-[0.56em] font-bold leading-none tabular-nums ${
                          complete ? 'bg-ink text-cream' : 'text-ink'
                        }`}
                      >
                        <span>{r + 1}</span>
                        <span>{rent} M</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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

/**
 * Joker universel : les 10 couleurs en bandes verticales pleine hauteur,
 * barrées d'un bandeau noir. Le damier 2×5 précédent ressemblait à une mire de
 * réglage ; des bandes se lisent d'emblée comme « toutes les couleurs ».
 */
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
      <div className="absolute inset-0 flex">
        {colors.map((c) => (
          <span key={c} className="flex-1" style={{ background: COLORS[c].hex }} />
        ))}
      </div>
      {detail !== 'minimal' && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-y-2 border-ink bg-ink py-[0.25em] text-center">
          <span className="block text-[0.62em] font-extrabold uppercase leading-none tracking-[0.12em] text-cream">
            Joker
          </span>
          {detail === 'full' && (
            <span className="mt-[0.15em] block text-[0.44em] font-bold uppercase leading-none tracking-[0.1em] text-cream/85">
              universel
            </span>
          )}
        </div>
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
          <span className="text-[2.7em] tracking-tighter">{card.value}</span>
          <span className="text-[1.1em]">M</span>
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
        {/* Grand : le pictogramme est le repère principal d'une carte Action,
            le titre ne fait que confirmer. */}
        <div className="grid flex-1 place-items-center px-[0.2em] py-[0.2em]">
          <ActionGlyph kind={card.action} className="w-[3.8em]" />
        </div>
        {/* La règle est imprimée à même la carte, sans cartouche : le cadre
            gris rétrécissait le texte et laissait du vide autour. */}
        {detail === 'full' && (
          <p className="px-[0.4em] pb-[0.35em] text-center text-[0.5em] font-semibold leading-[1.3] text-ink">
            {ACTION_RULES[card.action]}
          </p>
        )}
      </div>
      <ValueCorner value={card.value} detail={detail} />
    </Frame>
  );
}

/**
 * Carte Loyer. Comme sur la carte du jeu, elle se lit dans les deux sens : une
 * couleur par moitié, et le mot LOYER répété tête-bêche. Posée au milieu de la
 * table, elle reste lisible par celui d'en face.
 */
function RentFace({ card, width }: { card: Card & { kind: 'RENT' }; width: number }) {
  const detail = detailFor(width);

  if (card.universal) {
    const colors = Object.keys(COLORS) as Color[];
    return (
      // Loyer universel : les 10 couleurs en bandes verticales pleine hauteur,
      // barrées du mot LOYER. La grille 5×2 précédente faisait mire de réglage.
      <Frame width={width} background="#FBF7EC">
        <div className="absolute inset-0 flex">
          {colors.map((c) => (
            <span key={c} className="flex-1" style={{ background: COLORS[c].hex }} />
          ))}
        </div>
        <div className="relative flex h-full flex-col justify-end">
          <div className="border-y-2 border-ink bg-ink py-[0.28em] text-center">
            {detail !== 'minimal' && (
              <span className="text-[0.8em] font-extrabold uppercase leading-none tracking-[0.14em] text-cream">
                Loyer
              </span>
            )}
          </div>
          {detail !== 'minimal' && (
            <div className="flex h-[34%] flex-col items-center justify-center bg-cream px-[0.3em] text-center">
              <span className="text-[0.5em] font-extrabold uppercase leading-none tracking-[0.12em] text-ink-soft">
                Toutes couleurs
              </span>
              {detail === 'full' && (
                <p className="mt-[0.2em] text-[0.44em] font-semibold leading-[1.25] text-ink-soft">
                  {rentRule(true, card.colors)}
                </p>
              )}
            </div>
          )}
        </div>
        <ValueCorner value={card.value} detail={detail} />
      </Frame>
    );
  }

  const [a, b] = card.colors as [Color, Color];
  const halves: Array<{ color: Color; flipped: boolean }> = [
    { color: a, flipped: false },
    { color: b, flipped: true },
  ];

  return (
    <Frame width={width} background="#FBF7EC">
      <div className="flex h-full flex-col">
        {halves.map(({ color, flipped }, i) => {
          const cfg = COLORS[color];
          const ink = readableInk(cfg.hex);
          return (
            <div
              key={color}
              className={`flex h-1/2 items-center justify-center px-[0.2em] ${
                i === 1 ? 'border-t-2 border-ink' : ''
              }`}
              style={{
                background: cfg.hex,
                color: ink,
                // La moitié du bas se lit depuis l'autre bord de la table.
                transform: flipped ? 'rotate(180deg)' : undefined,
              }}
            >
              <div className="text-center">
                {detail !== 'minimal' && (
                  <span className="block text-[0.72em] font-extrabold uppercase leading-none tracking-[0.1em]">
                    Loyer
                  </span>
                )}
                {detail !== 'minimal' && (
                  <span className="mt-[0.15em] block text-[0.46em] font-extrabold uppercase leading-none tracking-tight opacity-90">
                    {cfg.label}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ValueCorner value={card.value} detail={detail} />
    </Frame>
  );
}

export const CardFace = memo(function CardFace({ cardId, width = 96 }: CardFaceProps) {
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
});

/** Dos de carte : pioche, défausse et mains adverses. */
export const CardBack = memo(function CardBack({ width = 96 }: { width?: number }) {
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
});
