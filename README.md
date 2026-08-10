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
lib/engine/
  types.ts       état, intentions, événements, erreurs typées
  cards.ts       deck complet, grilles de loyer, prédicats de cartes
  rng.ts         PRNG déterministe + mélange Fisher–Yates
  selectors.ts   lectures dérivées (lots complets, loyers, cartes payables, vue redacted)
  machine.ts     table des phases et des intentions autorisées
  reduce.ts      toutes les règles
```

## Tests

```bash
npm test          # Vitest
npm run typecheck # tsc --noEmit
```

130 tests couvrent la composition du deck, le déroulé d'un tour, les lots et jokers,
les constructions, les actions ciblées et le Refus catégorique, les loyers, les
paiements, la victoire et le replay — dont les 15 cas limites du cahier des charges.

### Exécution sans npm

L'environnement de dev de cette session n'a pas accès à `registry.npmjs.org`
(bloqué par la politique d'egress), donc `npm install` échoue. Le moteur n'ayant
aucune dépendance, la suite tourne quand même via le type-stripping natif de Node :

```bash
npm run test:offline   # node --experimental-strip-types tools/offline-test/run.mjs
```

`tools/offline-test/` contient un micro-runner et un shim de l'API Vitest utilisée
par les tests. Les fichiers de test importent `vitest` normalement et tournent tels
quels sous le vrai Vitest une fois les dépendances installées. Ce dossier n'est jamais
chargé par l'application et pourra être supprimé.

## Écarts assumés par rapport au cahier des charges

- **107 cartes, pas 106.** L'en-tête annonce « 34 cartes Action » mais le tableau
  détaillé somme à 35 (2+3+4+3+3+10+3+2+3+2). Les quantités du tableau font foi.
  `DECK_COMPOSITION` est la source unique ; revenir à 106 = retirer une carte.
- **Chaîne de Refus catégorique : parité.** Le cas limite 14 dit qu'une chaîne de
  3 Refus laisse passer l'action, ce qui contredit la règle « la cible du Refus est
  le joueur qui vient de jouer ». On applique la parité : 1 Refus annule, 2 rétablissent,
  3 annulent (`isCancelledByChain`). Une ligne à inverser si le choix inverse est voulu.

## Règles maison (non tranchées par le cahier des charges)

- Un lot composé uniquement de jokers universels n'est pas un lot complet.
- Une Maison ou un Hôtel dont le lot cesse d'être complet retourne en banque de son
  propriétaire ; un lot volé au Coup de filet part avec ses constructions.
- Un loyer réclamé sur une couleur détenue en plusieurs lots retient le meilleur lot.
- Payer plus que dû est permis (on ne rend pas la monnaie) ; on ne peut pas payer moins
  que la dette sauf en donnant littéralement tout.
