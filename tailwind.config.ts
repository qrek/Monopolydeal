import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        table: '#0f1a14',
        felt: '#16241b',
      },
    },
  },
  plugins: [],
} satisfies Config;
