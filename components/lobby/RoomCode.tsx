/** Le code à 4 lettres + le partage du lien d'invitation. */

'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';

export function CodeTiles({ code, size = 'lg' }: { code: string; size?: 'lg' | 'sm' }) {
  const box =
    size === 'lg'
      ? 'size-14 text-3xl sm:size-16 sm:text-4xl'
      : 'size-9 text-lg';
  return (
    <div className="flex gap-2" aria-label={`Code de la partie : ${code.split('').join(' ')}`}>
      {code.split('').map((letter, i) => (
        <span
          key={`${letter}-${i}`}
          aria-hidden
          className={`grid place-items-center rounded-card border border-white/10 bg-black/30 font-extrabold tracking-tight text-gold ${box}`}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}

/** Lien absolu de la partie. Calculé côté client : pas d'URL en dur. */
function useInviteUrl(code: string): string {
  const [url, setUrl] = useState('');
  useEffect(() => {
    setUrl(`${window.location.origin}/g/${code}`);
  }, [code]);
  return url;
}

export function ShareInvite({ code }: { code: string }) {
  const url = useInviteUrl(code);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const share = async () => {
    if (!url) return;
    // Sur mobile, la feuille de partage native ; sinon le presse-papier.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Lotissime', text: `Rejoins ma partie : ${code}`, url });
        return;
      } catch {
        // Partage annulé : on retombe sur la copie.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt('Copie ce lien :', url);
    }
  };

  return (
    <Button variant="secondary" onClick={() => void share()} disabled={!url}>
      {copied ? 'Lien copié ✓' : 'Partager le lien'}
    </Button>
  );
}
