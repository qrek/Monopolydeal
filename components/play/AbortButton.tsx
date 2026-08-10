/**
 * Porte de sortie : interrompre une partie qui ne peut plus avancer.
 *
 * Ouverte à tous les joueurs et non au seul hôte — une partie se bloque souvent
 * justement parce que quelqu'un n'est plus là, et il ne faut pas que la sortie
 * dépende de la personne absente. Confirmation obligatoire : le geste est
 * définitif pour tout le monde.
 */

'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { api, RequestError } from '@/lib/client/api';
import { useGameStore } from '@/lib/client/store';

export function AbortButton({ code }: { code: string }) {
  const applyView = useGameStore((s) => s.applyView);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abort = async () => {
    setBusy(true);
    setError(null);
    try {
      const { view } = await api.abortGame(code);
      applyView(view);
      setOpen(false);
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Interruption impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-[0.3rem] border-2 border-ink/50 px-1.5 py-1 text-[0.68rem] font-bold transition-colors hover:bg-cream"
        title="Interrompre la partie pour tout le monde"
      >
        Arrêter
      </button>

      <Modal
        open={open}
        title="Arrêter la partie ?"
        subtitle="Pour tous les joueurs, sans reprise possible"
        onClose={busy ? undefined : () => setOpen(false)}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Continuer à jouer
            </Button>
            <Button onClick={() => void abort()} loading={busy}>
              Arrêter la partie
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-soft">
          La partie se termine immédiatement pour tout le monde, sans vainqueur.
          À utiliser si elle est bloquée — un joueur parti, une action qui
          n’aboutit pas.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm font-bold text-mono-red">
            {error}
          </p>
        )}
      </Modal>
    </>
  );
}
