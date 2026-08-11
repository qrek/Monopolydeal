/** Accueil : choisir son pseudo, puis créer une partie ou en rejoindre une. */

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Wordmark } from '@/components/brand/Wordmark';
import { RulesButton } from '@/components/rules/RulesBook';
import { Button } from '@/components/ui/Button';
import { NameField } from '@/components/ui/NameField';
import { api, RequestError } from '@/lib/client/api';
import {
  cleanCode,
  isCompleteCode,
  loadName,
  saveName,
} from '@/lib/client/identity';
import { useUserId } from '@/lib/client/useUserId';
import { RULES, type GameMode } from '@/lib/engine';
import { ensureSession, isSupabaseConfigured } from '@/lib/supabase/client';

export function HomeScreen() {
  const router = useRouter();
  const userId = useUserId();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<GameMode>('CLASSIC');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Le pseudo mémorisé n'est lisible qu'après l'hydratation.
  useEffect(() => setName(loadName()), []);

  const configured = isSupabaseConfigured();
  const trimmed = name.trim();
  const ready = trimmed.length > 0 && configured;

  const create = async () => {
    setBusy('create');
    setError(null);
    try {
      saveName(trimmed);
      await ensureSession();
      const { code: created } = await api.createGame(trimmed, mode);
      router.push(`/g/${created}`);
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Création impossible');
      setBusy(null);
    }
  };

  const join = () => {
    if (!isCompleteCode(code)) return;
    saveName(trimmed);
    setBusy('join');
    router.push(`/g/${code}`);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header className="animate-fade-up flex flex-col items-center gap-3 text-center">
        <Wordmark size={44} />
        <p className="mx-auto max-w-xs text-balance text-sm leading-relaxed text-ink-soft">
          Trois lots complets et la partie est à toi. Vole, réclame, encaisse.
          De 2 à 5 joueurs.
        </p>
      </header>

      {!configured && (
        <p className="rounded-card border border-mono-red bg-mono-red/10 px-4 py-3 text-sm text-ink">
          Supabase n’est pas configuré : renseigne <code>.env.local</code>{' '}
          d’après <code>.env.example</code>.
        </p>
      )}

      <section className="panel animate-fade-up space-y-5 p-5">
        <NameField
          value={name}
          onChange={setName}
          seed={userId ?? trimmed}
          autoFocus
        />

        {/* Le mode se choisit ici et nulle part ailleurs : il est figé à la
            création, et c'est le serveur qui en répond. */}
        <fieldset>
          <legend className="mb-2 block text-xs font-bold uppercase tracking-widest text-ink-soft">
            Mode de jeu
          </legend>
          <div className="grid gap-2">
            {(Object.keys(RULES) as GameMode[]).map((m) => {
              const on = m === mode;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={on}
                  className={`rounded-card border-2 px-3 py-2 text-left transition-colors ${
                    on
                      ? 'border-ink bg-cream shadow-card'
                      : 'border-ink/20 bg-transparent hover:border-ink/40'
                  }`}
                >
                  <span className="block text-sm font-extrabold text-ink">
                    {RULES[m].label}
                  </span>
                  <span className="block text-xs text-ink-soft">{RULES[m].tagline}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <Button onClick={() => void create()} disabled={!ready} loading={busy === 'create'}>
          Créer une partie
        </Button>

        <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-ink-soft">
          <span className="h-px flex-1 bg-ink/20" />
          ou
          <span className="h-px flex-1 bg-ink/20" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            join();
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-ink-soft">
              Rejoindre avec un code
            </span>
            <input
              className="field text-center text-2xl font-extrabold uppercase tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(cleanCode(e.target.value))}
              placeholder="ABCD"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={4}
              enterKeyHint="go"
              aria-label="Code de la partie, 4 lettres"
            />
          </label>
          <Button
            type="submit"
            variant="secondary"
            disabled={!ready || !isCompleteCode(code)}
            loading={busy === 'join'}
          >
            Rejoindre
          </Button>
        </form>
      </section>

      {error && (
        <p role="alert" className="text-center text-sm font-bold text-mono-red">
          {error}
        </p>
      )}

      <RulesButton
        className="mx-auto text-sm font-extrabold uppercase tracking-widest text-ink-soft underline decoration-ink/30 underline-offset-4 transition-colors hover:text-ink"
        label="Règles du jeu"
        mode={mode}
      />
    </main>
  );
}
