/**
 * L'aide-mémoire, ouvert depuis l'accueil, le salon ou la table.
 *
 * Il est fait pour être consulté au milieu d'un tour, pas lu : un sommaire
 * cliquable, des chapitres courts, et le tableau des loyers en premier plan
 * parce que c'est neuf fois sur dix la question qu'on se pose.
 */

'use client';

import { useState } from 'react';

import { Modal } from '@/components/ui/Modal';
import { COLORS, MAX_ACTIONS_PER_TURN, rulesFor, type GameMode } from '@/lib/engine';
import {
  actionTable,
  chaptersFor,
  rentTable,
  sizeLabel,
  type RentRow,
  type RuleChapter,
} from '@/lib/ui/rules';

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-ink-soft">
      {children}
    </h3>
  );
}

function Chapter({ chapter }: { chapter: RuleChapter }) {
  return (
    <section id={`regle-${chapter.id}`} className="scroll-mt-2">
      <Heading>{chapter.title}</Heading>
      {chapter.lede && (
        <p className="mb-2 text-sm font-semibold leading-snug text-ink">
          {chapter.lede}
        </p>
      )}
      <dl className="flex flex-col gap-1.5">
        {chapter.entries.map((e) => (
          <div
            key={e.term}
            className="rounded-card border-2 border-ink/15 bg-paper px-3 py-2"
          >
            <dt className="text-[0.7rem] font-extrabold uppercase tracking-wide text-mono-red">
              {e.term}
            </dt>
            <dd className="text-sm leading-snug text-ink">{e.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Le tableau des loyers. Une ligne par couleur, une colonne par carte
 * possédée : c'est la lecture qu'on fait avant de réclamer, « j'en ai deux,
 * ça vaut combien ».
 */
function RentTable({ rows }: { rows: RentRow[] }) {
  // Le plus long lot du mode fixe le nombre de colonnes.
  const MAX_SIZE = Math.max(...rows.map((r) => r.size));
  return (
    <section id="regle-bareme" className="scroll-mt-2">
      <Heading>Barème des loyers</Heading>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] border-collapse text-sm">
          <thead>
            <tr className="text-[0.62rem] font-extrabold uppercase tracking-wider text-ink-soft">
              <th className="px-1 pb-1 text-left">Couleur</th>
              {Array.from({ length: MAX_SIZE }, (_, i) => (
                <th key={i} className="px-1 pb-1 text-right tabular-nums">
                  {i + 1}
                </th>
              ))}
              <th className="px-1 pb-1 text-right">Valeur</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.color} className="border-t border-ink/10">
                <td className="py-1 pr-2">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block size-3 shrink-0 rounded-[0.15rem] border border-ink"
                      style={{ background: COLORS[row.color].hex }}
                      aria-hidden
                    />
                    <span className="font-bold">{row.label}</span>
                    <span className="text-[0.65rem] font-semibold text-ink-soft">
                      {sizeLabel(row)}
                    </span>
                  </span>
                </td>
                {Array.from({ length: MAX_SIZE }, (_, i) => {
                  const rent = row.rents[i];
                  const full = i === row.size - 1;
                  return (
                    <td
                      key={i}
                      className={`px-1 py-1 text-right font-bold tabular-nums ${
                        full ? 'bg-ink text-cream' : 'text-ink'
                      } ${rent === undefined ? 'opacity-25' : ''}`}
                      // Le palier du lot complet en négatif, comme sur la carte :
                      // c'est le chiffre qu'on cherche.
                      title={full ? 'Lot complet' : undefined}
                    >
                      {rent ?? '—'}
                    </td>
                  );
                })}
                <td className="px-1 py-1 text-right font-semibold tabular-nums text-ink-soft">
                  {row.value} M
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[0.7rem] leading-snug text-ink-soft">
        Chiffres en M. Le palier en négatif est celui du lot complet. Maison et
        Hôtel s’ajoutent par-dessus, sauf sur {COLORS.black.label} et{' '}
        {COLORS.turquoise.label}.
      </p>
    </section>
  );
}

function ActionTable({ mode }: { mode: GameMode }) {
  return (
    <section id="regle-actions" className="scroll-mt-2">
      <Heading>Les cartes action</Heading>
      <ul className="flex flex-col gap-1.5">
        {actionTable(mode).map((a) => (
          <li
            key={a.kind}
            className="flex items-baseline gap-2 rounded-card border-2 border-ink/15 bg-paper px-3 py-2"
          >
            {/* Même pastille que sur la carte : c'est à ça qu'on la reconnaît. */}
            <span
              className="shrink-0 rounded-[0.2rem] border-[1.5px] border-ink bg-cream px-1 text-[0.7rem] font-extrabold tabular-nums text-ink"
              title="Valeur en banque"
            >
              {a.value}M
            </span>
            <span className="min-w-0">
              <span className="text-sm font-extrabold">{a.label}</span>
              <span className="ml-1.5 text-[0.65rem] font-semibold text-ink-soft">
                ×{a.qty}
              </span>
              <span className="block text-sm leading-snug text-ink">{a.rule}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RulesBook({ mode = 'CLASSIC' }: { mode?: GameMode }) {
  const chapitres = chaptersFor(mode);
  const rows = rentTable(mode);
  const sommaire = [
    { id: 'bareme', label: 'Barème' },
    ...chapitres.map((c) => ({ id: c.id, label: c.title })),
    { id: 'actions', label: 'Actions' },
  ];
  return (
    <div className="flex flex-col gap-5">
      {/* Une seule rangée qui défile : sur un téléphone en paysage, la modale
          n'a que 340 px de haut et un sommaire sur deux lignes en mangeait le
          quart avant la première règle. */}
      <nav className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {sommaire.map((s) => (
          <a
            key={s.id}
            href={`#regle-${s.id}`}
            className="shrink-0 rounded-[0.3rem] border-2 border-ink/25 bg-cream px-2 py-1 text-[0.68rem] font-extrabold uppercase tracking-wide text-ink transition-colors hover:bg-board-dark"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <RentTable rows={rows} />
      {chapitres.map((c) => (
        <Chapter key={c.id} chapter={c} />
      ))}
      <ActionTable mode={mode} />

      <p className="text-[0.7rem] leading-snug text-ink-soft">
        En cas de désaccord, c’est le jeu qui tranche : une action refusée l’est
        toujours pour une raison, affichée en clair. Tu ne peux jamais jouer plus
        de {MAX_ACTIONS_PER_TURN} cartes, ni un coup interdit.
      </p>
    </div>
  );
}

/**
 * Le bouton et sa modale, d'un bloc : trois écrans l'ouvrent, aucun n'a de
 * raison de gérer l'état d'ouverture lui-même. La table, elle, a besoin de
 * SAVOIR qu'une fenêtre est ouverte pour endormir l'éventail dessous : c'est
 * tout ce que rapporte `onOpenChange`.
 */
export function RulesButton({
  className = '',
  label = 'Règles',
  title = 'Règles du jeu',
  mode = 'CLASSIC',
  onOpenChange,
}: {
  className?: string;
  label?: string;
  title?: string;
  mode?: GameMode;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const bascule = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => bascule(true)}
        className={className}
        aria-haspopup="dialog"
      >
        {label}
      </button>
      <Modal
        open={open}
        title={title}
        subtitle={`${rulesFor(mode).label} — le moteur reste l’arbitre`}
        onClose={() => bascule(false)}
      >
        <RulesBook mode={mode} />
      </Modal>
    </>
  );
}
