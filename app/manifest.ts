/**
 * Manifeste d'application installable.
 *
 * `standalone` est la raison d'être du fichier : lancé depuis l'écran d'accueil,
 * le jeu s'ouvre sans la barre d'adresse de Chrome, qui mangeait une bande de
 * hauteur — la ressource rare en paysage.
 */

import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Monopoly Deal',
    short_name: 'Monopoly Deal',
    description:
      'Monopoly Deal en ligne, 2 à 5 joueurs : collectionne trois lots complets, vole des propriétés, réclame tes loyers.',
    start_url: '/',
    id: '/',
    display: 'standalone',
    // Le jeu se joue écran couché : autant que le système le sache.
    orientation: 'landscape',
    background_color: '#EAF2E1',
    theme_color: '#ED1B24',
    lang: 'fr',
    categories: ['games'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        // Android rogne l'icône en cercle : celle-ci garde sa marge.
        purpose: 'maskable',
      },
    ],
  };
}
