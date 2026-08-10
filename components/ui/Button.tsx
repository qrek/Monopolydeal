import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Occupe toute la largeur — le défaut sur mobile. */
  block?: boolean;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gold text-table hover:bg-gold/90 active:bg-gold/80',
  secondary:
    'bg-felt-light text-ink border border-white/10 hover:bg-felt-ring active:bg-felt-ring',
  ghost: 'text-muted hover:text-ink',
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
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-card px-5',
        'text-base font-bold tracking-tight transition-all duration-200',
        // Un bouton inactif devient un aplat inerte : jamais un aplat de marque
        // simplement assombri, qu'on prendrait pour un bouton cliquable.
        'disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-muted',
        'active:scale-[0.98] disabled:active:scale-100',
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
