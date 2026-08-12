/**
 * Budget de place. Ces fonctions sont pures : on peut vérifier qu'une
 * disposition TIENT sans ouvrir de navigateur, et c'est le genre de calcul qui
 * se casse en silence — une bande qui déborde ne lève aucune erreur, elle
 * pousse simplement la main hors de l'écran.
 */

import { describe, expect, it } from 'vitest';

import { bandHeights, bandHeightsPortrait, fitGroups, scaleFor } from './layout.ts';

/** Marges de la colonne : le bandeau, les deux écarts, les libellés. */
const HEADER = 32;
const ECARTS = 26;
const BAND_GAP = 6;
const MINE_LABEL = 16;
const OPPONENT_CHROME = 30;

function hauteurTotale(
  bands: ReturnType<typeof bandHeightsPortrait>,
  opponents: number,
): number {
  return (
    HEADER +
    opponents * (OPPONENT_CHROME + bands.opponentStack) +
    bands.mat +
    MINE_LABEL +
    bands.mineStack +
    MINE_LABEL +
    bands.bank +
    bands.hand +
    ECARTS +
    BAND_GAP * (opponents - 1)
  );
}

describe('Disposition en colonne', () => {
  const TELEPHONES = [
    { nom: 'iPhone SE', h: 667 },
    { nom: 'iPhone 14', h: 844 },
    { nom: 'iPhone 14 Pro Max', h: 932 },
    { nom: 'iPad mini', h: 1024 },
  ];

  it('tient dans l’écran, de 2 à 5 joueurs', () => {
    for (const tel of TELEPHONES) {
      for (let joueurs = 2; joueurs <= 5; joueurs++) {
        const adversaires = joueurs - 1;
        const scale = scaleFor(tel.h);
        const bands = bandHeightsPortrait(scale, tel.h, adversaires);
        const total = hauteurTotale(bands, adversaires);
        // Un petit téléphone à cinq joueurs ne rentre pas, même au plancher :
        // là, c'est la liste des adversaires qui défile. Partout ailleurs, la
        // colonne doit tomber juste.
        const auPlancher = bands.opponentStack <= 43;
        if (!auPlancher) {
          expect(total, `${tel.nom} à ${joueurs} joueurs`).toBeLessThanOrEqual(tel.h);
        }
      }
    }
  });

  it('laisse à chaque bande de quoi montrer une carte', () => {
    // Même à cinq sur le plus petit téléphone, aucune bande ne tombe sous le
    // plancher : un lot y reste un bandeau de couleur surmonté de sa pastille
    // d'avancement, ce qui est peu mais dit encore où en est l'adversaire.
    for (const tel of TELEPHONES) {
      const bands = bandHeightsPortrait(scaleFor(tel.h), tel.h, 4);
      expect(bands.opponentStack, tel.nom).toBeGreaterThanOrEqual(43);
      expect(bands.mineStack, tel.nom).toBeGreaterThanOrEqual(43);
      expect(bands.bank, tel.nom).toBeGreaterThanOrEqual(31);
      expect(bands.mat, tel.nom).toBeGreaterThanOrEqual(30);
    }
  });

  it('montre de vraies cartes dès qu’il y a la place', () => {
    // Sur un téléphone courant, on veut mieux que le plancher — y compris à
    // cinq joueurs. Le petit modèle, lui, n'a pas la place : là, mes lots
    // gardent leur taille et c'est le tapis qui se resserre.
    for (const tel of TELEPHONES.filter((t) => t.h >= 844)) {
      const bands = bandHeightsPortrait(scaleFor(tel.h), tel.h, 4);
      expect(bands.opponentStack, tel.nom).toBeGreaterThanOrEqual(55);
      expect(bands.mineStack, tel.nom).toBeGreaterThanOrEqual(90);
      expect(bands.bank, tel.nom).toBeGreaterThanOrEqual(60);
    }
  });

  it('donne plus de largeur à chaque adversaire qu’en rangée', () => {
    // C'est la raison d'être de la colonne. Le gain n'est pas en hauteur — les
    // bandes sont comparables — mais en LARGEUR : en rangée, trois adversaires
    // se partagent les 651 px du paysage ; en colonne, chacun prend les 374 px
    // du portrait pour lui. Ce sont leurs lots qui cessent d'être écrasés.
    const rangee = fitGroups(Math.floor((651 - 24) / 3), 5, 40);
    const colonne = fitGroups(374 - 16, 5, 40);
    expect(colonne).toBeGreaterThan(rangee);
  });

  it('rend au tapis ce que les autres bandes ne prennent pas', () => {
    // À deux joueurs il reste de l'air : les plafonds bornent les bandes, et le
    // milieu de la table s'étire au lieu de laisser un trou. On vérifie ici
    // qu'il RESTE de la place à étirer — le tapis est `flex-1` dans la vue.
    const bands = bandHeightsPortrait(scaleFor(844), 844, 1);
    expect(hauteurTotale(bands, 1)).toBeLessThan(844 - 60);
  });

  it('la disposition en rangée ignore les bandes propres à la colonne', () => {
    const bands = bandHeights(scaleFor(375), 375);
    expect(bands.bank).toBe(0);
    expect(bands.mat).toBe(0);
  });
});
