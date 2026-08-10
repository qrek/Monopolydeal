/**
 * Rendu d'une carte, entièrement en CSS/SVG — aucune image externe.
 *
 * Direction artistique : le TITRE DE PROPRIÉTÉ du Monopoly, appliqué à tout le
 * jeu. Carton crème cerné d'un filet noir, plaque de couleur pleine largeur
 * portant le nom, pastille de valeur logée dans le coin de cette plaque, et
 * dessous une échelle à points de conduite — libellé à gauche, chiffre à
 * droite. Les cartes action, les loyers et les billets reprennent la même
 * grammaire : c'est ce qui fait tenir le jeu ensemble.
 *
 * Une seule mesure pilote tout : `width`. La hauteur suit le ratio 5:7 et la
 * typographie est proportionnelle (1em = 11,5 % de la largeur), si bien que les
 * mêmes composants servent à la main, aux lots et aux lots adverses.
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
  getCard,
  type Card,
  type CardId,
  type Color,
} from '@/lib/engine';
import { ACTION_EFFECTS, moneyHue, unitOf } from '@/lib/ui/cards';
import { readableInk } from '@/lib/ui/color';

const RATIO = 1.4;

/** Crème un peu plus sourd, pour les plaques qui n'ont pas de couleur propre. */
const PAPER_2 = '#EFE8D6';

/**
 * Le niveau de détail suit la taille : sous 46 px une carte n'est plus qu'une
 * plaque de couleur dans un lot, au-delà de 84 px elle porte tout son texte.
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

// ---------------------------------------------------------------------------
// Pièces communes
// ---------------------------------------------------------------------------

function Frame({
  children,
  width,
  background = '#FBF7EC',
  flush = false,
}: {
  children: React.ReactNode;
  width: number;
  background?: string;
  /** Sans retrait intérieur : pour le joker, dont les deux moitiés vont aux bords. */
  flush?: boolean;
}) {
  return (
    <div
      className={`relative flex select-none flex-col overflow-hidden rounded-card border-2 border-ink shadow-card ${
        flush ? '' : 'gap-[0.28em] p-[0.42em]'
      }`}
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
 * Valeur en banque. Elle vit DANS la plaque de couleur, calée dans son coin
 * haut-gauche : posée à côté, elle se lisait comme une étiquette rapportée.
 */
function Value({ value, detail }: { value: number; detail: Detail }) {
  if (detail === 'minimal') return null;
  return (
    <span className="absolute left-[0.28em] top-[0.28em] z-[2] grid h-[1.4em] min-w-[1.4em] place-items-center rounded-[0.18em] border-[1.5px] border-ink bg-cream px-[0.18em] text-[0.72em] font-extrabold leading-none text-ink">
      {value}M
    </span>
  );
}

/**
 * Plaque de titre : pleine largeur, calée sur les bords de la carte comme sur
 * les cartes d'origine. Le retrait à gauche est la place réservée à la
 * pastille — le nom ne peut donc jamais passer dessous.
 */
function Plate({
  background,
  color,
  value,
  detail,
  children,
  tight = false,
}: {
  background: string;
  color?: string;
  value?: number;
  detail: Detail;
  children?: React.ReactNode;
  /** Plaque basse, pour les cartes qui ont besoin de place dessous. */
  tight?: boolean;
}) {
  const showValue = value !== undefined && value > 0 && detail !== 'minimal';
  return (
    <div
      className={`relative -mx-[0.42em] -mt-[0.42em] flex shrink-0 flex-col items-center justify-center gap-[0.12em] rounded-t-[0.28em] border-b-2 border-ink px-[0.45em] text-center ${
        tight ? 'py-[0.35em]' : 'py-[0.45em]'
      } ${showValue ? 'pl-[2.3em]' : ''}`}
      style={{ background, color, minHeight: tight ? undefined : '3.1em' }}
    >
      {showValue && <Value value={value} detail={detail} />}
      {children}
    </div>
  );
}

/** Nom porté par la plaque. Il rétrécit avec sa longueur plutôt que de déborder. */
function PlateName({ text, detail }: { text: string; detail: Detail }) {
  if (detail === 'minimal') return null;
  const scale =
    text.length > 26 ? 0.5 : text.length > 18 ? 0.58 : text.length > 11 ? 0.64 : 0.7;
  return (
    <span
      className="min-w-0 font-extrabold uppercase leading-[1.05] tracking-tight [hyphens:auto] [overflow-wrap:anywhere]"
      style={{ fontSize: `${detail === 'full' ? scale : scale * 0.92}em` }}
    >
      {text}
    </span>
  );
}

/** Sur-titre en petites capitales, au-dessus du nom. */
function PlateKicker({ text }: { text: string }) {
  return (
    <span className="text-[0.4em] font-extrabold uppercase leading-none tracking-[0.2em] opacity-80">
      {text}
    </span>
  );
}

interface Row {
  label: string;
  value?: string;
  /** Palier du lot complet : en négatif. */
  full?: boolean;
  /** Bonus conditionnel ou condition d'usage : effacé d'un cran. */
  faded?: boolean;
}

/** Échelle à points de conduite, la mécanique de lecture du titre de propriété. */
function Ladder({ rows, dense = false }: { rows: Row[]; dense?: boolean }) {
  return (
    <div
      className={`flex shrink-0 flex-col gap-[0.06em] font-semibold ${
        dense ? 'text-[0.52em]' : 'text-[0.58em]'
      }`}
    >
      {rows.map((r) => (
        <div
          key={r.label}
          className={`flex items-baseline gap-[0.3em] ${
            r.full ? '-mx-[0.25em] rounded-[0.1em] bg-ink px-[0.25em] py-[0.1em] text-cream' : ''
          } ${r.faded ? 'font-medium opacity-40' : ''}`}
        >
          <span className="shrink-0">{r.label}</span>
          <span
            className={`min-w-0 flex-1 translate-y-[-0.18em] border-b border-dotted ${
              r.full ? 'border-cream/40' : 'border-ink/45'
            }`}
          />
          {r.value && (
            <span className="shrink-0 font-extrabold tabular-nums">{r.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Le vide entre l'échelle et le pied est celui d'un vrai titre de propriété.
 * On l'occupe comme le ferait un document imprimé : une marque en filigrane,
 * assez pâle pour ne rien disputer à la lecture.
 */
function Watermark() {
  return (
    <p
      aria-hidden
      className="my-auto select-none text-center text-[0.46em] font-extrabold uppercase leading-none tracking-[0.3em] text-ink opacity-[0.13]"
    >
      Monopoly
    </p>
  );
}

function Foot({ left, right }: { left: string; right?: string }) {
  return (
    <div
      className={`mt-auto flex shrink-0 gap-[0.4em] whitespace-nowrap border-t-[1.5px] border-ink pt-[0.24em] text-[0.44em] font-bold uppercase leading-none tracking-[0.06em] text-ink opacity-80 ${
        right ? 'justify-between' : 'justify-center'
      }`}
    >
      <span>{left}</span>
      {right && <span>{right}</span>}
    </div>
  );
}

/** Dix couleurs en pavés : on lit « toutes » d'un coup d'œil. */
function Swatches() {
  const colors = Object.keys(COLORS) as Color[];
  return (
    <div className="grid shrink-0 grid-cols-5 gap-[0.16em]">
      {colors.map((c) => (
        <span
          key={c}
          className="rounded-[0.1em] border-[1.5px] border-ink"
          style={{ background: COLORS[c].hex, aspectRatio: '1.5' }}
        />
      ))}
    </div>
  );
}

const RAINBOW = `linear-gradient(90deg, ${(Object.keys(COLORS) as Color[])
  .map((c, i) => `${COLORS[c].hex} ${i * 10}% ${(i + 1) * 10}%`)
  .join(', ')})`;

/** Cartouche crème posé sur la couleur, comme le bandeau blanc des jokers. */
function Cartouche({ word, sub }: { word: string; sub?: string }) {
  return (
    <span className="flex flex-col items-center gap-[0.04em] rounded-[0.16em] border-2 border-ink bg-cream px-[0.6em] pb-[0.26em] pt-[0.22em] text-ink">
      <span className="text-[1em] font-extrabold uppercase leading-[0.95] tracking-[0.02em]">
        {word}
      </span>
      {sub && (
        <span className="text-[0.4em] font-extrabold uppercase leading-none tracking-[0.14em] opacity-75">
          {sub}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Faces
// ---------------------------------------------------------------------------

function rentRows(color: Color, dense: boolean): Row[] {
  const cfg = COLORS[color];
  const unit = unitOf(color);
  return cfg.rents.map((rent, i) => ({
    label: dense ? String(i + 1) : `${i + 1} ${i === 0 ? unit.one : unit.many}`,
    value: `${rent} M`,
    full: i === cfg.size - 1,
  }));
}

function PropertyFace({ card, width }: { card: Card & { kind: 'PROPERTY' }; width: number }) {
  const detail = detailFor(width);
  const cfg = COLORS[card.color];
  const rows = rentRows(card.color, detail !== 'full');
  if (detail === 'full' && cfg.buildable) {
    // Les montants viennent des cartes construction elles-mêmes : deux
    // sources pour le même chiffre finissent toujours par diverger.
    rows.push(
      { label: 'Maison', value: ACTION_EFFECTS.HOUSE.value, faded: true },
      { label: 'Hôtel', value: ACTION_EFFECTS.HOTEL.value, faded: true },
    );
  }

  return (
    <Frame width={width}>
      <Plate background={cfg.hex} color={readableInk(cfg.hex)} value={card.value} detail={detail}>
        <PlateName text={card.label} detail={detail} />
      </Plate>
      {detail !== 'minimal' && <Ladder rows={rows} dense={detail !== 'full'} />}
      {detail === 'full' && (
        <>
          <Watermark />
          <Foot left={cfg.label} right={`${cfg.size} ${unitOf(card.color).many}`} />
        </>
      )}
    </Frame>
  );
}

/**
 * Joker bicolore, imprimé tête-bêche — exactement comme la carte d'origine.
 * La couleur qu'on lit à l'endroit est celle qu'on joue : le geste est écrit
 * dans l'objet, il n'y a aucune convention à expliquer.
 */
function WildFace({ card, width }: { card: Card & { kind: 'WILD' }; width: number }) {
  const detail = detailFor(width);
  const [a, b] = card.colors;

  return (
    <Frame width={width} flush>
      {[a, b].map((color, i) => {
        const cfg = COLORS[color];
        return (
          <div
            key={`${color}-${i}`}
            className={`flex min-h-0 flex-1 flex-col ${
              i === 0 ? 'border-b border-dashed border-ink/30' : 'rotate-180'
            }`}
          >
            <div
              className="relative flex shrink-0 flex-col items-center justify-center rounded-t-[0.28em] border-b-2 border-ink py-[0.3em] pl-[2.3em] pr-[0.45em] text-center"
              style={{ background: cfg.hex, color: readableInk(cfg.hex) }}
            >
              <Value value={card.value} detail={detail} />
              {detail === 'full' && <PlateKicker text="Joker" />}
              {detail !== 'minimal' && (
                <span className="text-[0.62em] font-extrabold uppercase leading-none tracking-[0.02em]">
                  {cfg.label}
                </span>
              )}
            </div>
            {detail === 'full' && (
              <div className="flex min-h-0 flex-1 flex-col justify-center px-[0.42em] py-[0.2em]">
                <Ladder rows={rentRows(color, false)} />
              </div>
            )}
          </div>
        );
      })}
    </Frame>
  );
}

function WildAnyFace({ card, width }: { card: Card & { kind: 'WILD_ANY' }; width: number }) {
  const detail = detailFor(width);
  return (
    <Frame width={width}>
      <Plate background={RAINBOW} value={card.value} detail={detail} tight>
        {detail !== 'minimal' && (
          <Cartouche word="Joker" sub={detail === 'full' ? 'Toutes couleurs' : undefined} />
        )}
      </Plate>
      {detail === 'full' && (
        <>
          <Swatches />
          <Ladder
            rows={[
              { label: 'Se pose dans', value: 'tout lot', full: true },
              { label: 'Ne vaut rien', value: '0 M', faded: true },
              { label: 'Ne paie rien', value: '0 M', faded: true },
            ]}
          />
          <Watermark />
          <Foot left="Joker universel" />
        </>
      )}
    </Frame>
  );
}

/**
 * Billet. Ni nom, ni échelle, ni pastille : il n'a qu'un montant, et le répéter
 * dans un coin ne servait à rien. Le cadre guilloché occupe la place que prend
 * l'échelle ailleurs, ce qui rend les billets reconnaissables sans les lire.
 */
function MoneyFace({ card, width }: { card: Card & { kind: 'MONEY' }; width: number }) {
  const detail = detailFor(width);
  return (
    <Frame width={width}>
      <div
        className="flex min-h-0 flex-1 items-center justify-center gap-[0.1em] rounded-[0.16em] border-[1.5px] border-ink font-extrabold leading-[0.82] tracking-[-0.045em] text-ink"
        style={{
          background: moneyHue(card.value),
          backgroundImage:
            'repeating-linear-gradient(48deg, rgba(20,20,20,.09) 0 1px, transparent 1px 6px), repeating-linear-gradient(-48deg, rgba(20,20,20,.09) 0 1px, transparent 1px 6px)',
        }}
      >
        <span className="text-[3.2em]">{card.value}</span>
        <span className="text-[1.05em] tracking-[0.02em]">M</span>
      </div>
      {detail === 'full' && <Foot left="Banque" />}
    </Frame>
  );
}

function ActionFace({ card, width }: { card: Card & { kind: 'ACTION' }; width: number }) {
  const detail = detailFor(width);
  const effect = ACTION_EFFECTS[card.action];
  // Le Refus est la seule carte qui se joue CONTRE une autre, hors de son tour :
  // c'est la seule à porter une plaque noire.
  const defensive = card.action === 'JUST_SAY_NO';

  return (
    <Frame width={width}>
      <Plate
        background={defensive ? '#141414' : '#ED1B24'}
        color="#FBF7EC"
        value={card.value}
        detail={detail}
        tight
      >
        <PlateName text={card.label} detail={detail} />
      </Plate>
      <div className="grid min-h-0 flex-1 place-items-center">
        <ActionGlyph kind={card.action} className="w-[3.4em]" />
      </div>
      {detail !== 'minimal' && (
        <Ladder
          dense={detail !== 'full'}
          rows={
            detail === 'full' && effect.note
              ? [
                  { label: effect.label, value: effect.value, full: true },
                  { label: effect.note, faded: true },
                ]
              : [{ label: effect.label, value: effect.value, full: true }]
          }
        />
      )}
    </Frame>
  );
}

/**
 * Carte Loyer, traitée comme une quittance : les couleurs concernées en
 * pastilles, le montant en face, les paliers rappelés dessous. On voit d'un
 * coup ce qu'on peut réclamer et pour quel lot — c'était le reproche fait à
 * l'ancienne version, où rien ne disait quel loyer allait avec quelle couleur.
 */
function RentFace({ card, width }: { card: Card & { kind: 'RENT' }; width: number }) {
  const detail = detailFor(width);

  if (card.universal) {
    return (
      <Frame width={width}>
        <Plate background={RAINBOW} value={card.value} detail={detail} tight>
          {detail !== 'minimal' && (
            <Cartouche word="Loyer" sub={detail === 'full' ? 'Toutes couleurs' : undefined} />
          )}
        </Plate>
        {detail === 'full' && (
          <>
            <Ladder
              rows={[
                { label: 'Couleur', value: 'au choix' },
                { label: 'Cible', value: '1 joueur' },
                { label: 'Montant', value: 'loyer du lot', full: true },
              ]}
            />
            <Watermark />
            <Foot left="Double loyer applicable" />
          </>
        )}
      </Frame>
    );
  }

  const colors = card.colors as [Color, Color];
  const [a, b] = colors;
  // Autant de lignes que le plus gros des deux lots : une case vide en face
  // d'un palier dit d'elle-même « cette couleur n'en a pas autant ».
  const paliers = Math.max(COLORS[a].size, COLORS[b].size);

  return (
    <Frame width={width}>
      <Plate background={PAPER_2} value={card.value} detail={detail} tight>
        {detail !== 'minimal' && <PlateName text="Loyer" detail={detail} />}
      </Plate>

      {detail !== 'minimal' && (
        // Une seule table à deux colonnes : les paliers écrits UNE fois à
        // gauche, un montant par couleur en face. La version précédente
        // répétait le nom de la couleur et ses paliers à chaque ligne — trois
        // fois la même information dans une carte de 92 px.
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-end gap-[0.2em] pb-[0.18em]">
            {/* Pas de libellé au-dessus des pastilles : la plaque dit déjà
                LOYER, et « loyer dû » se repliait sur deux lignes en écrasant
                la colonne des paliers. */}
            <span className="min-w-0 flex-1" />
            {colors.map((c) => (
              <span
                key={c}
                className="h-[0.9em] w-[2.6em] shrink-0 rounded-[0.12em] border-[1.5px] border-ink"
                style={{ background: COLORS[c].hex }}
              />
            ))}
          </div>

          {Array.from({ length: paliers }, (_, i) => {
            const complete = colors.map((c) => i === COLORS[c].size - 1);
            return (
              <div
                key={i}
                className="flex items-baseline gap-[0.2em] border-t border-dotted border-ink/30 py-[0.12em] text-[0.5em] font-semibold text-ink first:border-t-0"
              >
                <span className="min-w-0 flex-1 truncate">
                  {detail === 'full' ? `${i + 1} carte${i ? 's' : ''}` : i + 1}
                </span>
                {colors.map((c, k) => {
                  const rent = COLORS[c].rents[i];
                  return (
                    <span
                      key={c}
                      className={`w-[2.6em] shrink-0 rounded-[0.1em] py-[0.05em] text-center font-extrabold tabular-nums ${
                        complete[k] ? 'bg-ink text-cream' : ''
                      }`}
                    >
                      {rent === undefined ? '—' : `${rent} M`}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {detail === 'full' && (
        <>
          <Watermark />
          <Foot left="À tous les adversaires" />
        </>
      )}
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
      className="relative grid select-none place-items-center overflow-hidden rounded-card border-2 border-ink shadow-card"
      style={{
        width,
        height: Math.round(width * RATIO),
        fontSize: width * 0.115,
        background: '#ED1B24',
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(0,0,0,.14) 0 2px, transparent 2px 9px), repeating-linear-gradient(-45deg, rgba(255,255,255,.10) 0 2px, transparent 2px 9px)',
      }}
    >
      {width >= 46 && (
        <span className="rounded-[0.2em] border-2 border-cream bg-ink/20 px-[0.6em] py-[0.5em] text-center text-cream">
          <span className="block text-[0.72em] font-extrabold uppercase leading-none tracking-tight">
            Monopoly
          </span>
          <span className="mt-[0.2em] block text-[0.44em] font-extrabold uppercase leading-none tracking-[0.28em]">
            Deal
          </span>
        </span>
      )}
    </div>
  );
});
