# Monopoly Deal

Monopoly Deal multijoueur temps réel, 2 à 5 joueurs, jouable dans le navigateur.
On collectionne trois lots complets, on se vole des propriétés, on se réclame des loyers.

Projet personnel, **non affilié à Hasbro**. *Monopoly* et *Monopoly Deal* sont des
marques déposées de Hasbro ; ce dépôt reprend le nom et l'identité visuelle du jeu
pour un usage privé. Toutes les cartes sont générées en CSS/SVG — aucune image,
aucun visuel du jeu original n'est copié.

**Le jeu se joue en paysage.** Sur un téléphone tenu debout, l'écran invite à
tourner l'appareil.

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
lib/ui/                présentation : avatar, palette, textes de carte,
                       bandes du plateau, jouabilité côté client
app/api/               Route Handlers (créer, rejoindre, vue, actions)
app/                   accueil et /g/[code]
components/            marque, cartes, écrans de lobby, table et interactions
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

## Table de jeu (étapes 4 à 6)

Le jeu se joue **en paysage** : la ressource rare n'est plus la largeur mais la
hauteur, qui doit loger d'un seul tenant les adversaires, mon plateau et ma main.
Les hauteurs de bande sont donc calculées (`lib/ui/layout.ts`) et non laissées au
flux — sinon la main et les adversaires se partagent tout et le plateau du joueur
s'écrase à zéro sur un téléphone couché.

- **Disposition** : adversaires en haut, tapis (pioche et défausse) au milieu,
  mon plateau puis ma main en bas, journal sur le côté à partir de `xl`.
- **Adversaire** : cartes en main comptées (la vue serveur ne contient jamais
  leur contenu), banque avec le détail au survol, lots et leur complétion.
- **Progression** : une maison verte par lot complet, plutôt qu'un « 1/3 » qui
  voisinait avec les « 2/3 » de complétion des lots en disant autre chose.
- **Compteur d'actions** : trois pastilles qui s'éteignent.
- **Éventail** : pas et inclinaison calculés d'après la largeur réelle
  (`ResizeObserver`), débordement d'inclinaison compris.

## Polish mobile (étape 7)

Le jeu vise le téléphone en paysage ; le grand écran n'est plus une cible, la
mise en page s'y adapte sans y être optimisée.

- **Marges de sécurité** : en paysage l'encoche mange le bord gauche ou droit
  selon le sens de rotation, d'où `env(safe-area-inset-left/right)` sur la table
  et `inset-bottom` sous la main.
- **Gestes** : pas de flash bleu au doigt, pas de menu contextuel sur appui long
  (on traîne des cartes), pas de zoom au double-tap, pas de rebond de
  défilement. Le plateau ne se sélectionne pas, les champs de saisie si.
- **Modales en paysage** : les sélecteurs de cartes (paiement, défausse, cible)
  défilent horizontalement sur une seule rangée. Une grille obligeait à faire
  défiler la modale verticalement sur un écran de 390 px de haut.
- **Pioche et défausse** ont quitté le centre du tapis pour deux compteurs dans
  le bandeau : elles y flottaient sans rien y faire. Le centre ne s'allume plus
  que pour recevoir une action.

Vérifié sans débordement ni défilement parasite à 740×360, 812×375, 844×390 et
932×430.

### Retours de jeu

Le jeu ne se contente pas de changer d'état : il le raconte au moment où il
change (`components/table/TableFeedback.tsx`, alimenté par le même log
d'événements que le journal).

- **Révélation du coup** : la carte qu'un adversaire vient de jouer apparaît au
  centre du tapis, 1,5 s. Sans elle, les actions des autres n'existaient que
  dans le journal latéral — on subissait un vol sans jamais le voir.
- **Bandeau de tour** : « À toi de jouer » balaie l'écran sous le bandeau de
  marque. Placé en haut et non au centre, il peut coexister avec la révélation.
- **Montants flottants** : `−5 M` en rouge, `+5 M` en vert, au-dessus de la
  banque d'où part ou arrive la somme.
- **Fin de partie** : voile sombre et carton de victoire.

Deux familles de réglages seulement (`lib/ui/motion.ts`) : un ressort pour ce
que le doigt manipule — la main, la carte qu'on traîne, les pastilles d'action —
et une durée fixe pour ce que le jeu annonce. Rien n'anime autre chose que
`transform` et `opacity`, les deux propriétés que le compositeur traite sans
repasser par la mise en page. `prefers-reduced-motion` supprime tous les retours
sans rien casser.

### Direction artistique

Celle du plateau Monopoly : vert pâle en fond, rouge de la boîte en accent,
faces crème cernées d'un filet noir, aplats francs et aucun dégradé décoratif.
Les 10 couleurs de propriétés sont celles du plateau (`COLORS.hex` dans
`lib/engine/cards.ts`, source unique appliquée en style inline). Typo Outfit,
du 400 au 800 : la hiérarchie vient de la graisse et du crénage.

### Cartes

`components/cards/CardFace.tsx` rend les six familles à partir d'une seule
mesure, `width` : la hauteur suit le ratio 5:7 et la police est proportionnelle,
si bien que les mêmes composants servent à la main, aux lots et aux lots
adverses. Le niveau de détail se dégrade avec la taille.

- **Propriété** : le NOM DE LA RUE dans le bandeau de couleur — écrire « bleu »
  sur du bleu n'apprend rien — puis la grille des loyers, la ligne du lot complet
  en inversé, et les bonus de construction.
- **Joker bicolore** : une moitié par couleur, chacune avec SA grille de loyers
  sous son bandeau, sinon on ne sait pas quelle colonne va avec quelle couleur.
- **Joker universel** : les 10 couleurs en damier.
- **Action** : bandeau rouge, pictogramme SVG, et **le texte de la règle imprimé
  sur la carte** (`ACTION_RULES` dans `lib/ui/cards.ts`) — on ne devrait jamais
  avoir à deviner ce que fait une carte.
- **Loyer** : les couleurs concernées en pavés, et la règle en toutes lettres.
- **Argent** : une teinte par coupure, guilloché CSS.

## Interactions (étape 5)

Deux gestes mènent au même endroit : **traîner** une carte sur une zone, ou la
**taper puis taper la zone**. Le second est le seul praticable au pouce, le
premier le plus naturel à la souris ; le glisser n'est jamais obligatoire.

- Trois zones : **Banque**, **Mes propriétés**, **Jouer l'action**. Seules
  s'allument celles que la carte accepte (`lib/ui/legal.ts`).
- **Questions avant envoi** (`components/play/Prompts.tsx`) : couleur et lot d'un
  joker, lot à construire, adversaire et carte visés, couleur et cible d'un
  loyer avec les Double loyer et leur coût en actions.
- **Paiement** : sélection multi-cartes, total courant face au total dû, bouton
  inactif tant que la dette n'est pas couverte — ou actif si l'on donne
  littéralement tout. Payer plus que dû reste permis, on ne rend pas la monnaie.
- **Fenêtre de Refus** : 8 s avec barre de compte à rebours. Le compte affiché
  n'est qu'indicatif : il part de `updated_at` renvoyé par le serveur, et c'est
  le serveur qui tranche. À expiration la source réclame le dénouement, les
  autres clients prenant le relais 3 s plus tard si elle a fermé son onglet.
- **Défausse** : au-delà de 7 cartes, modale non refermable, ni plus ni moins que
  le nombre requis.
- La pioche de début de tour est automatique : elle n'est jamais un choix.
- Déplacer un joker déjà posé se fait en le tapant dans son lot (geste gratuit).

Rien n'est appliqué localement. Les lectures de `lib/ui/legal.ts` ne servent qu'à
guider la main ; toute intention repart au serveur, qui peut la refuser — et son
message de règle est affiché tel quel.

## Animations (étape 6)

Sobres, 200–300 ms, et neutralisées par `prefers-reduced-motion`.

- **Vol de carte** : la carte joue de la main vers la zone visée (280 ms). Le vol
  part au geste, pas après l'aller-retour réseau — si le coup est refusé, la
  carte est encore en main au rafraîchissement suivant.
- **Retournement** : une carte piochée arrive en pivotant.
- **Secousse** : quand on se fait voler ou qu'on paie, mon plateau tremble
  (320 ms). Le journal dit ce qui s'est passé, la secousse dit que c'est à moi.
- Modales et cartes de la main animées à l'entrée comme à la sortie.

### Mise en route Supabase

Le projet utilisé est **`mrqhesvdazroyqqcwprh`** (organisation « mechant »,
eu-west-1). Il héberge déjà une autre application : la migration est donc
idempotente et n'ajoute que les 4 tables du jeu, sans toucher aux tables
existantes.

Le schéma est **déjà appliqué**. Reste à faire, une seule fois, dans le
tableau de bord :

1. **Activer l'auth anonyme** — Authentication → Providers → *Anonymous
   sign-ins*. Sans elle, l'API répond `anonymous_provider_disabled` et personne
   ne peut créer ni rejoindre de partie. C'est le seul réglage qui ne passe pas
   par SQL.
2. Copier les deux clés — Settings → API. Supabase les nomme désormais
   « publishable » et « secret » ; les noms de variables ci-dessous sont ceux
   que lit le code et ne doivent pas être renommés.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://mrqhesvdazroyqqcwprh.supabase.co
# clé « publishable » — destinée au navigateur
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
# clé « secret » — serveur uniquement, contourne la RLS
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

La clé secrète ne prend **jamais** de préfixe `NEXT_PUBLIC_` : Next inline ces
variables dans le JavaScript envoyé au navigateur. Sur Vercel, cocher les trois
environnements (Production, Preview, Development) et **redéployer** — les
variables ne s'appliquent pas aux déploiements déjà faits.

Pour repartir d'un projet vierge, `supabase/migrations/` rejoue le schéma tel
quel.

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
