/**
 * Budget de place. Ces fonctions sont pures : on peut vérifier qu'une
 * disposition TIENT sans ouvrir de navigateur, et c'est le genre de calcul qui
 * se casse en silence — une bande qui déborde ne lève aucune erreur, elle
 * pousse simplement la main hors de l'écran.
 */

import { describe, expect, it } from 'vitest';

import { bandHeights, fitBank, fitGroups, scaleFor } from './layout.ts';

/** Bandeau, écarts, et le libellé qui coiffe mes lots. */
const HEADER = 32;
const GAPS = 10;
const MINE_LABEL = 16;
const OPPONENT_CHROME = 30;

/** Téléphones tenus en paysage : c'est la seule façon dont le jeu se joue. */
const ECRANS = [
  { nom: 'iPhone SE', w: 667, h: 375 },
  { nom: 'iPhone 14', w: 844, h: 390 },
  { nom: 'iPhone 14 Pro Max', w: 932, h: 430 },
  { nom: 'iPad mini', w: 1024, h: 768 },
];

describe('Budget de la table', () => {
  it('loge les trois bandes dans la hauteur de l’écran', () => {
    for (const e of ECRANS) {
      const bands = bandHeights(scaleFor(e.h), e.h);
      const total =
        HEADER +
        OPPONENT_CHROME +
        bands.opponentStack +
        MINE_LABEL +
        bands.mineStack +
        bands.hand +
        GAPS;
      expect(total, e.nom).toBeLessThanOrEqual(e.h);
    }
  });

  it('laisse à chaque bande de quoi montrer une carte', () => {
    for (const e of ECRANS) {
      const bands = bandHeights(scaleFor(e.h), e.h);
      expect(bands.opponentStack, e.nom).toBeGreaterThanOrEqual(43);
      expect(bands.mineStack, e.nom).toBeGreaterThanOrEqual(60);
      expect(bands.hand, e.nom).toBeGreaterThanOrEqual(90);
    }
  });

  it('sert la main avant le reste', () => {
    // L'ordre de service n'est pas un détail : c'est la carte qu'on lit
    // vraiment. Servir les adversaires d'abord donnait des cartes de 64 px où
    // le nom de rue tombait à 3,6 px.
    for (const e of ECRANS) {
      const bands = bandHeights(scaleFor(e.h), e.h);
      expect(bands.hand, e.nom).toBeGreaterThan(bands.mineStack);
      expect(bands.mineStack, e.nom).toBeGreaterThanOrEqual(bands.opponentStack);
    }
  });

  it('rétrécit les lots plutôt que de les pousser hors champ', () => {
    // Un joueur en fin de partie aligne six lots : à taille fixe, les derniers
    // partaient dans un défilement horizontal que rien ne signalait.
    const large = fitGroups(300, 2, 62);
    const serre = fitGroups(300, 6, 62);
    expect(large).toBe(62);
    expect(serre).toBeLessThan(large);
    expect(serre).toBeGreaterThanOrEqual(22);
  });

  it('rétrécit les billets plutôt que de rogner le montant', () => {
    // Le montant est centré sur le billet : un recouvrement plus fort le
    // couperait en deux, donc c'est la carte qui rapetisse.
    expect(fitBank(200, 1, 62)).toBe(62);
    expect(fitBank(200, 10, 62)).toBeLessThan(62);
    expect(fitBank(200, 10, 62)).toBeGreaterThanOrEqual(22);
  });
});
