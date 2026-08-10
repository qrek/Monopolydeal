/**
 * Aléatoire déterministe : le seed est stocké en base, donc rejouer le log
 * d'events reproduit exactement la même partie.
 */

/** Hash 32 bits stable d'une chaîne (variante de cyrb53 tronquée). */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** PRNG mulberry32 : rapide, déterministe, suffisant pour un mélange de cartes. */
export function mulberry32(state: number): () => number {
  let a = state >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher–Yates déterministe. `round` distingue le mélange initial des
 * remélanges de la défausse, qui utilisent le même seed.
 */
export function shuffle<T>(items: readonly T[], seed: string, round = 0): T[] {
  const rand = mulberry32(hashSeed(`${seed}#${round}`));
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** Code de partie à 4 lettres, dérivé du seed — partageable par lien. */
export function roomCodeFromSeed(seed: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const rand = mulberry32(hashSeed(`room:${seed}`));
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(rand() * alphabet.length)];
  }
  return code;
}
