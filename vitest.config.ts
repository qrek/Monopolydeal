import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Le moteur s'importe en chemins relatifs, mais tout ce qui touche à l'UI
  // utilise l'alias du projet : sans lui, ces tests-là ne se chargent pas.
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    globals: false,
  },
});
