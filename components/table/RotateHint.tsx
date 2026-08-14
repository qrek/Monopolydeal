/**
 * Le jeu se joue en paysage. Sur un téléphone tenu debout, on le dit plutôt
 * que d'empiler une table illisible — avec une porte de sortie pour qui a
 * verrouillé la rotation de son écran.
 */

'use client';

import { useState } from 'react';

import { Wordmark } from '@/components/brand/Wordmark';
import { Button } from '@/components/ui/Button';
import { COUCHE } from '@/lib/ui/couches';

export function RotateHint({ onDismiss }: { onDismiss: () => void }) {
  const [leaving, setLeaving] = useState(false);
  return (
    <div
      className="fixed inset-0 grid place-items-center bg-board px-6 text-center"
      style={{ zIndex: COUCHE.rotation }}
    >
      <div className="flex max-w-xs flex-col items-center gap-5">
        <Wordmark size={30} />
        <span
          aria-hidden
          className="grid size-20 place-items-center rounded-panel border-2 border-ink bg-cream text-4xl"
        >
          ↻
        </span>
        <p className="text-lg font-extrabold leading-tight">
          Tourne ton téléphone.
        </p>
        <p className="text-sm text-ink-soft">
          La table se joue en paysage : tes cartes et celles des adversaires
          tiennent alors sur un seul écran.
        </p>
        <Button
          variant="secondary"
          loading={leaving}
          onClick={() => {
            setLeaving(true);
            onDismiss();
          }}
        >
          Continuer quand même
        </Button>
      </div>
    </div>
  );
}
