import type { Config } from 'tailwindcss';

/**
 * Palette Monopoly : le vert pâle du plateau en fond, le rouge de la boîte en
 * couleur d'accent, des faces crème cernées de noir. Aucun dégradé décoratif —
 * le jeu de plateau ne fonctionne qu'aux aplats et aux filets noirs.
 *
 * Les 10 couleurs de propriétés vivent dans lib/engine/cards.ts (`COLORS.hex`)
 * — source unique, appliquée en style inline par les composants de carte.
 */
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        board: {
          DEFAULT: '#C7E2C7',
          dark: '#A9CFAA',
          deep: '#8FBF93',
        },
        cream: '#FBF7EC',
        paper: '#FFFFFF',
        ink: {
          DEFAULT: '#141414',
          soft: '#5A655C',
        },
        mono: {
          red: '#ED1B24',
          'red-dark': '#C4141B',
        },
      },
      fontFamily: {
        sans: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '0.5rem',
        panel: '0.75rem',
      },
      boxShadow: {
        card: '0 2px 6px -2px rgba(0, 0, 0, 0.45)',
        lift: '0 10px 22px -10px rgba(0, 0, 0, 0.55)',
        panel: '0 20px 45px -25px rgba(0, 0, 0, 0.7)',
        drag: '0 18px 30px -12px rgba(0, 0, 0, 0.6)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-5px)' },
          '40%': { transform: 'translateX(5px)' },
          '60%': { transform: 'translateX(-3px)' },
          '80%': { transform: 'translateX(3px)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(237, 27, 36, 0.5)' },
          '100%': { boxShadow: '0 0 0 12px rgba(237, 27, 36, 0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shake: 'shake 300ms ease-in-out',
        'pulse-ring': 'pulse-ring 1.2s ease-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
