-- Couleur choisie par un joueur, pour son avatar et sa bande à la table.
--
-- Nullable : sans choix explicite, la couleur reste dérivée de l'identifiant,
-- comme avant. La contrainte liste la palette côté base pour qu'un client
-- bricolé ne puisse pas injecter une couleur illisible sur le tapis.
alter table public.game_players
  add column if not exists color text
    check (color is null or color in (
      '#E86FA9', '#F08A2B', '#DC3B34', '#F2C33C',
      '#2E9E5B', '#3FB8AF', '#6EC6E8', '#8B7BE8'
    ));
