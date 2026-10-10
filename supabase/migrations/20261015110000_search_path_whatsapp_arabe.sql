-- Relecture n°6, point 4 : search_path fixé sur les deux fonctions de US-23 (avertissement « Function Search Path
-- Mutable » de l'outil de conseils de Supabase). Elles n'utilisent que des fonctions de base (pg_catalog, toujours lu) :
-- search_path vide, comme prive.numero_whatsapp et prive.montant_da (20261009230000_corrections_relecture.sql).
alter function prive.gabarit_whatsapp_arabe(text) set search_path = '';
alter function prive.parametres_whatsapp_arabe(text, text[]) set search_path = '';
