/**
 * Pictogrammes des cartes Action, en SVG inline — ni police d'icônes, ni image
 * externe, ni banque tierce (qui imposerait une licence et un crédit).
 *
 * Silhouettes pleines et trapues plutôt que traits fins : un pictogramme de
 * jeu de société doit se lire à 2 cm de haut et de loin, là où une icône
 * d'interface web au trait de 2 px disparaît.
 */

import type { ActionKind } from '@/lib/engine';

const INK = '#141414';
const RED = '#ED1B24';
const GREEN = '#1FB25A';
const CREAM = '#FBF7EC';

const GLYPHS: Record<ActionKind, React.ReactNode> = {
  // Coup de filet : le lot entier emporté d'un bloc.
  DEAL_BREAKER: (
    <>
      <rect x="1" y="5" width="6" height="11" rx="1" fill={INK} />
      <rect x="2.6" y="6.6" width="2.8" height="3" fill={RED} />
      <rect x="6.5" y="5" width="6" height="11" rx="1" fill={INK} />
      <rect x="8.1" y="6.6" width="2.8" height="3" fill={GREEN} />
      <rect x="12" y="5" width="6" height="11" rx="1" fill={INK} />
      <rect x="13.6" y="6.6" width="2.8" height="3" fill={CREAM} />
      <path d="M2 20h14v-3l6 4.5-6 4.5v-3H2v-3Z" fill={RED} transform="translate(0 -3.5) scale(1 0.62)" />
    </>
  ),
  // Affaire douteuse : une carte soutirée d'une pile adverse.
  SLY_DEAL: (
    <>
      <rect x="1.5" y="8" width="8" height="12" rx="1.2" fill={INK} />
      <rect x="5" y="8" width="8" height="12" rx="1.2" fill={INK} stroke={CREAM} strokeWidth="1" />
      <g transform="rotate(-18 17 8)">
        <rect x="13" y="2.5" width="8" height="12" rx="1.2" fill={INK} stroke={CREAM} strokeWidth="1" />
        <rect x="14.6" y="4.1" width="4.8" height="3.4" fill={RED} />
      </g>
      <path d="M11 21.5h9m0 0-3-2.6m3 2.6-3 2.6" stroke={INK} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" transform="translate(0 -2)" />
    </>
  ),
  // Échange forcé : deux cartes qui permutent.
  FORCED_DEAL: (
    <>
      <rect x="0.5" y="4" width="7.5" height="11" rx="1.2" fill={INK} />
      <rect x="2" y="5.6" width="4.5" height="3" fill={GREEN} />
      <rect x="16" y="9" width="7.5" height="11" rx="1.2" fill={INK} />
      <rect x="17.5" y="10.6" width="4.5" height="3" fill={RED} />
      <path d="M9 7h6.5m0 0-2.4-2.4M15.5 7l-2.4 2.4" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M15 17H8.5m0 0 2.4-2.4M8.5 17l2.4 2.4" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  // Recouvrement : le sac d'argent qu'on vient réclamer.
  DEBT_COLLECTOR: (
    <>
      <path d="M9 2.5h6l-1.6 3h-2.8L9 2.5Z" fill={INK} />
      <path
        d="M12 5.5c4.4 0 8 4.2 8 9.1 0 4-2.6 6.4-8 6.4s-8-2.4-8-6.4c0-4.9 3.6-9.1 8-9.1Z"
        fill={INK}
      />
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontSize="9"
        fontWeight="800"
        fill={CREAM}
        fontFamily="inherit"
      >
        M
      </text>
    </>
  ),
  // Anniversaire : le cadeau que chacun te doit.
  BIRTHDAY: (
    <>
      <rect x="2.5" y="9.5" width="19" height="4" fill={INK} />
      <rect x="4.5" y="13.5" width="15" height="8" fill={INK} />
      <rect x="10.6" y="9.5" width="2.8" height="12" fill={RED} />
      <path
        d="M11.8 9.2C10.4 6.6 8.8 5.2 7.3 5.6c-1.4.4-1.6 2.3-.3 3.2.9.6 2.4.9 4.8.4Zm.4 0c1.4-2.6 3-4 4.5-3.6 1.4.4 1.6 2.3.3 3.2-.9.6-2.4.9-4.8.4Z"
        fill={INK}
      />
    </>
  ),
  // Passe départ : la flèche de la case Départ.
  PASS_GO: (
    <>
      <path d="M2 8.5h11v-4l8 7.5-8 7.5v-4H2v-7Z" fill={INK} />
      <rect x="4" y="10.5" width="6" height="3" fill={CREAM} />
    </>
  ),
  // La maison verte du plateau.
  HOUSE: (
    <>
      <path d="M12 3 22.5 12H19v9H5v-9H1.5L12 3Z" fill={GREEN} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="9.5" y="14" width="5" height="7" fill={INK} />
    </>
  ),
  // L'hôtel rouge, plus long et plus haut.
  HOTEL: (
    <>
      <path d="M3 21V8l9-5 9 5v13H3Z" fill={RED} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="6" y="10" width="3" height="3" fill={CREAM} />
      <rect x="15" y="10" width="3" height="3" fill={CREAM} />
      <rect x="10.5" y="15" width="3" height="6" fill={INK} />
    </>
  ),
  // Refus catégorique : le panneau de sens interdit, lisible de loin.
  JUST_SAY_NO: (
    <>
      <path
        d="M8.1 1.5h7.8L22.5 8.1v7.8L15.9 22.5H8.1L1.5 15.9V8.1L8.1 1.5Z"
        fill={RED}
        stroke={INK}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect x="6" y="10.4" width="12" height="3.2" rx="0.4" fill={CREAM} />
    </>
  ),
  // Double loyer : ×2, en gras.
  DOUBLE_RENT: (
    <>
      <path
        d="M2 6.5 5.2 11 2 15.5h3.4l1.6-2.4 1.6 2.4H12L8.8 11 12 6.5H8.6L7 8.9 5.4 6.5H2Z"
        fill={INK}
      />
      <path
        d="M13.6 8.4c.3-2 1.9-3.4 4.1-3.4 2.4 0 4.1 1.5 4.1 3.7 0 1.6-.8 2.8-2.8 4.4l-2.3 1.9h5.3v3.1h-9.9v-2.6l4.6-3.9c1.2-1 1.6-1.6 1.6-2.4 0-.8-.6-1.3-1.5-1.3-1 0-1.6.6-1.7 1.7l-3.5-1.2Z"
        fill={INK}
      />
    </>
  ),
};

export function ActionGlyph({
  kind,
  className = '',
}: {
  kind: ActionKind;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      {GLYPHS[kind]}
    </svg>
  );
}
