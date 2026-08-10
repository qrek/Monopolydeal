/**
 * Enregistre l'agent de service. Sans lui, Chrome ne propose pas « ajouter à
 * l'écran d'accueil », qui est tout l'intérêt : lancée depuis l'icône,
 * l'application s'ouvre sans la barre d'adresse.
 */

'use client';

import { useEffect } from 'react';

export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Après le chargement : l'enregistrement n'a aucune raison de disputer la
    // bande passante au premier rendu.
    const register = () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // Navigation privée, permissions restreintes… le jeu marche sans.
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
