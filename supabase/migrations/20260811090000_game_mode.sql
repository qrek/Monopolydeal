-- Mode de jeu, figé à la création de la partie.
--
-- Il vit ici et non dans un réglage client : deux joueurs d'une même table
-- doivent jouer aux mêmes règles, et c'est le serveur qui en répond.
alter table public.games
  add column if not exists mode text not null default 'CLASSIC'
    check (mode in ('CLASSIC', 'DUEL'));
