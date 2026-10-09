-- Un événement ne peut viser qu'une boutique publique, et un article visible de CETTE boutique.
alter policy "visiteur enregistre un événement" on evenements
  with check (
    exists (select 1 from boutiques b where b.id = boutique_id and b.statut = 'validee')
    and (article_id is null or (prive.article_visible(article_id)
         and exists (select 1 from articles a where a.id = article_id and a.boutique_id = evenements.boutique_id)))
    and (taille is null or char_length(taille) <= 20)
  );

-- Un signalement ne peut viser qu'un article visible du public, avec un motif connu.
alter policy "visiteur signale" on signalements
  with check (
    statut = 'ouvert'
    and motif in ('contrefacon', 'contenu_inapproprie', 'arnaque', 'autre')
    and prive.article_visible(article_id)
  );
