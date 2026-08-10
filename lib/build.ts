/**
 * Empreinte du déploiement, figée à la compilation.
 *
 * Elle sert à une seule chose : comparer le paquet JavaScript qui tourne dans
 * l'onglet à celui que le serveur sert MAINTENANT. Une application installée
 * sur l'écran d'accueil n'est presque jamais rechargée — iOS la garde en
 * mémoire d'un usage à l'autre — donc après une mise en ligne les joueurs
 * continuent d'exécuter l'ancien code, parfois pendant des jours, sans rien
 * pour le leur signaler.
 *
 * Repli sur « dev » quand la variable n'existe pas (local, autre hébergeur) :
 * les deux côtés lisent alors la même valeur, la comparaison ne déclenche
 * jamais rien, et le mécanisme se contente de ne pas exister.
 */
export const BUILD_ID =
  process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  'dev';
