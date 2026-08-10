/** Page d'accueil provisoire — remplacée par le lobby à l'étape 3. */

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-4xl font-black tracking-tight">Lotissime</h1>
      <p className="max-w-sm text-center text-sm text-neutral-400">
        Collectionne trois lots complets, vole tes adversaires, réclame tes
        loyers. Le lobby arrive à l&apos;étape 3.
      </p>
    </main>
  );
}
