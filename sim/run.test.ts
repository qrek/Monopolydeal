/**
 * Banc de mesure, pas un test : il fait tourner des milliers de parties à deux
 * joueurs et imprime les statistiques. Lancé à la main, jamais en CI.
 */

import { describe, expect, it } from 'vitest';

import {
  BASE,
  DUEL_B0,
  DUEL_B1,
  DUEL_B2,
  DUEL_B3,
  DUEL,
  DUEL_MOTEUR,
  DUEL_V2,
  ONLY_BONUS1,
  ONLY_BONUS2,
  ONLY_HANDICAP,
  ONLY_JSN,
  ONLY_MARKET,
  ONLY_RENT,
  ONLY_SOFT_DB,
  playGame,
  type Rules,
} from './bot.ts';

const N = Number(process.env.SIM_N ?? 400);

function med(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}
function moy(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
/** Marge d'erreur à 95 % sur une proportion. */
function marge(p: number, n: number): number {
  return 1.96 * Math.sqrt((p * (1 - p)) / n);
}

function bench(nom: string, rules: Rules) {
  const outs = Array.from({ length: N }, (_, i) => playGame(`sim-${i}`, rules));
  const f = outs.filter((o) => o.winnerId);
  const premier = f.filter((o) => o.winnerId === 'A').length / f.length;
  const row = [
    nom.padEnd(10),
    `tours ${String(med(f.map((o) => o.turns))).padStart(3)}`,
    `1er ${(premier * 100).toFixed(1)}% ±${(marge(premier, f.length) * 100).toFixed(1)}`,
    `filet gagnant ${((f.filter((o) => o.usedDealBreaker).length / f.length) * 100).toFixed(0)}%`,
    `écrasantes ${((f.filter((o) => o.loserSets === 0).length / f.length) * 100).toFixed(0)}%`,
    `serrées ${((f.filter((o) => o.loserSets >= 2).length / f.length) * 100).toFixed(0)}%`,
    `chgts de tête ${moy(f.map((o) => o.leadChanges)).toFixed(2)}`,
    `actions en banque ${moy(f.map((o) => o.bankedActions)).toFixed(1)}`,
  ];
  console.log(row.join(' | '));
  return { premier, n: f.length };
}

describe('Banc duel', () => {
  it(`mesure ${N} parties par variante`, () => {
    console.log(`\n${N} parties par variante, mêmes graines pour toutes.\n`);
    const r = [
      // Le classique à deux, référence de tout le reste.
      bench('base', BASE),
      // Les règles envisagées, isolées : laquelle fait quoi.
      bench('+étal', ONLY_MARKET),
      bench('+filet doux', ONLY_SOFT_DB),
      bench('+loyer ×2', ONLY_RENT),
      bench('+1 refus/tour', ONLY_JSN),
      bench('DUEL (4 règles)', DUEL),
      // Les compensations du second joueur, sur le deck classique.
      bench('+2e joueur +1', ONLY_BONUS1),
      bench('+2e joueur +2', ONLY_BONUS2),
      bench('+1er tour -1', ONLY_HANDICAP),
      bench('DUEL v2', DUEL_V2),
      // Le mode réellement implémenté, et le balayage de sa compensation
      // sur SON deck — la calibrer sur le deck classique donnait faux.
      bench('MOTEUR duel', DUEL_MOTEUR),
      bench('duel +0', DUEL_B0),
      bench('duel +1', DUEL_B1),
      bench('duel +2', DUEL_B2),
      bench('duel +3', DUEL_B3),
    ];
    expect(r.every((x) => x.n > 0)).toBe(true);
  }, 900_000);
});
