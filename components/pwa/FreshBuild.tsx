/**
 * Recharge l'application quand une nouvelle version est en ligne.
 *
 * Sur l'écran d'accueil d'un iPhone, l'application n'est pas rechargée en
 * revenant dessus : le système reprend la page telle qu'elle était, avec le
 * JavaScript d'origine. Après une mise en ligne, les joueurs voyaient donc
 * l'ancienne interface sans avoir aucun moyen de le savoir — il fallait tuer
 * l'application depuis le sélecteur, ce que personne ne devine.
 *
 * Le rechargement n'a rien de risqué ici : l'état de la partie vit sur le
 * serveur, la page le relit au montage. On ne perd qu'une animation en cours.
 */

'use client';

import { useEffect } from 'react';

import { BUILD_ID } from '@/lib/build';

/** Marqueur de session : on ne recharge qu'une fois par version et par onglet. */
const GUARD = 'build-reload';

async function checkAndReload(): Promise<void> {
  let served: string;
  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    if (!res.ok) return;
    const body: unknown = await res.json();
    if (typeof body !== 'object' || body === null) return;
    const value = (body as { build?: unknown }).build;
    if (typeof value !== 'string') return;
    served = value;
  } catch {
    // Hors ligne, ou requête coupée par une navigation : rien à conclure.
    return;
  }

  if (served === BUILD_ID) return;

  // Garde-fou : si le rechargement ne suffisait pas à changer de version — un
  // intermédiaire qui garde l'ancien HTML, par exemple — on boucherait sinon
  // sur une boucle de rechargements.
  if (sessionStorage.getItem(GUARD) === served) return;
  sessionStorage.setItem(GUARD, served);
  window.location.reload();
}

export function FreshBuild() {
  useEffect(() => {
    void checkAndReload();
    // Le moment utile est le retour sur l'application : c'est là qu'on reprend
    // une page laissée ouverte la veille.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkAndReload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return null;
}
