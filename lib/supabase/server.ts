/**
 * Client Supabase lié aux cookies de la requête (App Router). Sert uniquement
 * à identifier l'utilisateur (auth anonyme) dans les Route Handlers — les
 * écritures se font avec le client admin.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { ApiError } from '@/lib/server/errors';

export async function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis',
    );
  }
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) {
            store.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component : la mutation de cookies y est
          // interdite, le middleware ou le handler s'en chargera.
        }
      },
    },
  });
}

/** Identifiant de l'utilisateur courant, ou 401. */
export async function requireUserId(): Promise<string> {
  const supabase = await authClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Session Supabase absente');
  }
  return data.user.id;
}
