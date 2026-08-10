-- Monopoly Deal — schéma initial.
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
create table if not exists public.games (
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

create table if not exists public.game_players (
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
create table if not exists public.game_private (
  game_id uuid primary key references public.games (id) on delete cascade,
  seed text not null,
  state jsonb
);

-- Log append-only des intentions appliquées. seq = games.version après
-- application. L'état est reconstructible en rejouant ce log dans le moteur
-- (lib/engine replay) avec le seed. actor_id null = action serveur
-- (ADVANCE_TURN automatique, acceptation par timeout).
create table if not exists public.game_actions (
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

-- `security invoker` + search_path figé : sans cela un rôle appelant peut
-- détourner la résolution des noms depuis le trigger (lint 0011 Supabase).
create or replace function public.games_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists games_touch_updated_at on public.games;
create trigger games_touch_updated_at
before update on public.games
for each row execute function public.games_touch_updated_at();

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
drop policy if exists games_select on public.games;
create policy games_select on public.games
  for select to authenticated
  using (true);

-- Liste des joueurs (pseudos, sièges, connexion) : idem, la salle d'attente
-- doit être visible avant de rejoindre.
drop policy if exists game_players_select on public.game_players;
create policy game_players_select on public.game_players
  for select to authenticated
  using (true);

-- Le log d'intentions n'est lisible que par les joueurs de la partie.
drop policy if exists game_actions_select on public.game_actions;
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
-- Idempotent : ce schéma peut cohabiter avec une autre application dans le
-- même projet Supabase, dont des tables sont déjà publiées.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_players'
  ) then
    alter publication supabase_realtime add table public.game_players;
  end if;
end $$;
