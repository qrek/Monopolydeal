import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Occupe toute la largeur — le défaut sur mobile. */
  block?: boolean;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'border-2 border-ink bg-mono-red text-cream hover:bg-mono-red-dark active:bg-mono-red-dark',
  secondary:
    'border-2 border-ink bg-cream text-ink hover:bg-board-dark active:bg-board-dark',
  ghost: 'border-2 border-transparent text-ink-soft hover:text-ink',
};

export function Button({
  variant = 'primary',
  block = true,
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // 48px de haut : cible tactile confortable au pouce.
      className={[
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-card px-4',
        'text-base font-extrabold tracking-tight transition-all duration-200',
        'shadow-card disabled:cursor-not-allowed disabled:shadow-none',
        // Un bouton inactif devient un aplat inerte : jamais un aplat de marque
        // simplement assombri, qu'on prendrait pour un bouton cliquable.
        'disabled:border-ink/25 disabled:bg-board-dark/60 disabled:text-ink-soft',
        'active:translate-y-px disabled:active:translate-y-0',
        block ? 'w-full' : '',
        VARIANTS[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
