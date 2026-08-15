-- Statistiques et classement, indexés sur le PSEUDO et non sur le compte.
--
-- Le choix mérite d'être écrit : l'identité technique d'un joueur est son
-- compte anonyme, qui vit dans un navigateur et meurt avec son cookie. Le
-- pseudo, lui, se retape à l'identique sur un autre appareil — c'est donc lui
-- qui porte l'historique, sans qu'il faille se connecter à quoi que ce soit.
-- Le revers est assumé : qui tape le pseudo d'un autre hérite de ses parties.
-- Entre amis autour d'une table, c'est le bon compromis.

-- « Théo », « theo » et « THEO  » sont la même personne. La fonction est la
-- seule définition de cette règle : la colonne clé est générée, donc ni
-- l'application ni une reprise de données ne peuvent en donner une seconde
-- version qui divergerait.
create or replace function public.normalise_pseudo(raw text)
returns text
language sql
immutable
strict
as $$
  select nullif(
    regexp_replace(
      lower(
        translate(
          raw,
          'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñŸÿ',
          'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYy'
        )
      ),
      '\s+', ' ', 'g'
    ),
    ''
  );
$$;

comment on function public.normalise_pseudo(text) is
  'Clé de rapprochement des pseudos : accents retirés, minuscules, espaces normalisés.';

create table if not exists public.game_results (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null,
  pseudo text not null,
  pseudo_key text generated always as (public.normalise_pseudo(pseudo)) stored,
  mode text not null default 'CLASSIC',
  won boolean not null,
  -- Nul pour les parties reprises après coup, dont on ne connaît que l'issue :
  -- un zéro y serait un mensonge.
  sets smallint,
  bank smallint,
  turns smallint,
  finished_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

create index if not exists game_results_pseudo_idx on public.game_results (pseudo_key);
create index if not exists game_results_date_idx on public.game_results (finished_at desc);

alter table public.game_results enable row level security;

-- Un classement se lit par tout le monde ; il ne s'écrit que par le serveur,
-- comme le reste du jeu (clé service-role, qui contourne RLS).
drop policy if exists game_results_select on public.game_results;
create policy game_results_select on public.game_results for select using (true);

create or replace view public.leaderboard
with (security_invoker = true)
as
select
  r.pseudo_key,
  -- L'orthographe la plus récemment utilisée : c'est celle qu'on reconnaît.
  (array_agg(r.pseudo order by r.finished_at desc))[1] as pseudo,
  count(*)::int as parties,
  count(*) filter (where r.won)::int as victoires,
  round(100.0 * count(*) filter (where r.won) / count(*))::int as taux,
  max(r.finished_at) as derniere,
  avg(r.turns) filter (where r.turns is not null) as tours_moyens
from public.game_results r
where r.pseudo_key is not null
group by r.pseudo_key;

-- Reprise des parties déjà terminées : on ne reprend que ce qui est certain —
-- qui a joué, qui a gagné, quand — sans toucher à l'état privé. Les colonnes
-- de détail restent nulles pour ces parties-là.
insert into public.game_results (game_id, user_id, pseudo, mode, won, turns, finished_at)
select
  g.id,
  p.user_id,
  p.name,
  coalesce(g.mode, 'CLASSIC'),
  g.winner_id = p.user_id,
  (select count(*) from public.game_actions a
    where a.game_id = g.id and a.action ->> 'type' = 'ADVANCE_TURN')::smallint,
  g.updated_at
from public.games g
join public.game_players p on p.game_id = g.id
where g.status = 'finished' and g.winner_id is not null
on conflict (game_id, user_id) do nothing;
