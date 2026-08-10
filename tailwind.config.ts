import type { Config } from 'tailwindcss';

/**
 * Palette de la table. Aplats francs, contrastes marqués, aucun dégradé
 * décoratif : le look vient de la typo et des aplats, pas des effets.
 * Les 10 couleurs de propriétés vivent dans lib/engine/cards.ts (`COLORS.hex`)
 * — source unique, appliquée en style inline par les composants de carte.
 */
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        table: '#0e1512',
        felt: {
          DEFAULT: '#16241b',
          light: '#1d3025',
          ring: '#2b4a39',
        },
        ink: '#f2f5f1',
        muted: '#8fa398',
        gold: '#f2c33c',
        danger: '#dc3b34',
      },
      fontFamily: {
        sans: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '0.875rem',
        panel: '1.25rem',
      },
      boxShadow: {
        panel: '0 18px 40px -24px rgba(0, 0, 0, 0.9)',
        lift: '0 10px 24px -14px rgba(0, 0, 0, 0.85)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
} satisfies Config;
