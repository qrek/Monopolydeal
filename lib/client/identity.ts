/**
 * Pseudo du joueur, mémorisé dans le navigateur. L'identité *réelle* reste le
 * user id anonyme Supabase (cf. lib/supabase/client) ; ceci n'est qu'un confort
 * pour pré-remplir le champ d'un lien d'invitation à l'autre.
 */

'use client';

const KEY = 'lotissime:name';

/** Mêmes règles que `sanitizeName` côté serveur, pour éviter les surprises. */
export function cleanName(raw: string): string {
  return raw
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .trimStart()
    .slice(0, 24);
}

export function loadName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return cleanName(window.localStorage.getItem(KEY) ?? '');
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    window.localStorage.setItem(KEY, cleanName(name));
  } catch {
    // Navigation privée ou stockage refusé : on s'en passe.
  }
}

/** Code de partie : 4 lettres, saisie tolérante (minuscules, espaces, accents). */
export function cleanCode(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // accents : « Théo » → « THEO »
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
}

export function isCompleteCode(code: string): boolean {
  return /^[A-Z]{4}$/.test(code);
}
