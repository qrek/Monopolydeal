import { avatarColor, initials } from '@/lib/ui/avatar';

interface AvatarProps {
  name: string;
  /** Identité stable (user id) : la couleur ne bouge pas si le pseudo change. */
  seed: string;
  size?: number;
  /** Grisé quand le joueur a fermé l'onglet. */
  offline?: boolean;
}

export function Avatar({ name, seed, size = 44, offline = false }: AvatarProps) {
  const color = avatarColor(seed);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-extrabold tracking-tight text-table transition-opacity"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        backgroundColor: color,
        opacity: offline ? 0.35 : 1,
        boxShadow: `inset 0 -${Math.round(size * 0.06)}px 0 rgba(0,0,0,0.18)`,
      }}
    >
      {initials(name)}
    </span>
  );
}
