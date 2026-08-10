import Link from 'next/link';

/** Code de partie mal formé, ou URL inconnue. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="text-6xl font-extrabold tracking-tighter text-gold">404</p>
      <p className="text-lg font-bold">Rien à cette adresse.</p>
      <p className="text-sm text-muted">
        Un code de partie, c’est 4 lettres — vérifie le lien.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-12 items-center rounded-card bg-felt-light px-5 font-bold text-ink transition-colors hover:bg-felt-ring"
      >
        Retour à l’accueil
      </Link>
    </main>
  );
}
