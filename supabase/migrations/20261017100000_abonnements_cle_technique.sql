-- Correctif US-31.1 : la clé primaire (profil_id, boutique_id) faisait de abonnements_boutique une table de liaison
-- aux yeux de PostgREST (relation plusieurs-à-plusieurs profils ↔ boutiques). Les lectures « profils → boutiques(…) »
-- devenaient ambiguës (erreur PGRST201), par exemple /espace/commandes (« Impossible de charger les commandes »).
-- PostgREST ne voit une table de liaison que si les deux clés étrangères font partie de la clé primaire : on passe à une
-- clé technique et on garde l'unicité (profil, boutique) par une contrainte d'unicité. Fonctions, droits et RLS inchangés.

alter table public.abonnements_boutique drop constraint abonnements_boutique_pkey;
alter table public.abonnements_boutique add column id bigint generated always as identity;
alter table public.abonnements_boutique add constraint abonnements_boutique_pkey primary key (id);
alter table public.abonnements_boutique add constraint abonnements_boutique_profil_boutique_key unique (profil_id, boutique_id);

notify pgrst, 'reload schema';
