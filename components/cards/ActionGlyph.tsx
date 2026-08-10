/**
 * Pictogrammes des cartes Action, en SVG inline. Formes géométriques simples,
 * `currentColor`, viewBox 24×24 : ni police d'icônes, ni image externe.
 */

import type { ActionKind } from '@/lib/engine';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const GLYPHS: Record<ActionKind, React.ReactNode> = {
  // Coup de filet : les mailles d'un filet qui tombe sur un lot entier.
  DEAL_BREAKER: (
    <>
      <path {...STROKE} d="M3 6h18l-2.5 12h-13L3 6Z" />
      <path {...STROKE} d="M8 6v12M16 6v12M4 12h16" />
    </>
  ),
  // Affaire douteuse : une main qui tire une seule carte d'un paquet.
  SLY_DEAL: (
    <>
      <rect {...STROKE} x="3" y="5" width="9" height="13" rx="1.5" />
      <path {...STROKE} d="M15 8h6v13h-6z" />
      <path {...STROKE} d="M12 11h6" />
      <path {...STROKE} d="m15.5 8.5 3 2.5-3 2.5" />
    </>
  ),
  // Échange forcé : deux cartes qui permutent.
  FORCED_DEAL: (
    <>
      <rect {...STROKE} x="2" y="7" width="8" height="11" rx="1.5" />
      <rect {...STROKE} x="14" y="7" width="8" height="11" rx="1.5" />
      <path {...STROKE} d="M10 10h4m0 0-2-2m2 2-2 2M14 15h-4m0 0 2-2m-2 2 2 2" />
    </>
  ),
  // Recouvrement : la note à payer.
  DEBT_COLLECTOR: (
    <>
      <path {...STROKE} d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path {...STROKE} d="M9 8h6M9 12h6" />
    </>
  ),
  // Anniversaire : le gâteau, tout le monde passe à la caisse.
  BIRTHDAY: (
    <>
      <path {...STROKE} d="M4 21h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7Z" />
      <path {...STROKE} d="M8 12V8M12 12V7M16 12V8" />
      <circle {...STROKE} cx="8" cy="6" r="1" />
      <circle {...STROKE} cx="12" cy="5" r="1" />
      <circle {...STROKE} cx="16" cy="6" r="1" />
    </>
  ),
  // Passe départ : la flèche qui repart pour deux cartes.
  PASS_GO: (
    <>
      <path {...STROKE} d="M4 12h14" />
      <path {...STROKE} d="m13 7 5 5-5 5" />
      <path {...STROKE} d="M20 4v16" />
    </>
  ),
  HOUSE: (
    <>
      <path {...STROKE} d="M4 11 12 4l8 7" />
      <path {...STROKE} d="M6 10v10h12V10" />
      <path {...STROKE} d="M10 20v-5h4v5" />
    </>
  ),
  HOTEL: (
    <>
      <path {...STROKE} d="M4 20V8l8-4 8 4v12" />
      <path {...STROKE} d="M8 11h2M14 11h2M8 15h2M14 15h2" />
      <path {...STROKE} d="M2 20h20" />
    </>
  ),
  // Refus catégorique : le panneau d'interdiction.
  JUST_SAY_NO: (
    <>
      <circle {...STROKE} cx="12" cy="12" r="9" />
      <path {...STROKE} d="m6 18 12-12" />
    </>
  ),
  // Double loyer : ×2.
  DOUBLE_RENT: (
    <>
      <path {...STROKE} d="m5 8 6 6M11 8l-6 6" />
      <path {...STROKE} d="M15 9a2.5 2.5 0 1 1 4.5 1.5L15 17h5" />
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
