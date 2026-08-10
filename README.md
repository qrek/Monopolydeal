# Lotissime

Jeu de cartes multijoueur temps réel, 2–5 joueurs, jouable dans le navigateur.
Collection de lots immobiliers : on se vole des propriétés, on se réclame des loyers.

Projet personnel. Design et nommage originaux, cartes générées en CSS/SVG, aucune image externe.

## Stack

Next.js 15 (App Router, TS strict) · Supabase (Postgres + Auth anonyme + Realtime) ·
Tailwind · Framer Motion · Zustand · déploiement Vercel.

## Architecture

1. **Le serveur est seul maître de l'état.** Le client envoie des *intentions*
   (`PLAY_CARD`, `PAY`, `END_TURN`…), jamais un état.
2. **Moteur pur et isolé** dans `lib/engine` : TypeScript sans aucune dépendance
   (ni React, ni Supabase). Signature `reduce(state: GameState, action: GameAction): GameState`.
   Déterministe — le seed du mélange est stocké en base.
3. **Log append-only** : `state.events` alimente le journal de partie ; la liste des
   intentions rejouée par `replay()` reconstruit l'état (reconnexion, debug).
4. **Machine à états explicite** (`lib/engine/machine.ts`) :
   `LOBBY → DRAW → PLAY → RESOLVING_ACTION → AWAITING_PAYMENT → DISCARD → END_TURN → GAME_OVER`.

```
lib/engine/            moteur pur (aucune dépendance)
  types.ts             état, intentions, événements, erreurs typées
  cards.ts             deck complet, grilles de loyer, prédicats de cartes
  rng.ts               PRNG déterministe + mélange Fisher–Yates
  selectors.ts         lectures dérivées (lots, loyers, cartes payables, vue redacted)
  machine.ts           table des phases et des intentions autorisées
  reduce.ts            toutes les règles
lib/server/            couche service (service-role, serveur uniquement)
  games.ts             création/lobby, application des intentions, verrou optimiste
lib/supabase/          clients Supabase (admin / SSR / navigateur)
lib/client/            api REST typée, abonnement Realtime, store Zustand
lib/ui/                helpers de présentation (avatar généré)
app/api/               Route Handlers (créer, rejoindre, vue, actions)
app/                   accueil et /g/[code]
components/            primitives d'UI et écrans de lobby
supabase/migrations/   schéma SQL versionné
```

## Synchro temps réel (étape 2)

- **Postgres** : `games` (métadonnées + `version`), `game_players`,
  `game_private` (seed + état complet — RLS sans policy, service-role seulement),
  `game_actions` (log append-only des intentions, `seq` = version).
- **Écritures** : uniquement via les Route Handlers avec la clé service-role.
  Chaque intention passe par le moteur (`reduce`) puis est persistée avec un
  verrou optimiste sur `games.version` (conflit ⇒ 409, le client réessaie).
- **Lectures** : `GET /api/games/[code]` renvoie la vue *redacted* du moteur
  (mains adverses → compteurs, pioche → compteur, seed jamais exposé).
- **Realtime** : les clients s'abonnent aux UPDATE de `games` et de
  `game_players` ; tout changement de version déclenche un refetch de la vue.
  Aucun état ne transite par le canal Realtime.
- **Fenêtre de Refus (8 s)** : si la cible ne répond pas, n'importe quel joueur
  peut appeler `CLAIM_TIMEOUT` ; le serveur vérifie le délai (via `updated_at`)
  et accepte au nom des retardataires. Timeout = acceptation.
- **Reconnexion** : re-`join` idempotent + état reconstruit côté serveur
  (snapshot, et log `game_actions` rejouable par `replay()` du moteur).

## Lobby (étape 3)

- **Créer** une partie depuis l'accueil : le serveur tire un code à 4 lettres
  dérivé du seed, l'URL `/g/CODE` est le lien d'invitation.
- **Rejoindre** par le lien ou en tapant le code. Si on n'est pas encore joueur
  de la partie, l'API répond `403 NOT_A_PLAYER` et l'écran bascule sur le choix
  du pseudo ; sinon on entre directement.
- **Salle d'attente** : liste temps réel des joueurs (Realtime sur
  `game_players`), avatars générés en CSS (initiales + couleur FNV-1a dérivée du
  user id, donc stable même après un renommage), sièges libres visibles,
  bouton de lancement réservé à l'hôte et actif de 2 à 5 joueurs.
- **Reconnexion** : l'identité est le user id anonyme Supabase, stable pour ce
  navigateur ; `join` est idempotent. Rouvrir le lien suffit à retrouver sa
  place, en lobby comme en cours de partie.
- **Présence** : `game_players.connected` repasse à `true` au retour d'onglet et
  à `false` via `sendBeacon` au départ — de quoi distinguer « absent » de « en
  train de recharger ». Purement cosmétique : rien n'en dépend côté règles.

## Table de jeu (étape 4)

Statique pour l'instant : tout est en lecture seule, les interactions arrivent
à l'étape 5.

- **Disposition** : le joueur en bas, les adversaires au-dessus dans l'ordre du
  tour (le premier est celui qui joue après nous). Sur mobile ils tiennent en
  deux colonnes — à 4 adversaires, tout le monde reste visible sans défilement.
- **Adversaire** : cartes en main comptées (la vue serveur ne contient jamais
  leur contenu), total de banque avec le détail carte par carte au survol, lots
  avec leur complétion (`2/3`) et leurs constructions.
- **Progression** : les lots complets sont figurés par des jetons plutôt qu'un
  `1/3` — un compteur numérique voisinait avec les `2/3` de complétion des lots
  et disait autre chose au même endroit.
- **Compteur d'actions** : trois pastilles qui s'éteignent, à hauteur du pouce.
- **Main en éventail** : le pas et l'inclinaison sont calculés d'après la
  largeur réelle (`ResizeObserver`), débordement d'inclinaison compris, pour que
  l'éventail tienne à 375 px sans rogner une carte.
- **Journal** : colonne fixe à partir de `lg`, feuille glissante sur mobile.

### Cartes

`components/cards/CardFace.tsx` rend les six familles (argent, propriété, joker
bicolore, joker universel, action, loyer) à partir d'une seule mesure, `width` :
la hauteur suit le ratio 5:7 et la police est proportionnelle, si bien que les
mêmes composants servent à la main (96 px), aux lots (54 px) et aux lots
adverses (36 px). Le niveau de détail se dégrade avec la taille — en dessous de
80 px le nom de la couleur et la pastille de valeur disparaissent, car dans un
lot les cartes se chevauchent et la même mention répétée trois fois n'est que du
bruit. Les pictogrammes des 10 actions sont des SVG inline (`ActionGlyph`).

### Direction artistique

Aplats francs, coins arrondis, une seule typo (Outfit) du 400 au 800 — la
hiérarchie vient de la graisse et du crénage. Aucune image externe : avatars,
pastilles et cartes sont du CSS/SVG. Mobile-first, cibles tactiles de 48 px,
mise en page vérifiée à 375 px. Les 10 couleurs de propriétés ont une source
unique, `COLORS[color].hex` dans `lib/engine/cards.ts`, appliquée en style
inline par les composants.

### Mise en route Supabase

1. Crée un projet sur supabase.com, puis exécute
   `supabase/migrations/20260810120000_init.sql` (SQL Editor ou `supabase db push`).
2. Active l'auth anonyme : Authentication → Providers → Anonymous sign-ins.
3. Copie `.env.example` vers `.env.local` et remplis les 3 clés (Settings → API).
   Sur Vercel : mêmes variables dans les réglages du projet.

## Tests

```bash
npm test          # Vitest
npm run typecheck # tsc --noEmit
```

130 tests couvrent la composition du deck, le déroulé d'un tour, les lots et jokers,
les constructions, les actions ciblées et le Refus catégorique, les loyers, les
paiements, la victoire et le replay — dont les 15 cas limites du cahier des charges.

## Écarts assumés par rapport au cahier des charges

- **106 cartes.** Le tableau des actions du cahier des charges donnait
  Échange forcé ×4 (soit 35 actions / 107 cartes) ; la composition réelle du jeu
  est Échange forcé ×3, retenue ici : 34 actions, 106 cartes au total.
- **Chaîne de Refus catégorique plafonnée à 2** (décision produit, remplace le
  « sans limite » de la spec) : la cible peut jouer un Refus (action annulée), la
  source peut le contrer (action rétablie) et la chaîne s'arrête là — un 3e Refus
  est illégal. Au 2e Refus l'action se résout immédiatement, sans attendre de
  réponse supplémentaire (`MAX_JSN_CHAIN`, `isCancelledByChain`).

## Règles maison (non tranchées par le cahier des charges)

- Un lot composé uniquement de jokers universels n'est pas un lot complet.
- Une Maison ou un Hôtel dont le lot cesse d'être complet retourne en banque de son
  propriétaire ; un lot volé au Coup de filet part avec ses constructions.
- Un loyer réclamé sur une couleur détenue en plusieurs lots retient le meilleur lot.
- Payer plus que dû est permis (on ne rend pas la monnaie) ; on ne peut pas payer moins
  que la dette sauf en donnant littéralement tout.
