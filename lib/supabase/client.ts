/**
 * Client Supabase navigateur (singleton) + connexion anonyme.
 * L'auth anonyme donne un user id stable par navigateur : c'est l'identité du
 * joueur, elle survit au rechargement de la page (reconnexion).
 */

'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/**
 * Les variables NEXT_PUBLIC_* sont inlinées au build : si le déploiement n'est
 * pas configuré, autant l'afficher franchement plutôt que planter à la
 * première requête.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function browserClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis (voir .env.example)',
    );
  }
  cached = createBrowserClient(url, key);
  return cached;
}

/** Garantit une session (anonyme au besoin) et renvoie le user id. */
export async function ensureSession(): Promise<string> {
  const supabase = browserClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.user) {
    throw new Error(`Connexion anonyme impossible : ${error?.message}`);
  }
  return anon.user.id;
}
