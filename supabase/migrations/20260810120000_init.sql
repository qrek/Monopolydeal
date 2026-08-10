-- Lotissime — schéma initial.
--
-- Principe : le serveur est seul maître de l'état. Les clients (auth anonyme)
-- n'ont AUCUN droit d'écriture : toutes les mutations passent par les Route
-- Handlers Next.js qui utilisent la clé service-role. Les clients lisent les
-- métadonnées et s'abonnent au Realtime pour savoir quand refetch la vue
-- filtrée (mains adverses masquées) servie par l'API.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Métadonnées publiques d'une partie. `version` est incrémenté à chaque action
-- appliquée : c'est le signal Realtime et le verrou optimiste des écritures.
create table public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{4}$'),
  status text not null default 'lobby' check (status in ('lobby', 'active', 'finished')),
  phase text not null default 'LOBBY',
  host_id uuid not null,
  version integer not null default 0,
  winner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_players (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null,
  name text not null check (char_length(name) between 1 and 24),
  seat smallint not null check (seat between 0 and 4),
  connected boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id),
  unique (game_id, seat)
);

-- Données que les clients ne doivent JAMAIS lire : le seed (il détermine
-- l'ordre de la pioche) et l'état complet (mains adverses incluses).
-- RLS activé sans aucune policy = interdit à tous sauf service-role.
create table public.game_private (
  game_id uuid primary key references public.games (id) on delete cascade,
  seed text not null,
  state jsonb
);

-- Log append-only des intentions appliquées. seq = games.version après
-- application. L'état est reconstructible en rejouant ce log dans le moteur
-- (lib/engine replay) avec le seed. actor_id null = action serveur
-- (ADVANCE_TURN automatique, acceptation par timeout).
create table public.game_actions (
  game_id uuid not null references public.games (id) on delete cascade,
  seq integer not null check (seq > 0),
  actor_id uuid,
  action jsonb not null,
  created_at timestamptz not null default now(),
  primary key (game_id, seq)
);

-- ---------------------------------------------------------------------------
-- updated_at automatique
-- ---------------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger games_touch_updated_at
before update on public.games
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_private enable row level security;
alter table public.game_actions enable row level security;

-- Lecture des métadonnées : tout utilisateur authentifié (l'auth anonyme
-- compte) — nécessaire pour l'écran « rejoindre par code ». Rien de sensible :
-- code, statut, version.
create policy games_select on public.games
  for select to authenticated
  using (true);

-- Liste des joueurs (pseudos, sièges, connexion) : idem, la salle d'attente
-- doit être visible avant de rejoindre.
create policy game_players_select on public.game_players
  for select to authenticated
  using (true);

-- Le log d'intentions n'est lisible que par les joueurs de la partie.
create policy game_actions_select on public.game_actions
  for select to authenticated
  using (
    exists (
      select 1
      from public.game_players gp
      where gp.game_id = game_actions.game_id
        and gp.user_id = (select auth.uid())
    )
  );

-- game_private : aucune policy. Personne à part service-role.
-- Aucune policy insert/update/delete nulle part : écritures via l'API uniquement.

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Les clients s'abonnent aux changements de `games` (version) et de
-- `game_players` (lobby). game_private et game_actions ne sont pas publiés.
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_players;
