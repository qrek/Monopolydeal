/**
 * Agent de service minimal.
 *
 * Il ne met RIEN en cache, volontairement. Une partie est temps réel et son
 * état vit sur le serveur : servir une réponse d'API périmée, ou un ancien
 * paquet JavaScript après un déploiement, casserait la partie de façon bien
 * plus pénible que ne l'aiderait un chargement hors ligne.
 *
 * Il existe parce que Chrome exige un gestionnaire `fetch` pour proposer
 * l'installation sur l'écran d'accueil.
 */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Passe-plat : le réseau, et rien d'autre.
  event.respondWith(fetch(event.request));
});
