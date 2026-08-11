/** Banc de mesure du mode duel : lancé à la main, hors de la suite de tests. */
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: { environment: 'node', include: ['sim/**/*.test.ts'], testTimeout: 900_000 },
});
