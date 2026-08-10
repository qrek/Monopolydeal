/**
 * Client Supabase navigateur (singleton) + connexion anonyme.
 * L'auth anonyme donne un user id stable par navigateur : c'est l'identité du
 * joueur, elle survit au rechargement de la page (reconnexion).
 */

'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function browserClient(): SupabaseClient {
  if (cached) return cached;
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  );
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
