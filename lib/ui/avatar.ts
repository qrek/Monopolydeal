/**
 * Avatar généré : initiales + couleur déterministe dérivée de l'identité du
 * joueur. Aucune image externe, aucun appel réseau — juste du CSS.
 */

/** Aplats francs, lisibles sur le fond sombre de la table. */
const PALETTE = [
  '#E86FA9',
  '#F08A2B',
  '#DC3B34',
  '#F2C33C',
  '#2E9E5B',
  '#3FB8AF',
  '#6EC6E8',
  '#8B7BE8',
] as const;

const FALLBACK = PALETTE[0];

/** FNV-1a 32 bits : stable d'un navigateur à l'autre, contrairement à un hash maison. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Couleur de l'avatar. On la dérive de l'identifiant du joueur et non de son
 * pseudo : la couleur reste la même s'il se renomme.
 */
export function avatarColor(seed: string): string {
  return PALETTE[hash(seed) % PALETTE.length] ?? FALLBACK;
}

/**
 * Initiales : une lettre par mot (deux mots max), ou les deux premières lettres
 * d'un pseudo en un seul mot. `Array.from` pour ne pas couper un emoji en deux.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) {
    return Array.from(words[0] ?? '')
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? '')
    .join('')
    .toUpperCase();
}
