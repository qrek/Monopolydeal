/**
 * Point d'entrée d'une partie. Aiguille entre salle d'attente et table selon
 * l'état renvoyé par le serveur, et gère la reconnexion : arriver sur ce lien
 * avec la même session anonyme suffit à retrouver sa place.
 */

'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { CardInspectorProvider } from '@/components/cards/CardInspector';
import { JoinForm } from '@/components/lobby/JoinForm';
import { WaitingRoom } from '@/components/lobby/WaitingRoom';
import { TableView } from '@/components/table/TableView';
import { Button } from '@/components/ui/Button';
import { usePresence } from '@/lib/client/presence';
import { useGameStore } from '@/lib/client/store';
import { isSupabaseConfigured } from '@/lib/supabase/client';

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-5 text-center">
      {children}
    </main>
  );
}

const ERROR_HINTS: Record<string, string> = {
  GAME_NOT_FOUND: 'Aucune partie ne porte ce code. Vérifie les 4 lettres.',
  GAME_STARTED: 'Cette partie a déjà commencé sans toi.',
  GAME_FULL: 'La table est complète : 5 joueurs, pas un de plus.',
  AUTH_REQUIRED: 'Session expirée. Recharge la page.',
};

export function GameRoom({ code }: { code: string }) {
  const status = useGameStore((s) => s.status);
  const error = useGameStore((s) => s.error);
  const errorCode = useGameStore((s) => s.errorCode);
  const view = useGameStore((s) => s.view);
  const attach = useGameStore((s) => s.attach);
  const detach = useGameStore((s) => s.detach);

  useEffect(() => {
    void attach(code);
    return () => detach();
  }, [code, attach, detach]);

  usePresence(code, status === 'ready');

  if (!isSupabaseConfigured()) {
    return (
      <Centered>
        <p className="text-lg font-bold">Supabase n’est pas configuré.</p>
        <p className="text-sm text-ink-soft">
          Renseigne <code>.env.local</code> d’après <code>.env.example</code>.
        </p>
      </Centered>
    );
  }

  if (status === 'error') {
    return (
      <Centered>
        <p className="text-lg font-bold">
          {(errorCode && ERROR_HINTS[errorCode]) ?? error ?? 'Erreur'}
        </p>
        <div className="w-full max-w-xs space-y-3">
          <Button onClick={() => void attach(code)} variant="secondary">
            Réessayer
          </Button>
          <Link href="/" className="block text-sm text-ink-soft hover:text-ink">
            Retour à l’accueil
          </Link>
        </div>
      </Centered>
    );
  }

  if (status === 'needs-join') return <JoinForm code={code} />;

  if (status !== 'ready' || !view) {
    return (
      <Centered>
        <span
          aria-hidden
          className="size-8 animate-spin rounded-full border-2 border-ink/20 border-t-mono-red"
        />
        <p className="text-sm text-ink-soft">Connexion à la partie…</p>
      </Centered>
    );
  }

  if (view.game.status === 'lobby') return <WaitingRoom view={view} />;

  return (
    <CardInspectorProvider>
      <TableView view={view} />
    </CardInspectorProvider>
  );
}
