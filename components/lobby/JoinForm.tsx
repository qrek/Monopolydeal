/**
 * Écran d'arrivée sur un lien d'invitation, quand on n'est pas encore joueur
 * de cette partie. Choix du pseudo, puis join.
 */

'use client';

import { useEffect, useState } from 'react';

import { CodeTiles } from '@/components/lobby/RoomCode';
import { Button } from '@/components/ui/Button';
import { NameField } from '@/components/ui/NameField';
import { loadName, saveName } from '@/lib/client/identity';
import { useGameStore } from '@/lib/client/store';
import { useUserId } from '@/lib/client/useUserId';

export function JoinForm({ code }: { code: string }) {
  const join = useGameStore((s) => s.join);
  const status = useGameStore((s) => s.status);
  const userId = useUserId();
  const [name, setName] = useState('');

  useEffect(() => setName(loadName()), []);

  const trimmed = name.trim();
  const submit = () => {
    if (!trimmed) return;
    saveName(trimmed);
    void join(code, trimmed);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header className="animate-fade-up flex flex-col items-center gap-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">
          Tu es invité à la partie
        </p>
        <CodeTiles code={code} />
      </header>

      <form
        className="panel animate-fade-up space-y-5 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <NameField
          value={name}
          onChange={setName}
          seed={userId ?? trimmed}
          autoFocus
        />
        <Button type="submit" disabled={!trimmed} loading={status === 'loading'}>
          Rejoindre la partie
        </Button>
      </form>
    </main>
  );
}
