/**
 * Identité du joueur : le user id anonyme Supabase, stable pour ce navigateur.
 * C'est lui qui permet la reconnexion via le même lien — et qui sert de graine
 * à la couleur d'avatar.
 */

'use client';

import { useEffect, useState } from 'react';

import { ensureSession } from '@/lib/supabase/client';

export function useUserId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void ensureSession()
      .then((userId) => {
        if (alive) setId(userId);
      })
      .catch(() => {
        // Pas de session : l'écran affichera l'erreur au premier envoi.
      });
    return () => {
      alive = false;
    };
  }, []);
  return id;
}
