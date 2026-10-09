-- =============================================================================
-- OranPromo : boutique de démonstration « Parfumerie Démo » (US-25, univers Beauté)
-- =============================================================================
-- CE N'EST PAS UNE MIGRATION : ce fichier est hors de supabase/migrations et n'est jamais
-- appliqué automatiquement. ⚠ NE PAS LANCER avant que le propriétaire ait validé la
-- conception de l'univers Beauté (US-25, maquette docs/maquettes/Beaute.dc.html) : si une
-- catégorie ou une règle change, ce fichier sera mis à jour d'abord.
--
-- Mode d'emploi (Supabase > SQL Editor, coller tout le fichier, lancer une fois ; chaque instruction
-- est rejouable : en cas d'erreur, corriger et relancer tout le fichier) :
--   - crée 1 boutique validée, 5 articles « Parfums », 5 photos d'exemple (placehold.co),
--     6 contenances avec leur stock et 4 promos (valables 30 jours à partir du lancement) ;
--   - relancer ne crée rien de plus (identifiants fixes, « on conflict do nothing ») ;
--   - retrait : supabase/scripts/retirer_donnees_demo.sql (boutique 33333333-… et articles
--     a0000000-0000-0000-0000-000000000006 à …010 sont dans sa liste).
--
-- Conventions de la démo (mêmes que Boutique Nour) :
--   - identifiants fixes : boutique 33333333-3333-3333-3333-333333333333, articles a0000000-…-006 à -010 ;
--   - WhatsApp volontairement invalide +213000000003 (la file WhatsApp refuse ce format : aucun message
--     ne peut partir, ni vers la boutique ni vers un vrai numéro) ;
--   - photos d'exemple sur placehold.co (texte sur fond clair), à remplacer jamais : elles partent avec la démo ;
--   - aucun compte commerçant n'est créé (la boutique n'est rattachée à personne).
-- Noms génériques : aucune marque, aucun nom de parfum existant, aucune mention « original »
-- ou « copie » (voir la question au propriétaire dans US-25).
-- Position : Gambetta (Oran), dans le rectangle de la wilaya (US-24).
-- =============================================================================


insert into boutiques (id, nom, slug, quartier, adresse, latitude, longitude, horaires, whatsapp, statut) values
  ('33333333-3333-3333-3333-333333333333', 'Parfumerie Démo', 'parfumerie-demo', 'Gambetta',
   'Boutique de démonstration (adresse fictive)', 35.699750, -0.617200, '10 h – 19 h, sauf vendredi', '+213000000003', 'validee')
on conflict (id) do nothing;

-- Articles : « Parfums », genre mixte sauf mention (la beauté est enregistrée « mixte » quand le genre est vide).
insert into articles (id, boutique_id, titre, categorie, genre, prix, couleur, description, description_ar, statut) values
  ('a0000000-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 'Eau de parfum oud boisé', 'Parfums', 'mixte', 6500, null,
   'Article de démonstration. Notes de oud, de bois de santal et d''ambre. Flacon de 100 ml.',
   'سلعة للتجربة. ريحة العود والصندل والعنبر. قرعة 100 مل.', 'disponible'),
  ('a0000000-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', 'Eau de parfum rose et musc', 'Parfums', 'femme', 4800, null,
   'Article de démonstration. Rose, musc blanc et une touche de vanille. 50 ml ou 100 ml.',
   'سلعة للتجربة. ريحة الورد والمسك الأبيض وشوية فانيلا. 50 مل ولا 100 مل.', 'disponible'),
  ('a0000000-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', 'Eau de toilette agrumes frais', 'Parfums', 'homme', 3900, null,
   'Article de démonstration. Citron, bergamote et vétiver, pour l''été. Flacon de 100 ml.',
   'سلعة للتجربة. ريحة الليمون والبرغموت، مليحة للصيف. قرعة 100 مل.', 'disponible'),
  ('a0000000-0000-0000-0000-000000000009', '33333333-3333-3333-3333-333333333333', 'Huile parfumée musc blanc', 'Parfums', 'mixte', 1500, null,
   'Article de démonstration. Huile parfumée sans alcool, en roll-on de 10 ml.',
   'سلعة للتجربة. زيت معطّر بلا كحول، رول 10 مل.', 'disponible'),
  ('a0000000-0000-0000-0000-000000000010', '33333333-3333-3333-3333-333333333333', 'Eau de parfum ambre et vanille', 'Parfums', 'femme', 5500, null,
   'Article de démonstration. Ambre, vanille et fève tonka. Flacon de 75 ml.',
   'سلعة للتجربة. العنبر والفانيلا. قرعة 75 مل.', 'disponible')
on conflict (id) do nothing;

-- Contenances (« tailles » en ml) et stock par contenance. Un seul prix par article (voir US-25, question 2).
insert into tailles (article_id, libelle, quantite)
select v.article_id::uuid, v.libelle, v.quantite from (values
  ('a0000000-0000-0000-0000-000000000006', '100 ml', 3),
  ('a0000000-0000-0000-0000-000000000007', '50 ml', 4),
  ('a0000000-0000-0000-0000-000000000007', '100 ml', 0),  -- épuisée : montre « 100 ml, épuisée »
  ('a0000000-0000-0000-0000-000000000008', '100 ml', 5),
  ('a0000000-0000-0000-0000-000000000009', '10 ml', 10),
  ('a0000000-0000-0000-0000-000000000010', '75 ml', 2)
) as v(article_id, libelle, quantite)
where not exists (select 1 from tailles t where t.article_id = v.article_id::uuid and t.libelle = v.libelle);

insert into promos (article_id, prix_promo, date_fin, badge) values
  ('a0000000-0000-0000-0000-000000000006', 4900, now() + interval '30 days', null),
  ('a0000000-0000-0000-0000-000000000007', 3900, now() + interval '30 days', 'Promo flash'),
  ('a0000000-0000-0000-0000-000000000008', 2900, now() + interval '30 days', null),
  ('a0000000-0000-0000-0000-000000000009', 1200, now() + interval '30 days', null)
on conflict (article_id) do nothing;

insert into photos (article_id, adresse, ordre)
select v.article_id::uuid, v.adresse, 0 from (values
  ('a0000000-0000-0000-0000-000000000006', 'https://placehold.co/600x800/F3F2EF/0A0A0A/png?text=Oud+boise'),
  ('a0000000-0000-0000-0000-000000000007', 'https://placehold.co/600x800/F3F2EF/0A0A0A/png?text=Rose+et+musc'),
  ('a0000000-0000-0000-0000-000000000008', 'https://placehold.co/600x800/F3F2EF/0A0A0A/png?text=Agrumes'),
  ('a0000000-0000-0000-0000-000000000009', 'https://placehold.co/600x800/F3F2EF/0A0A0A/png?text=Musc+blanc'),
  ('a0000000-0000-0000-0000-000000000010', 'https://placehold.co/600x800/F3F2EF/0A0A0A/png?text=Ambre+vanille')
) as v(article_id, adresse)
where not exists (select 1 from photos p where p.article_id = v.article_id::uuid);


-- Contrôle : 1 boutique, 5 articles, 6 contenances, 4 promos, 5 photos.
select (select count(*) from boutiques where id = '33333333-3333-3333-3333-333333333333') as boutiques,
       (select count(*) from articles where boutique_id = '33333333-3333-3333-3333-333333333333') as articles,
       (select count(*) from tailles where article_id::text between 'a0000000-0000-0000-0000-000000000006' and 'a0000000-0000-0000-0000-000000000010') as contenances,
       (select count(*) from promos where article_id::text between 'a0000000-0000-0000-0000-000000000006' and 'a0000000-0000-0000-0000-000000000010') as promos,
       (select count(*) from photos where article_id::text between 'a0000000-0000-0000-0000-000000000006' and 'a0000000-0000-0000-0000-000000000010') as photos;
