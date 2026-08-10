/** Contraste : quelle encre poser sur un aplat de couleur donné. */

const INK_DARK = '#141a16';
const INK_LIGHT = '#ffffff';

function channel(hex: string, at: number): number {
  const v = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative WCAG. */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 0;
  return (
    0.2126 * channel(h, 0) + 0.7152 * channel(h, 2) + 0.0722 * channel(h, 4)
  );
}

/**
 * Encre lisible sur cet aplat. Seuil 0.45 : le jaune et le bleu ciel du jeu
 * passent en encre sombre, le rouge et le bleu nuit en encre claire.
 */
export function readableInk(hex: string): string {
  return luminance(hex) > 0.45 ? INK_DARK : INK_LIGHT;
}
