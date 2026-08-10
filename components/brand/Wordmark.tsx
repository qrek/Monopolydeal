/**
 * Logotype « MONOPOLY DEAL » : bandeau rouge incliné, filet noir, capitales
 * crème très serrées. Reconstruit en CSS avec la typo du site — aucune image.
 */

interface WordmarkProps {
  /** Hauteur du bandeau, en px. Tout le reste en découle. */
  size?: number;
  /** Sans le mot « DEAL » : pour les endroits très étroits. */
  short?: boolean;
  className?: string;
}

export function Wordmark({ size = 34, short = false, className = '' }: WordmarkProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className="brand-bar inline-flex items-center rounded-[0.2em] px-[0.45em] shadow-card"
        style={{
          height: size,
          fontSize: size * 0.52,
          transform: 'skewX(-8deg)',
        }}
      >
        <span
          className="font-extrabold uppercase leading-none tracking-[-0.02em]"
          style={{ transform: 'skewX(8deg)' }}
        >
          Monopoly
        </span>
      </span>
      {!short && (
        <span
          className="font-extrabold uppercase leading-none tracking-[0.14em] text-ink"
          style={{ fontSize: size * 0.44 }}
        >
          Deal
        </span>
      )}
    </span>
  );
}
