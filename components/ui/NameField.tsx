'use client';

import { Avatar } from '@/components/ui/Avatar';
import { cleanName } from '@/lib/client/identity';

interface NameFieldProps {
  value: string;
  onChange: (next: string) => void;
  /** Identité stable pour la couleur d'aperçu de l'avatar. */
  seed: string;
  autoFocus?: boolean;
}

/** Saisie du pseudo, avec l'avatar généré en aperçu direct. */
export function NameField({ value, onChange, seed, autoFocus }: NameFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-ink-soft">
        Ton pseudo
      </span>
      <div className="flex items-center gap-3">
        <Avatar name={value || '?'} seed={seed} size={48} />
        <input
          className="field"
          value={value}
          onChange={(e) => onChange(cleanName(e.target.value))}
          placeholder="Théo"
          maxLength={24}
          autoComplete="nickname"
          autoFocus={autoFocus}
          enterKeyHint="go"
        />
      </div>
    </label>
  );
}
