/**
 * Classement et statistiques personnelles, sur une seule page.
 *
 * Le classement se lit comme un tableau de loyers : la même grammaire que les
 * cartes, points de conduite compris. Les trois premiers portent leur rang en
 * négatif — c'est le seul endroit du jeu où un classement existe, autant qu'il
 * se voie.
 */

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Wordmark } from '@/components/brand/Wordmark';
import { Avatar } from '@/components/ui/Avatar';
import { RULES, type GameMode } from '@/lib/engine';
import { loadName } from '@/lib/client/identity';

interface RankRow {
  pseudo: string;
  parties: number;
  victoires: number;
  taux: number;
  derniere: string;
  rang?: number;
}

interface PlayerStats {
  pseudo: string;
  parties: number;
  victoires: number;
  taux: number;
  rang: number | null;
  mode: { nom: string; parties: number } | null;
  serie: number;
  recentes: Array<{ won: boolean; mode: string; sets: number | null; date: string }>;
}

function modeLabel(nom: string): string {
  return RULES[nom as GameMode]?.label ?? nom;
}

/** « il y a 3 jours », sans dépendance : la date exacte n'apprend rien ici. */
function depuis(iso: string): string {
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (jours <= 0) return 'aujourd’hui';
  if (jours === 1) return 'hier';
  if (jours < 30) return `il y a ${jours} jours`;
  const mois = Math.round(jours / 30);
  return `il y a ${mois} mois`;
}

function Chiffre({ valeur, libelle }: { valeur: string | number; libelle: string }) {
  return (
    <div className="flex flex-col items-center rounded-card border-2 border-ink/15 bg-paper px-3 py-2">
      <span className="text-2xl font-extrabold leading-none tabular-nums text-ink">
        {valeur}
      </span>
      <span className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide text-ink-soft">
        {libelle}
      </span>
    </div>
  );
}

export function Leaderboard() {
  const [classement, setClassement] = useState<RankRow[] | null>(null);
  const [moi, setMoi] = useState<PlayerStats | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const pseudo = loadName();
    const url = pseudo ? `/api/stats?pseudo=${encodeURIComponent(pseudo)}` : '/api/stats';
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { classement: RankRow[]; moi: PlayerStats | null }) => {
        setClassement(d.classement);
        setMoi(d.moi);
      })
      .catch(() => setErreur('Classement indisponible'));
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
      <header className="animate-fade-up flex flex-col items-center gap-3 text-center">
        <Wordmark size={34} />
        <h1 className="text-lg font-extrabold uppercase tracking-tight">Classement</h1>
        <p className="mx-auto max-w-sm text-balance text-sm leading-relaxed text-ink-soft">
          Les statistiques suivent le pseudo, pas l’appareil : reprends le même
          nom ailleurs et tu retrouves tes parties.
        </p>
      </header>

      {erreur && (
        <p role="alert" className="text-center text-sm font-bold text-mono-red">
          {erreur}
        </p>
      )}

      {/* Mes chiffres ------------------------------------------------------ */}
      {moi && (
        <section className="panel animate-fade-up space-y-4 p-5">
          <div className="flex items-center gap-3">
            <Avatar name={moi.pseudo} seed={moi.pseudo} size={38} />
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold">{moi.pseudo}</h2>
              <p className="text-xs text-ink-soft">
                {moi.rang
                  ? `${moi.rang}e au classement`
                  : moi.parties > 0
                    ? 'pas encore classé'
                    : 'aucune partie terminée'}
              </p>
            </div>
          </div>

          {moi.parties > 0 ? (
            <>
              <div className="grid grid-cols-4 gap-2">
                <Chiffre valeur={moi.parties} libelle="parties" />
                <Chiffre valeur={moi.victoires} libelle="gagnées" />
                <Chiffre valeur={`${moi.taux}%`} libelle="au but" />
                <Chiffre valeur={moi.serie} libelle="d’affilée" />
              </div>
              {moi.mode && (
                <p className="text-xs text-ink-soft">
                  Mode le plus joué : <b>{modeLabel(moi.mode.nom)}</b> ({moi.mode.parties}{' '}
                  partie{moi.mode.parties > 1 ? 's' : ''}).
                </p>
              )}
              {/* Les dernières parties, en pastilles : la forme du moment se
                  lit d'un coup d'œil, ce qu'un pourcentage ne dit pas. */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-soft">
                  Récentes
                </span>
                {moi.recentes.map((p, i) => (
                  <span
                    key={i}
                    title={`${p.won ? 'Gagnée' : 'Perdue'} · ${modeLabel(p.mode)} · ${depuis(p.date)}`}
                    className={`grid size-6 place-items-center rounded-full border-2 border-ink text-[0.6rem] font-extrabold ${
                      p.won ? 'bg-mono-red text-cream' : 'bg-paper text-ink-soft'
                    }`}
                  >
                    {p.won ? 'V' : 'D'}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-soft">
              Termine une partie et elle apparaîtra ici.
            </p>
          )}
        </section>
      )}

      {/* Le classement ----------------------------------------------------- */}
      <section className="panel animate-fade-up p-5">
        <h2 className="board-label mb-3">Les mieux classés</h2>
        {classement === null ? (
          <p className="text-sm text-ink-soft">Chargement…</p>
        ) : classement.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Personne n’est encore classé : il faut trois parties terminées.
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {classement.map((r) => {
              const podium = (r.rang ?? 99) <= 3;
              const cest_moi = moi && r.pseudo === moi.pseudo;
              return (
                <li
                  key={r.pseudo}
                  className={`flex items-center gap-2.5 rounded-card border-2 px-3 py-2 ${
                    cest_moi ? 'border-mono-red bg-mono-red/10' : 'border-ink/15 bg-paper'
                  }`}
                >
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-[0.25rem] text-[0.7rem] font-extrabold tabular-nums ${
                      podium ? 'bg-ink text-cream' : 'text-ink-soft'
                    }`}
                  >
                    {r.rang}
                  </span>
                  <Avatar name={r.pseudo} seed={r.pseudo} size={24} />
                  <span className="min-w-0 flex-1 truncate text-sm font-extrabold">
                    {r.pseudo}
                  </span>
                  <span className="shrink-0 text-[0.7rem] text-ink-soft">
                    {r.parties} partie{r.parties > 1 ? 's' : ''}
                  </span>
                  <span className="shrink-0 text-sm font-extrabold tabular-nums">
                    {r.victoires}
                    <span className="ml-1 text-[0.7rem] font-bold text-ink-soft">
                      ({r.taux}%)
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-3 text-[0.7rem] leading-snug text-ink-soft">
          Trié aux victoires, le taux départageant. Il faut trois parties
          terminées pour figurer au classement — sinon une seule victoire suffit
          à trôner à 100 %.
        </p>
      </section>

      <Link
        href="/"
        className="mx-auto text-sm font-extrabold uppercase tracking-widest text-ink-soft underline decoration-ink/30 underline-offset-4 transition-colors hover:text-ink"
      >
        Retour au jeu
      </Link>
    </main>
  );
}
